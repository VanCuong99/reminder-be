import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserService } from './user.service';
import { User } from '../../../domain/entities/user.entity';
import { CreateUserInput } from '../../../presentation/graphql/types/user/inputs/create-user.input';
import { UpdateUserInput } from '../../../presentation/graphql/types/user/inputs/update-user.input';
import { NotFoundException } from '@nestjs/common';
import { PaginationInput } from '../../../shared/types/graphql/inputs/pagination.input';
import * as bcrypt from 'bcryptjs';
import { UserRole } from '../../../shared/constants/user-role.enum';
import { NotificationService } from '../../../infrastructure/messaging/notification.service';

jest.mock('bcryptjs');

describe('UserService', () => {
    let service: UserService;
    let repository: Repository<User>;
    let notificationService: NotificationService;

    const mockRepository = {
        create: jest.fn(),
        save: jest.fn(),
        findOne: jest.fn(),
        findAndCount: jest.fn(),
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
            ],
        }).compile();

        service = module.get<UserService>(UserService);
        repository = module.get<Repository<User>>(getRepositoryToken(User));
        notificationService = module.get<NotificationService>(NotificationService);
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
            expect(repository.findAndCount).toHaveBeenCalledWith({
                skip: 0,
                take: 10,
                order: { createdAt: 'DESC' },
            });
        });

        it('should return paginated users with custom pagination', async () => {
            const pagination: PaginationInput = {
                page: 2,
                limit: 5,
                sortBy: 'username',
                sortDirection: 'ASC',
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
            expect(repository.findAndCount).toHaveBeenCalledWith({
                skip: 5,
                take: 5,
                order: { username: 'ASC' },
            });
        });
    });

    describe('findOne', () => {
        it('should return a user if found', async () => {
            const user = { id: '1', username: 'test', email: 'test@example.com' };
            mockRepository.findOne.mockResolvedValue(user);

            const result = await service.findOne('1');

            expect(result).toEqual(user);
            expect(repository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
        });

        it('should throw NotFoundException if user not found', async () => {
            mockRepository.findOne.mockResolvedValue(null);

            await expect(service.findOne('1')).rejects.toThrow(NotFoundException);
            expect(repository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
        });
    });

    describe('findOneByEmail', () => {
        it('should return a user if found by email', async () => {
            const user = { id: '1', username: 'test', email: 'test@example.com' };
            mockRepository.findOne.mockResolvedValue(user);

            const result = await service.findOneByEmail('test@example.com');

            expect(result).toEqual(user);
            expect(repository.findOne).toHaveBeenCalledWith({
                where: { email: 'test@example.com' },
            });
        });

        it('should return null if user not found by email', async () => {
            mockRepository.findOne.mockResolvedValue(null);

            const result = await service.findOneByEmail('nonexistent@example.com');

            expect(result).toBeNull();
            expect(repository.findOne).toHaveBeenCalledWith({
                where: { email: 'nonexistent@example.com' },
            });
        });
    });

    describe('create', () => {
        it('should create a new user with hashed password and send notifications', async () => {
            const createUserInput: CreateUserInput = {
                username: 'newuser',
                email: 'newuser@example.com',
                password: 'password123',
                role: UserRole.USER,
            };

            const hashedPassword = 'hashedPassword123';
            (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

            const createdUser = { id: '1', ...createUserInput, password: hashedPassword };
            mockRepository.create.mockReturnValue(createdUser);
            mockRepository.save.mockResolvedValue(createdUser);

            const result = await service.create(createUserInput);

            expect(result).toEqual(createdUser);
            expect(bcrypt.hash).toHaveBeenCalledWith(createUserInput.password, 10);
            expect(repository.create).toHaveBeenCalledWith({
                ...createUserInput,
                password: hashedPassword,
            });
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
            const createUserInput: CreateUserInput = {
                username: 'newuser',
                email: 'newuser@example.com',
                password: 'password123',
                role: UserRole.USER,
            };

            (bcrypt.hash as jest.Mock).mockRejectedValue(new Error('Hashing failed'));

            await expect(service.create(createUserInput)).rejects.toThrow('Hashing failed');
            expect(bcrypt.hash).toHaveBeenCalledWith(createUserInput.password, 10);
            expect(repository.create).not.toHaveBeenCalled();
            expect(repository.save).not.toHaveBeenCalled();
            expect(notificationService.sendNotificationToUser).not.toHaveBeenCalled();
            expect(notificationService.broadcastNotification).not.toHaveBeenCalled();
        });

        it('should handle notification sending error', async () => {
            const createUserInput: CreateUserInput = {
                username: 'newuser',
                email: 'newuser@example.com',
                password: 'password123',
                role: UserRole.USER,
            };

            const hashedPassword = 'hashedPassword123';
            (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

            const createdUser = { id: '1', ...createUserInput, password: hashedPassword };
            mockRepository.create.mockReturnValue(createdUser);
            mockRepository.save.mockResolvedValue(createdUser);
            mockNotificationService.sendNotificationToUser.mockRejectedValue(
                new Error('Notification failed'),
            );

            await expect(service.create(createUserInput)).rejects.toThrow('Notification failed');
            expect(bcrypt.hash).toHaveBeenCalledWith(createUserInput.password, 10);
            expect(repository.create).toHaveBeenCalledWith({
                ...createUserInput,
                password: hashedPassword,
            });
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
    });

    describe('update', () => {
        const existingUser = {
            id: '1',
            username: 'existinguser',
            email: 'existing@example.com',
            password: 'oldhashed',
        };

        it('should update user without password', async () => {
            const updateUserInput: UpdateUserInput = {
                username: 'updateduser',
                email: 'updated@example.com',
            };

            mockRepository.findOne.mockResolvedValue(existingUser);
            mockRepository.save.mockResolvedValue({ ...existingUser, ...updateUserInput });

            const result = await service.update('1', updateUserInput);

            expect(result).toEqual({ ...existingUser, ...updateUserInput });
            expect(bcrypt.hash).not.toHaveBeenCalled();
            expect(repository.save).toHaveBeenCalledWith({ ...existingUser, ...updateUserInput });
        });

        it('should update user with password', async () => {
            const updateUserInput: UpdateUserInput = {
                password: 'newpassword123',
            };

            const hashedPassword = 'newhashed';
            (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

            mockRepository.findOne.mockResolvedValue(existingUser);
            mockRepository.save.mockResolvedValue({ ...existingUser, password: hashedPassword });

            const result = await service.update('1', updateUserInput);

            expect(result).toEqual({ ...existingUser, password: hashedPassword });
            expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 10);
            expect(repository.save).toHaveBeenCalledWith({
                ...existingUser,
                password: hashedPassword,
            });
        });

        it('should throw NotFoundException when user not found', async () => {
            const updateUserInput: UpdateUserInput = {
                username: 'updateduser',
            };

            mockRepository.findOne.mockResolvedValue(null);

            await expect(service.update('1', updateUserInput)).rejects.toThrow(NotFoundException);
            expect(repository.save).not.toHaveBeenCalled();
        });
    });
});
