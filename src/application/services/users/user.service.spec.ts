import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserService } from './user.service';
import { User } from '../../../domain/entities/user.entity';
import { CreateUserDto } from '../../../presentation/dto/user/create-user.dto';
import { UpdateUserDto } from '../../../presentation/dto/user/update-user.dto';
import { NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PaginationDto, SortDirection } from '../../../presentation/dto/common/pagination.dto';
import * as bcrypt from 'bcryptjs';
import { UserRole } from '../../../shared/constants/user-role.enum';
import { NotificationService } from '../../../infrastructure/messaging/notification.service';
import { FirebaseService } from '../../../infrastructure/firestore/firebase.service';

jest.mock('bcryptjs');

describe('UserService', () => {
    // Silence all logger output for all tests
    let loggerErrorSpy: jest.SpyInstance;
    let loggerDebugSpy: jest.SpyInstance;
    let loggerWarnSpy: jest.SpyInstance;
    let loggerLogSpy: jest.SpyInstance;
    beforeAll(() => {
        loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
        loggerDebugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
        loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
        loggerLogSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    });
    afterAll(() => {
        loggerErrorSpy.mockRestore();
        loggerDebugSpy.mockRestore();
        loggerWarnSpy.mockRestore();
        loggerLogSpy.mockRestore();
    });
    let service: UserService;
    let repository: Repository<User>;
    let notificationService: NotificationService;
    let firebaseService: FirebaseService;

    const mockRepository = {
        create: jest.fn(),
        save: jest.fn(),
        findOne: jest.fn(),
        findAndCount: jest.fn(),
    };

    const mockFirebaseService = {
        addDocument: jest.fn().mockResolvedValue(undefined),
        updateDocument: jest.fn().mockResolvedValue(undefined),
        getDocumentById: jest.fn().mockResolvedValue(null),
    };

    const mockNotificationService = {
        sendNotificationToUser: jest.fn().mockResolvedValue(true),
        broadcastNotification: jest.fn().mockResolvedValue(true),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UserService,
                {
                    provide: getRepositoryToken(User),
                    useValue: mockRepository,
                },
                {
                    provide: NotificationService,
                    useValue: mockNotificationService,
                },
                {
                    provide: FirebaseService,
                    useValue: mockFirebaseService,
                },
            ],
        }).compile();

        service = module.get<UserService>(UserService);
        repository = module.get<Repository<User>>(getRepositoryToken(User));
        notificationService = module.get<NotificationService>(NotificationService);
        firebaseService = module.get<FirebaseService>(FirebaseService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('findAll', () => {
        it('should return paginated users with default pagination', async () => {
            const users = [
                { id: '1', username: 'test1', email: 'test1@example.com' },
                { id: '2', username: 'test2', email: 'test2@example.com' },
            ];
            const total = 2;

            mockRepository.findAndCount.mockResolvedValue([users, total]);

            const result = await service.findAll();

            expect(result).toEqual({
                items: users,
                total,
                page: 1,
                totalPages: 1,
                hasNext: false,
                hasPrevious: false,
            });
            expect(repository.findAndCount).toHaveBeenCalledWith(
                expect.objectContaining({
                    skip: 0,
                    take: 10,
                    order: { createdAt: 'DESC' },
                }),
            );
        });

        it('should return paginated users with custom pagination', async () => {
            const pagination: PaginationDto = {
                page: 2,
                limit: 5,
                sortBy: 'username',
                sortDirection: SortDirection.ASC,
            };
            const users = [
                { id: '6', username: 'test6', email: 'test6@example.com' },
                { id: '7', username: 'test7', email: 'test7@example.com' },
            ];
            const total = 7;

            mockRepository.findAndCount.mockResolvedValue([users, total]);

            const result = await service.findAll(pagination);

            expect(result).toEqual({
                items: users,
                total,
                page: 2,
                totalPages: 2,
                hasNext: false,
                hasPrevious: true,
            });
            expect(repository.findAndCount).toHaveBeenCalledWith(
                expect.objectContaining({
                    skip: 5,
                    take: 5,
                    order: { username: 'ASC' },
                }),
            );
        });
    });

    describe('findOne', () => {
        it('should return a user if found', async () => {
            const user = { id: '1', username: 'test', email: 'test@example.com' };
            mockRepository.findOne.mockResolvedValue(user);

            const result = await service.findOne('1');

            expect(result).toEqual(user);
            expect(repository.findOne).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: '1', isActive: true },
                }),
            );
        });

        it('should throw NotFoundException if user not found', async () => {
            mockRepository.findOne.mockResolvedValue(null);

            await expect(service.findOne('1')).rejects.toThrow(NotFoundException);
            expect(repository.findOne).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: '1', isActive: true },
                }),
            );
        });
    });

    describe('findByEmail', () => {
        it('should return a user if found by email', async () => {
            const user = { id: '1', username: 'test', email: 'test@example.com' };
            mockRepository.findOne.mockResolvedValue(user);

            const result = await service.findByEmail('test@example.com');

            expect(result).toEqual(user);
            expect(repository.findOne).toHaveBeenCalledWith({
                where: { email: 'test@example.com', isActive: true },
            });
        });

        it('should return null if user not found by email', async () => {
            mockRepository.findOne.mockResolvedValue(null);

            const result = await service.findByEmail('nonexistent@example.com');

            expect(result).toBeNull();
            expect(repository.findOne).toHaveBeenCalledWith({
                where: { email: 'nonexistent@example.com', isActive: true },
            });
        });
    });

    describe('findById', () => {
        it('should return a user if found by id', async () => {
            const user = { id: '1', username: 'test', email: 'test@example.com', isActive: true };
            mockRepository.findOne.mockResolvedValue(user);

            const result = await service.findById('1');

            expect(result).toEqual(user);
            expect(repository.findOne).toHaveBeenCalledWith({
                where: { id: '1', isActive: true },
            });
        });

        it('should return null if user not found by id', async () => {
            mockRepository.findOne.mockResolvedValue(null);

            const result = await service.findById('nonexistent');

            // This should be null, not undefined according to the implementation
            expect(result).toBeNull();
            expect(repository.findOne).toHaveBeenCalledWith({
                where: { id: 'nonexistent', isActive: true },
            });
        });

        it('should attempt to fetch user from Firebase if not found in DB', async () => {
            const firebaseUser = {
                id: '1',
                username: 'firebase-user',
                email: 'firebase@example.com',
                isActive: true,
            };

            // First DB lookup fails
            mockRepository.findOne.mockResolvedValue(null);

            // But Firebase lookup succeeds
            mockFirebaseService.getDocumentById.mockResolvedValue(firebaseUser);

            const result = await service.findById('1');

            expect(result).toEqual(firebaseUser);
            expect(repository.findOne).toHaveBeenCalledWith({
                where: { id: '1', isActive: true },
            });
            expect(firebaseService.getDocumentById).toHaveBeenCalledWith('users', '1');
        });
    });

    describe('create', () => {
        it('should create a new user with hashed password and send notifications', async () => {
            const createUserDto: CreateUserDto = {
                username: 'newuser',
                email: 'newuser@example.com',
                password: 'password123',
                role: UserRole.USER,
            };

            const hashedPassword = 'hashedPassword123';
            (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

            const createdUser = {
                id: '1',
                ...createUserDto,
                password: hashedPassword,
                timezone: 'UTC',
                notificationPrefs: {
                    email: true,
                    push: true,
                    frequency: 'immediate',
                },
            };

            mockRepository.create.mockReturnValue(createdUser);
            mockRepository.save.mockResolvedValue(createdUser);

            const result = await service.create(createUserDto);

            const { password, ...userWithoutPassword } = createdUser;
            expect(result).toEqual(userWithoutPassword);
            expect(bcrypt.hash).toHaveBeenCalledWith(createUserDto.password, 10);
            expect(repository.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    ...createUserDto,
                    password: hashedPassword,
                }),
            );
            expect(repository.save).toHaveBeenCalledWith(createdUser);

            // Verify notification service calls
            expect(notificationService.sendNotificationToUser).toHaveBeenCalledWith(
                createdUser.id,
                {
                    title: 'Welcome!',
                    body: 'Welcome to our platform!',
                },
                {
                    userId: createdUser.id,
                    type: 'welcome',
                },
            );

            expect(notificationService.broadcastNotification).toHaveBeenCalledWith({
                title: 'New User Joined',
                body: 'A new user has joined the platform!',
            });
        });

        it('should handle password hashing error', async () => {
            const createUserDto: CreateUserDto = {
                username: 'newuser',
                email: 'newuser@example.com',
                password: 'password123',
                role: UserRole.USER,
            };

            (bcrypt.hash as jest.Mock).mockRejectedValue(new Error('Hashing failed'));

            await expect(service.create(createUserDto)).rejects.toThrow('Hashing failed');
            expect(bcrypt.hash).toHaveBeenCalledWith(createUserDto.password, 10);
            expect(repository.create).not.toHaveBeenCalled();
            expect(repository.save).not.toHaveBeenCalled();
            expect(notificationService.sendNotificationToUser).not.toHaveBeenCalled();
            expect(notificationService.broadcastNotification).not.toHaveBeenCalled();
        });

        it('should handle notification sending error', async () => {
            const createUserDto: CreateUserDto = {
                username: 'newuser',
                email: 'newuser@example.com',
                password: 'password123',
                role: UserRole.USER,
            };

            const hashedPassword = 'hashedPassword123';
            (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

            const createdUser = {
                id: '1',
                ...createUserDto,
                password: hashedPassword,
                timezone: 'UTC',
                notificationPrefs: {
                    email: true,
                    push: true,
                    frequency: 'immediate',
                },
            };

            mockRepository.create.mockReturnValue(createdUser);
            mockRepository.save.mockResolvedValue(createdUser);
            mockNotificationService.sendNotificationToUser.mockRejectedValue(
                new Error('Notification failed'),
            );

            await expect(service.create(createUserDto)).rejects.toThrow('Notification failed');
            expect(bcrypt.hash).toHaveBeenCalledWith(createUserDto.password, 10);
            expect(repository.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    ...createUserDto,
                    password: hashedPassword,
                }),
            );
            expect(repository.save).toHaveBeenCalledWith(createdUser);
            expect(notificationService.sendNotificationToUser).toHaveBeenCalledWith(
                createdUser.id,
                {
                    title: 'Welcome!',
                    body: 'Welcome to our platform!',
                },
                {
                    userId: createdUser.id,
                    type: 'welcome',
                },
            );
        });

        it('should handle broadcast notification error', async () => {
            const createUserDto: CreateUserDto = {
                username: 'newuser',
                email: 'newuser@example.com',
                password: 'password123',
                role: UserRole.USER,
            };

            const hashedPassword = 'hashedPassword123';
            (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

            const createdUser = {
                id: '1',
                ...createUserDto,
                password: hashedPassword,
                timezone: 'UTC',
                notificationPrefs: {
                    email: true,
                    push: true,
                    frequency: 'immediate',
                },
            };

            mockRepository.create.mockReturnValue(createdUser);
            mockRepository.save.mockResolvedValue(createdUser);

            // Mock successful user notification but failed broadcast
            mockNotificationService.sendNotificationToUser.mockResolvedValue(true);
            mockNotificationService.broadcastNotification.mockRejectedValue(
                new Error('Broadcast failed'),
            );

            await expect(service.create(createUserDto)).rejects.toThrow('Broadcast failed');
            expect(bcrypt.hash).toHaveBeenCalledWith(createUserDto.password, 10);
            expect(repository.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    ...createUserDto,
                    password: hashedPassword,
                }),
            );
            expect(repository.save).toHaveBeenCalledWith(createdUser);
            expect(notificationService.sendNotificationToUser).toHaveBeenCalled();
            expect(notificationService.broadcastNotification).toHaveBeenCalledWith({
                title: 'New User Joined',
                body: 'A new user has joined the platform!',
            });
        });

        it('should also save user to Firebase when creating', async () => {
            const createUserDto: CreateUserDto = {
                username: 'newuser',
                email: 'newuser@example.com',
                password: 'password123',
                role: UserRole.USER,
            };

            const hashedPassword = 'hashedPassword123';
            (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

            const createdUser = {
                id: '1',
                ...createUserDto,
                password: hashedPassword,
                isActive: true,
            };

            mockRepository.create.mockReturnValue(createdUser);
            mockRepository.save.mockResolvedValue(createdUser);
            mockFirebaseService.addDocument.mockResolvedValue(undefined);

            // Mock successful notifications
            mockNotificationService.sendNotificationToUser.mockResolvedValue(true);
            mockNotificationService.broadcastNotification.mockResolvedValue(true);

            await service.create(createUserDto);

            // Verify Firebase integration
            const { password, ...userWithoutPassword } = createdUser;
            expect(firebaseService.addDocument).toHaveBeenCalledWith(
                'users',
                userWithoutPassword,
                '1',
            );
        });
    });

    describe('update', () => {
        const existingUser = {
            id: '1',
            username: 'existinguser',
            email: 'existing@example.com',
            password: 'oldhashed',
        };

        it('should update user without password', async () => {
            const updateUserDto: UpdateUserDto = {
                username: 'updateduser',
                email: 'updated@example.com',
            };

            mockRepository.findOne.mockResolvedValue(existingUser);
            // Create updated user without password
            const updatedUser = { ...existingUser, ...updateUserDto };
            const { password, ...userWithoutPassword } = updatedUser;

            mockRepository.save.mockResolvedValue(updatedUser);

            const result = await service.update('1', updateUserDto);

            expect(result).toEqual(userWithoutPassword);
            expect(bcrypt.hash).not.toHaveBeenCalled();
            expect(repository.findOne).toHaveBeenCalledWith({
                where: { id: '1', isActive: true },
            });
            expect(repository.save).toHaveBeenCalledWith({ ...existingUser, ...updateUserDto });
        });

        it('should update user with password', async () => {
            const updateUserDto: UpdateUserDto = {
                password: 'newpassword123',
            };

            const hashedPassword = 'newhashed';
            (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

            mockRepository.findOne.mockResolvedValue(existingUser);
            const updatedUser = { ...existingUser, password: hashedPassword };
            const { password, ...userWithoutPassword } = updatedUser;

            mockRepository.save.mockResolvedValue(updatedUser);

            const result = await service.update('1', updateUserDto);

            expect(result).toEqual(userWithoutPassword);
            expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 10);
            expect(repository.findOne).toHaveBeenCalledWith({
                where: { id: '1', isActive: true },
            });
            expect(repository.save).toHaveBeenCalledWith({
                ...existingUser,
                password: hashedPassword,
            });
        });
        it('should throw NotFoundException when user not found', async () => {
            const updateUserDto: UpdateUserDto = {
                username: 'updateduser',
            };

            // The update method calls findById, so we need to mock it directly
            jest.spyOn(service, 'findById').mockResolvedValue(null);

            await expect(service.update('1', updateUserDto)).rejects.toThrow(NotFoundException);
            expect(repository.save).not.toHaveBeenCalled();
        });

        it('should also update user in Firebase', async () => {
            const updateUserDto: UpdateUserDto = {
                username: 'updateduser',
            };

            mockRepository.findOne.mockResolvedValue(existingUser);
            mockRepository.save.mockResolvedValue({ ...existingUser, ...updateUserDto });
            mockFirebaseService.updateDocument.mockResolvedValue(undefined);

            await service.update('1', updateUserDto);

            // Verify Firebase integration
            const { password, ...userWithoutPassword } = { ...existingUser, ...updateUserDto };
            expect(firebaseService.updateDocument).toHaveBeenCalledWith(
                'users',
                '1',
                userWithoutPassword,
            );
        });
    });

    describe('updatePassword', () => {
        const existingUser = {
            id: '1',
            username: 'existinguser',
            email: 'existing@example.com',
            password: 'oldhashed',
        };

        it('should update password when old password is correct', async () => {
            mockRepository.findOne.mockResolvedValue(existingUser);
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);
            (bcrypt.hash as jest.Mock).mockResolvedValue('newhashed');
            mockRepository.save.mockResolvedValue({ ...existingUser, password: 'newhashed' });

            const result = await service.updatePassword('1', 'oldpassword', 'newpassword');

            expect(result).toBe(true);
            expect(bcrypt.compare).toHaveBeenCalledWith('oldpassword', 'oldhashed');
            expect(bcrypt.hash).toHaveBeenCalledWith('newpassword', 10);
            expect(repository.save).toHaveBeenCalledWith({
                ...existingUser,
                password: 'newhashed',
            });
        });
        it('should throw BadRequestException when old password is incorrect', async () => {
            // Create a clean mock setup for this test to avoid interference
            jest.clearAllMocks();

            // Create a specific copy of the existing user for this test
            const userWithOldHash = {
                ...existingUser,
                password: 'oldhashed', // Ensure we use 'oldhashed' specifically for this test
            };

            mockRepository.findOne.mockResolvedValue(userWithOldHash);
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);

            await expect(
                service.updatePassword('1', 'wrongpassword', 'newpassword'),
            ).rejects.toThrow(BadRequestException);

            expect(bcrypt.compare).toHaveBeenCalledWith('wrongpassword', 'oldhashed');
            expect(bcrypt.hash).not.toHaveBeenCalled();
            expect(repository.save).not.toHaveBeenCalled();
        });

        it('should throw NotFoundException when user not found', async () => {
            mockRepository.findOne.mockResolvedValue(null);

            await expect(service.updatePassword('1', 'oldpassword', 'newpassword')).rejects.toThrow(
                NotFoundException,
            );

            expect(bcrypt.compare).not.toHaveBeenCalled();
            expect(bcrypt.hash).not.toHaveBeenCalled();
            expect(repository.save).not.toHaveBeenCalled();
        });
    });

    describe('softDelete', () => {
        const existingUser = {
            id: '1',
            username: 'existinguser',
            email: 'existing@example.com',
            password: 'oldhashed',
            isActive: true,
        };

        it('should mark user as inactive', async () => {
            mockRepository.findOne.mockResolvedValue(existingUser);
            mockRepository.save.mockResolvedValue({ ...existingUser, isActive: false });

            const result = await service.softDelete('1');

            expect(result).toBe(true);
            expect(repository.findOne).toHaveBeenCalledWith({
                where: { id: '1', isActive: true },
            });
            expect(repository.save).toHaveBeenCalledWith({
                ...existingUser,
                isActive: false,
            });
        });
        it('should throw NotFoundException when user not found', async () => {
            // The softDelete method calls findById, so we need to mock it directly
            jest.spyOn(service, 'findById').mockResolvedValue(null);

            await expect(service.softDelete('1')).rejects.toThrow(NotFoundException);
            expect(repository.save).not.toHaveBeenCalled();
        });

        it('should update isActive flag in Firebase when soft deleting', async () => {
            mockRepository.findOne.mockResolvedValue(existingUser);
            mockRepository.save.mockResolvedValue({ ...existingUser, isActive: false });
            mockFirebaseService.updateDocument.mockResolvedValue(undefined);

            await service.softDelete('1');

            expect(firebaseService.updateDocument).toHaveBeenCalledWith('users', '1', {
                isActive: false,
            });
        });
    });
});
