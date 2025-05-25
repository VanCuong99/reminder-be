import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UserService } from '../../application/services/users/user.service';
import { CreateUserDto } from '../dto/user/create-user.dto';
import { UpdateUserDto } from '../dto/user/update-user.dto';
import { PaginationDto, SortDirection } from '../dto/common/pagination.dto';
import { UserRole } from '../../shared/constants/user-role.enum';
import { Logger, NotFoundException } from '@nestjs/common';
import { User } from '../../domain/entities/user.entity';

describe('UsersController', () => {
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
    let controller: UsersController;
    let userService: jest.Mocked<UserService>;

    const mockUser: User = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword',
        role: UserRole.USER,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deviceTokens: [],
        timezone: 'UTC',
        notificationPrefs: {
            email: true,
            push: true,
            frequency: 'immediate',
        },
    };

    const mockUsers: User[] = [
        mockUser,
        {
            id: '2',
            username: 'admin',
            email: 'admin@example.com',
            password: 'hashedpassword',
            role: UserRole.ADMIN,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            deviceTokens: [],
            timezone: 'UTC',
            notificationPrefs: {
                email: true,
                push: true,
                frequency: 'immediate',
            },
        },
    ];

    const mockPaginatedResponse = {
        items: mockUsers,
        total: 2,
        page: 1,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
    };

    beforeEach(async () => {
        const mockUserService = {
            findAll: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [UsersController],
            providers: [
                {
                    provide: UserService,
                    useValue: mockUserService,
                },
            ],
        }).compile();

        controller = module.get<UsersController>(UsersController);
        userService = module.get(UserService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('findAll', () => {
        it('should return paginated users', async () => {
            const paginationDto: PaginationDto = {
                page: 1,
                limit: 10,
                sortBy: 'createdAt',
                sortDirection: SortDirection.DESC,
            };
            userService.findAll.mockResolvedValue(mockPaginatedResponse);

            const result = await controller.findAll(paginationDto);

            expect(result).toBe(mockPaginatedResponse);
            expect(userService.findAll).toHaveBeenCalledWith(paginationDto);
        });
    });

    describe('findOne', () => {
        it('should return a single user when found', async () => {
            userService.findOne.mockResolvedValue(mockUser);

            const result = await controller.findOne('1');

            expect(result).toBe(mockUser);
            expect(userService.findOne).toHaveBeenCalledWith('1');
        });

        it('should propagate NotFoundException when user not found', async () => {
            userService.findOne.mockRejectedValue(new NotFoundException('User not found'));

            await expect(controller.findOne('99')).rejects.toThrow(NotFoundException);
            expect(userService.findOne).toHaveBeenCalledWith('99');
        });
    });

    describe('create', () => {
        it('should create and return a new user', async () => {
            const createUserDto: CreateUserDto = {
                username: 'newuser',
                email: 'new@example.com',
                password: 'password123',
                role: UserRole.USER,
            };

            const createdUser: User = {
                id: '3',
                username: 'newuser',
                email: 'new@example.com',
                password: 'hashedpassword',
                role: UserRole.USER,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                deviceTokens: [],
                timezone: 'UTC',
                notificationPrefs: {
                    email: true,
                    push: true,
                    frequency: 'immediate',
                },
            };

            userService.create.mockResolvedValue(createdUser);

            const result = await controller.create(createUserDto);

            expect(result).toBe(createdUser);
            expect(userService.create).toHaveBeenCalledWith(createUserDto);
        });
    });

    describe('update', () => {
        it('should update and return a user', async () => {
            const userId = '1';
            const updateUserDto: UpdateUserDto = {
                username: 'updateduser',
            };

            const updatedUser: User = {
                ...mockUser,
                username: 'updateduser',
            };

            userService.update.mockResolvedValue(updatedUser);

            const result = await controller.update(userId, updateUserDto);

            expect(result).toBe(updatedUser);
            expect(userService.update).toHaveBeenCalledWith(userId, updateUserDto);
        });

        it('should propagate NotFoundException when updating non-existent user', async () => {
            const updateUserDto: UpdateUserDto = {
                username: 'updateduser',
            };

            userService.update.mockRejectedValue(new NotFoundException('User not found'));

            await expect(controller.update('99', updateUserDto)).rejects.toThrow(NotFoundException);
            expect(userService.update).toHaveBeenCalledWith('99', updateUserDto);
        });
    });
});
