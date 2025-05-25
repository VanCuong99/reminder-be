import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsSelect } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../../../domain/entities/user.entity';
import { FirebaseService } from '../../../infrastructure/firestore/firebase.service';
import { BaseService, IPaginatedType } from '../base/base.service';
import { PaginationDto } from '../../../presentation/dto/common/pagination.dto';
import { NotificationService } from '../../../infrastructure/messaging/notification.service';
import { UserRole } from '../../../shared/constants/user-role.enum';
import { NotificationPreferences } from '../../../shared/types/notification-preferences.interface';

@Injectable()
export class UserService extends BaseService<User> {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly firebaseService: FirebaseService,
        private readonly notificationService: NotificationService,
    ) {
        super(userRepository);
    }

    async findAll(pagination?: PaginationDto): Promise<IPaginatedType<User>> {
        return this.paginate(pagination, {
            where: { isActive: true },
            select: {
                id: true,
                email: true,
                username: true,
                role: true,
                timezone: true,
                notificationPrefs: {
                    email: true,
                    push: true,
                    frequency: true,
                },
                createdAt: true,
                updatedAt: true,
            } as FindOptionsSelect<User>,
        });
    }

    async findOne(id: string): Promise<User> {
        const user = await this.findById(id);
        if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }
        return user;
    }

    async findById(id: string): Promise<User | undefined> {
        const user = await this.userRepository.findOne({
            where: { id, isActive: true },
        });

        if (!user) {
            // Try to find in Firebase as backup
            try {
                const firebaseUser = await this.firebaseService.getDocumentById('users', id);

                if (firebaseUser?.isActive) {
                    return firebaseUser as User;
                }
            } catch (error) {
                console.error(`Error fetching user from Firebase: ${error.message}`);
            }
        }

        return user;
    }

    async findByEmail(email: string): Promise<User | undefined> {
        return this.userRepository.findOne({
            where: { email, isActive: true },
        });
    }

    async create(userData: {
        email: string;
        username: string;
        password?: string;
        role?: UserRole;
        timezone?: string;
        notificationPrefs?: NotificationPreferences;
        socialId?: string;
        provider?: string;
    }): Promise<User> {
        // Check if user with email already exists
        const existingUser = await this.findByEmail(userData.email);
        if (existingUser) {
            throw new BadRequestException('User with this email already exists');
        }

        // Only hash password if it's provided (not for social login)
        let hashedPassword = undefined;
        if (userData.password) {
            hashedPassword = await bcrypt.hash(userData.password, 10);
        }

        // Create the user in the database with properly typed data
        const user = this.userRepository.create({
            email: userData.email,
            username: userData.username,
            password: hashedPassword,
            role: userData.role || UserRole.USER,
            timezone: userData.timezone || 'UTC',
            notificationPrefs: userData.notificationPrefs || {
                email: true,
                push: true,
                frequency: 'immediate' as 'immediate' | 'daily' | 'weekly',
            },
            socialId: userData.socialId,
            provider: userData.provider,
            createdAt: new Date(),
            updatedAt: new Date(),
            isActive: true,
        } as User);

        const savedUser = await this.userRepository.save(user);

        // Also store in Firebase for backup/redundancy
        try {
            // Use destructuring safely on a single User object
            const { password, ...userForFirebase } = savedUser;
            await this.firebaseService.addDocument('users', userForFirebase, savedUser.id);
        } catch (error) {
            console.error(`Failed to save user to Firebase: ${error.message}`);
            // Continue anyway since PostgreSQL is our primary store
        }

        // Send welcome notification
        try {
            await this.notificationService.sendNotificationToUser(
                savedUser.id,
                {
                    title: 'Welcome!',
                    body: 'Welcome to our platform!',
                },
                {
                    userId: savedUser.id,
                    type: 'welcome',
                },
            );

            // Broadcast to admins about new user
            await this.notificationService.broadcastNotification({
                title: 'New User Joined',
                body: 'A new user has joined the platform!',
            });
        } catch (error) {
            throw error; // Re-throw error for the caller to handle
        }

        // Don't return the password
        const { password, ...result } = savedUser;
        return result as User;
    }

    async update(
        id: string,
        updateData: {
            username?: string;
            email?: string;
            password?: string;
            role?: string;
            timezone?: string;
            notificationPrefs?: NotificationPreferences;
        },
    ): Promise<User> {
        const user = await this.findById(id);
        if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }

        // Hash password if provided
        if (updateData.password) {
            updateData.password = await bcrypt.hash(updateData.password, 10);
        }

        // Update user fields
        Object.assign(user, updateData);

        const updatedUser = await this.userRepository.save(user);

        // Update in Firebase as well
        try {
            const { password, ...userForFirebase } = updatedUser;
            await this.firebaseService.updateDocument('users', id, userForFirebase);
        } catch (error) {
            console.error(`Failed to update user in Firebase: ${error.message}`);
        }

        // Don't return the password
        const { password, ...result } = updatedUser;
        return result as User;
    }

    async updatePassword(id: string, oldPassword: string, newPassword: string): Promise<boolean> {
        const user = await this.userRepository.findOne({
            where: { id, isActive: true },
        });

        if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }

        // Verify old password
        const isValid = await bcrypt.compare(oldPassword, user.password);
        if (!isValid) {
            throw new BadRequestException('Current password is incorrect');
        }

        // Hash and set new password
        user.password = await bcrypt.hash(newPassword, 10);

        await this.userRepository.save(user);
        return true;
    }

    async softDelete(id: string): Promise<boolean> {
        const user = await this.findById(id);
        if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }

        // Mark as inactive instead of deleting
        user.isActive = false;
        await this.userRepository.save(user);

        // Update in Firebase as well
        try {
            await this.firebaseService.updateDocument('users', id, { isActive: false });
        } catch (error) {
            console.error(`Failed to update user in Firebase: ${error.message}`);
        }

        return true;
    }
}
