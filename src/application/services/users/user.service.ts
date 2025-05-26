import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsSelect } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../../../domain/entities/user.entity';
import { SocialAccount } from '../../../domain/entities/social-account.entity';
import { FirebaseService } from '../../../infrastructure/firestore/firebase.service';
import { BaseService, IPaginatedType } from '../base/base.service';
import { PaginationDto } from '../../../presentation/dto/common/pagination.dto';
import { NotificationService } from '../../../infrastructure/messaging/notification.service';
import { UserRole } from '../../../shared/constants/user-role.enum';
import { NotificationPreferences } from '../../../shared/types/notification-preferences.interface';
import { Profile } from '../../../domain/entities/profile.entity';
import { AuthProvider } from '../../../shared/constants/auth.constants';
import { LinkSocialAccountInput } from '../../../application/interfaces/auth/social-account.interface';

@Injectable()
export class UserService extends BaseService<User> {
    private readonly logger = new Logger(UserService.name);

    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(SocialAccount)
        private readonly socialAccountRepository: Repository<SocialAccount>,
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

    async findById(id: string, includeInactive = false): Promise<User | null> {
        // Try database first
        const user = await this.userRepository.findOne({
            where: {
                id,
                ...(includeInactive ? {} : { isActive: true }),
            },
        });

        if (user) {
            return user;
        }

        // If not found in DB and Firebase service is available, try Firebase
        try {
            if (this.firebaseService) {
                const firebaseUser = await this.firebaseService.getDocumentById('users', id);
                if (firebaseUser) {
                    // Convert Firebase data to User entity
                    return {
                        ...firebaseUser,
                        isActive: firebaseUser.isActive ?? true,
                    } as User;
                }
            }
        } catch (error) {
            this.logger.error(`Failed to fetch user from Firebase: ${error.message}`);
        }

        return null;
    }

    async findByEmail(email: string): Promise<User | undefined> {
        return this.userRepository.findOne({
            where: { email, isActive: true },
        });
    }

    async findBySocialId(socialId: string, provider: AuthProvider): Promise<User | null> {
        const socialAccount = await this.socialAccountRepository.findOne({
            where: { providerId: socialId, provider },
            relations: ['user'],
        });
        return socialAccount?.user ?? null;
    }

    async linkSocialAccount(input: LinkSocialAccountInput): Promise<void> {
        const { userId, socialId, provider, avatar } = input;

        // First check if user exists
        const user = await this.findById(userId);
        if (!user) {
            throw new NotFoundException(`User with ID ${userId} not found`);
        }

        // Check if social account already exists
        const existingSocialAccount = await this.socialAccountRepository.findOne({
            where: { providerId: socialId, provider },
        });
        if (existingSocialAccount) {
            throw new BadRequestException(`Social account already exists for provider ${provider}`);
        }

        // Update user's profile avatar if provided
        if (avatar) {
            if (!user.profile) {
                user.profile = new Profile();
            }
            user.profile.avatar = avatar;
            await this.userRepository.save(user);
        }

        // Create new social account
        await this.socialAccountRepository.save({
            providerId: socialId,
            provider,
            userId,
        });
    }

    async create(params: {
        email: string;
        username: string;
        password?: string;
        role?: UserRole;
        timezone?: string;
        notificationPrefs?: NotificationPreferences;
        socialId?: string;
        provider?: AuthProvider;
        avatar?: string;
    }): Promise<User> {
        const {
            email,
            username,
            password,
            socialId,
            provider,
            avatar,
            timezone,
            notificationPrefs,
            ...rest
        } = params;

        // Check if email already exists
        const existingUser = await this.findByEmail(email);
        if (existingUser) {
            throw new BadRequestException(`User with email ${email} already exists`);
        }

        // Hash password if provided
        const hashedPassword = password ? await bcrypt.hash(password, 12) : null;

        // Create profile entity
        const profile = new Profile();
        profile.avatar = avatar;
        profile.timezone = timezone;
        profile.preferences = {
            notifications: {
                email: notificationPrefs?.email ?? true,
                push: notificationPrefs?.push ?? true,
                frequency: notificationPrefs?.frequency ?? 'immediate',
            },
            theme: 'light',
            language: 'en',
        };

        // Create user entity
        const userEntity = this.userRepository.create({
            email,
            username,
            password: hashedPassword,
            role: rest.role || UserRole.USER,
            isActive: true,
            loginCount: 0,
            failedAttempts: 0,
            profile,
        });

        // Save user
        const user = await this.userRepository.save(userEntity);

        // If social login, create social account
        if (socialId && provider) {
            await this.linkSocialAccount({
                userId: user.id,
                socialId,
                provider,
            });
        }

        // Add user to Firebase
        const { password: _pw, ...userWithoutPassword } = user;
        if (this.firebaseService && typeof this.firebaseService.addDocument === 'function') {
            await this.firebaseService.addDocument('users', userWithoutPassword, user.id);
        }

        // Send notifications
        if (
            this.notificationService &&
            typeof this.notificationService.sendNotificationToUser === 'function'
        ) {
            await this.notificationService.sendNotificationToUser(
                user.id,
                {
                    title: 'Welcome!',
                    body: 'Welcome to our platform!',
                },
                {
                    userId: user.id,
                    type: 'welcome',
                },
            );
        }
        if (
            this.notificationService &&
            typeof this.notificationService.broadcastNotification === 'function'
        ) {
            await this.notificationService.broadcastNotification({
                title: 'New User Joined',
                body: 'A new user has joined the platform!',
            });
        }

        // Don't return password in response
        const { password: _, ...result } = user;
        return { ...result, password: undefined } as User;
    }

    async update(
        id: string,
        updateData: {
            username?: string;
            email?: string;
            password?: string;
            role?: UserRole;
            avatar?: string;
            timezone?: string;
            notificationPrefs?: NotificationPreferences;
        },
    ): Promise<User> {
        const { avatar, timezone, notificationPrefs, ...userData } = updateData;

        // First check if user exists in database
        const user = await this.findById(id);
        if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }

        // Load user with profile relation for updating profile data
        const userWithProfile = await this.userRepository.findOne({
            where: { id },
            relations: ['profile'],
        });

        // Handle profile related updates
        if (!userWithProfile.profile) {
            userWithProfile.profile = new Profile();
        }

        if (avatar !== undefined) {
            userWithProfile.profile.avatar = avatar;
        }

        if (timezone !== undefined) {
            userWithProfile.profile.timezone = timezone;
        }

        if (notificationPrefs) {
            userWithProfile.profile.preferences = {
                ...userWithProfile.profile.preferences,
                notifications: {
                    email:
                        notificationPrefs.email ??
                        userWithProfile.profile.preferences?.notifications?.email ??
                        true,
                    push:
                        notificationPrefs.push ??
                        userWithProfile.profile.preferences?.notifications?.push ??
                        true,
                    frequency:
                        notificationPrefs.frequency ??
                        userWithProfile.profile.preferences?.notifications?.frequency ??
                        'immediate',
                },
            };
        }

        // Hash password if provided
        if (userData.password) {
            userData.password = await bcrypt.hash(userData.password, 10);
        }

        // Update user fields
        Object.assign(userWithProfile, userData);

        // Save the updated user
        const updatedUser = await this.userRepository.save(userWithProfile);

        // Update in Firebase as well
        try {
            const { password: _, ...userForFirebase } = updatedUser;
            await this.firebaseService.updateDocument('users', id, userForFirebase);
        } catch (error) {
            this.logger.error(`Failed to update user in Firebase: ${error.message}`);
        }

        // Don't return the password
        const { password: __, ...result } = updatedUser;
        // Add password as undefined to satisfy the User type
        return { ...result, password: undefined } as User;
    }

    async updateLoginMetadata(
        id: string,
        metadata: {
            lastLoginAt: Date;
            lastLoginProvider: AuthProvider;
            loginCount: number;
            lastUserAgent?: string;
            lastLoginIp?: string;
            failedAttempts?: number;
        },
    ): Promise<User> {
        const user = await this.userRepository.findOne({
            where: { id },
        });

        if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }

        // Update login metadata fields
        user.lastLoginAt = metadata.lastLoginAt;
        user.lastLoginProvider = metadata.lastLoginProvider;
        user.loginCount = metadata.loginCount;
        if (metadata.lastUserAgent) {
            user.lastUserAgent = metadata.lastUserAgent;
        }
        if (metadata.lastLoginIp) {
            user.lastLoginIp = metadata.lastLoginIp;
        }
        if (metadata.failedAttempts !== undefined) {
            user.failedAttempts = metadata.failedAttempts;
        }

        // Save the updated user
        const updatedUser = await this.userRepository.save(user);

        // Update in Firebase if available
        try {
            const { password: _, ...userForFirebase } = updatedUser;
            await this.firebaseService.updateDocument('users', id, userForFirebase);
        } catch (error) {
            this.logger.error(`Failed to update user login metadata in Firebase: ${error.message}`);
        }

        // Return user without password field
        const { password: __, ...result } = updatedUser;
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
        const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
        if (!isPasswordValid) {
            throw new BadRequestException('Current password is incorrect');
        }

        // Hash and update new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;

        await this.userRepository.save(user);
        return true;
    }

    async softDelete(id: string): Promise<boolean> {
        const user = await this.findById(id);
        if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }

        user.isActive = false;
        await this.userRepository.save(user);

        // Update in Firebase if available
        try {
            await this.firebaseService.updateDocument('users', id, { isActive: false });
        } catch (error) {
            this.logger.error(`Failed to update user active status in Firebase: ${error.message}`);
        }

        return true;
    }
}
