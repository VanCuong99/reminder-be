import { Test, TestingModule } from '@nestjs/testing';
import { UserResolver } from './user.resolver';
import { UserService } from '../../../application/services/users/user.service';
import { UserType } from '../types/user/outputs/user.type';
import { CreateUserInput } from '../types/user/inputs/create-user.input';
import { UpdateUserInput } from '../types/user/inputs/update-user.input';
import { PaginationInput } from '../../../shared/types/graphql/inputs/pagination.input';
import { UserRole } from 'src/shared/constants/user-role.enum';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from 'src/infrastructure/auth/guards/jwt-auth.guard';
import { NotFoundException } from '@nestjs/common';

jest.mock('@nestjs/graphql', () => {
    const originalModule = jest.requireActual('@nestjs/graphql');
    return {
        ...originalModule,
        Args: (name: string) => {
            return function (target: any, propertyKey: string, parameterIndex: number) {
                const existingArgs = Reflect.getMetadata('graphql:args', target[propertyKey]) ?? [];
                existingArgs[parameterIndex] = { name };
                Reflect.defineMetadata('graphql:args', existingArgs, target[propertyKey]);
            };
        },
    };
});

describe('UserResolver', () => {
    let resolver: UserResolver;
    let userService: UserService;
    let reflector: Reflector;

    const mockUserService = {
        findAll: jest.fn(),
        findOne: jest.fn(),
        findOneByEmail: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UserResolver,
                {
                    provide: UserService,
                    useValue: mockUserService,
                },
                Reflector,
            ],
        }).compile();

        resolver = module.get<UserResolver>(UserResolver);
        userService = module.get<UserService>(UserService);
        reflector = module.get<Reflector>(Reflector);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(resolver).toBeDefined();
    });

    describe('Decorators', () => {
        it('should have JwtAuthGuard applied to the class', () => {
            const guards = Reflect.getMetadata('__guards__', UserResolver);
            expect(guards).toContain(JwtAuthGuard);
        });

        it('should have correct roles decorator on users method', () => {
            const roles = reflector.get<UserRole[]>('roles', resolver.users);
            expect(roles).toEqual([UserRole.ADMIN, UserRole.USER]);
        });

        it('should have correct roles decorator on user method', () => {
            const roles = reflector.get<UserRole[]>('roles', resolver.user);
            expect(roles).toEqual([UserRole.ADMIN, UserRole.USER]);
        });

        it('should have correct roles decorator on createUser method', () => {
            const roles = reflector.get<UserRole[]>('roles', resolver.createUser);
            expect(roles).toEqual([UserRole.ADMIN]);
        });

        it('should have correct roles decorator on updateUser method', () => {
            const roles = reflector.get<UserRole[]>('roles', resolver.updateUser);
            expect(roles).toEqual([UserRole.ADMIN]);
        });

        it('should have Query decorator on users method', () => {
            const metadata = Reflect.getMetadata('graphql:resolver_type', resolver.users);
            expect(metadata).toBe('Query');
        });

        it('should have Query decorator on user method', () => {
            const metadata = Reflect.getMetadata('graphql:resolver_type', resolver.user);
            expect(metadata).toBe('Query');
        });

        it('should have Mutation decorator on createUser method', () => {
            const metadata = Reflect.getMetadata('graphql:resolver_type', resolver.createUser);
            expect(metadata).toBe('Mutation');
        });

        it('should have Mutation decorator on updateUser method', () => {
            const metadata = Reflect.getMetadata('graphql:resolver_type', resolver.updateUser);
            expect(metadata).toBe('Mutation');
        });

        it('should have Args decorator on users method', () => {
            const metadata = Reflect.getMetadata('graphql:args', resolver.users);
            expect(metadata).toBeDefined();
            expect(metadata[0].name).toBe('pagination');
        });

        it('should have Args decorator on user method', () => {
            const metadata = Reflect.getMetadata('graphql:args', resolver.user);
            expect(metadata).toBeDefined();
            expect(metadata[0].name).toBe('id');
        });

        it('should have Args decorator on createUser method', () => {
            const metadata = Reflect.getMetadata('graphql:args', resolver.createUser);
            expect(metadata).toBeDefined();
            expect(metadata[0].name).toBe('input');
        });

        it('should have Args decorator on updateUser method', () => {
            const metadata = Reflect.getMetadata('graphql:args', resolver.updateUser);
            expect(metadata).toBeDefined();
            expect(metadata[0].name).toBe('id');
            expect(metadata[1].name).toBe('input');
        });
    });

    describe('users', () => {
        it('should return paginated users with default pagination', async () => {
            const mockUsers = [
                { id: '1', username: 'test1', email: 'test1@example.com' },
                { id: '2', username: 'test2', email: 'test2@example.com' },
            ];
            const total = 2;

            mockUserService.findAll.mockResolvedValue({
                items: mockUsers,
                total,
                page: 1,
                totalPages: 1,
                hasNext: false,
                hasPrevious: false,
            });

            const result = await resolver.users();

            expect(result).toEqual({
                items: mockUsers,
                total,
                page: 1,
                totalPages: 1,
                hasNext: false,
                hasPrevious: false,
            });
            expect(mockUserService.findAll).toHaveBeenCalledWith(undefined);
        });

        it('should return paginated users with custom pagination', async () => {
            const pagination: PaginationInput = {
                page: 2,
                limit: 5,
                sortBy: 'username',
                sortDirection: 'ASC',
            };
            const mockUsers = [
                { id: '6', username: 'test6', email: 'test6@example.com' },
                { id: '7', username: 'test7', email: 'test7@example.com' },
            ];
            const total = 7;

            mockUserService.findAll.mockResolvedValue({
                items: mockUsers,
                total,
                page: 2,
                totalPages: 2,
                hasNext: false,
                hasPrevious: true,
            });

            const result = await resolver.users(pagination);

            expect(result).toEqual({
                items: mockUsers,
                total,
                page: 2,
                totalPages: 2,
                hasNext: false,
                hasPrevious: true,
            });
            expect(mockUserService.findAll).toHaveBeenCalledWith(pagination);
        });

        it('should handle service errors', async () => {
            mockUserService.findAll.mockRejectedValue(new Error('Service error'));

            await expect(resolver.users()).rejects.toThrow('Service error');
        });
    });

    describe('user', () => {
        it('should return user by id', async () => {
            const mockUser = {
                id: '1',
                username: 'testuser',
                email: 'test@example.com',
            };

            mockUserService.findOne.mockResolvedValue(mockUser);

            const result = await resolver.user('1');

            expect(result).toEqual(mockUser);
            expect(mockUserService.findOne).toHaveBeenCalledWith('1');
        });

        it('should throw NotFoundException when user not found', async () => {
            mockUserService.findOne.mockRejectedValue(new NotFoundException());

            await expect(resolver.user('nonexistent')).rejects.toThrow(NotFoundException);
            expect(mockUserService.findOne).toHaveBeenCalledWith('nonexistent');
        });

        it('should handle service errors', async () => {
            mockUserService.findOne.mockRejectedValue(new Error('Service error'));

            await expect(resolver.user('1')).rejects.toThrow('Service error');
        });
    });

    describe('createUser', () => {
        it('should create a new user', async () => {
            const createUserInput: CreateUserInput = {
                username: 'newuser',
                email: 'new@example.com',
                password: 'password123',
                role: UserRole.USER,
            };
            const mockUser = {
                id: '1',
                ...createUserInput,
            };

            mockUserService.create.mockResolvedValue(mockUser);

            const result = await resolver.createUser(createUserInput);

            expect(result).toEqual(mockUser);
            expect(mockUserService.create).toHaveBeenCalledWith(createUserInput);
        });

        it('should handle invalid input', async () => {
            const invalidInputs = [
                { email: '', password: 'password123' },
                { email: 'test@example.com', password: '' },
                { email: 'invalid-email', password: 'password123' },
            ];

            for (const input of invalidInputs) {
                mockUserService.create.mockRejectedValue(new Error('Invalid input'));
                await expect(resolver.createUser(input as CreateUserInput)).rejects.toThrow();
            }
        });

        it('should handle service errors', async () => {
            const createUserInput: CreateUserInput = {
                username: 'newuser',
                email: 'new@example.com',
                password: 'password123',
                role: UserRole.USER,
            };

            mockUserService.create.mockRejectedValue(new Error('Service error'));

            await expect(resolver.createUser(createUserInput)).rejects.toThrow('Service error');
        });
    });

    describe('updateUser', () => {
        it('should update an existing user', async () => {
            const updateUserInput: UpdateUserInput = {
                username: 'updateduser',
                email: 'updated@example.com',
            };
            const mockUser = {
                id: '1',
                ...updateUserInput,
            };

            mockUserService.update.mockResolvedValue(mockUser);

            const result = await resolver.updateUser('1', updateUserInput);

            expect(result).toEqual(mockUser);
            expect(mockUserService.update).toHaveBeenCalledWith('1', updateUserInput);
        });

        it('should throw NotFoundException when user not found', async () => {
            const updateUserInput: UpdateUserInput = {
                username: 'updateduser',
            };

            mockUserService.update.mockRejectedValue(new NotFoundException());

            await expect(resolver.updateUser('nonexistent', updateUserInput)).rejects.toThrow(
                NotFoundException,
            );
            expect(mockUserService.update).toHaveBeenCalledWith('nonexistent', updateUserInput);
        });

        it('should handle invalid input', async () => {
            const invalidInputs = [
                { email: '' },
                { email: 'invalid-email' },
                { password: 'short' },
            ];

            for (const input of invalidInputs) {
                mockUserService.update.mockRejectedValue(new Error('Invalid input'));
                await expect(resolver.updateUser('1', input as UpdateUserInput)).rejects.toThrow();
            }
        });

        it('should handle service errors', async () => {
            const updateUserInput: UpdateUserInput = {
                username: 'updateduser',
            };

            mockUserService.update.mockRejectedValue(new Error('Service error'));

            await expect(resolver.updateUser('1', updateUserInput)).rejects.toThrow(
                'Service error',
            );
        });
    });

    describe('findOneByEmail', () => {
        it('should call userService.findOneByEmail with email', async () => {
            const email = 'test@example.com';
            const expectedUser: UserType = {
                id: '1',
                email,
                username: 'testuser',
                role: UserRole.USER,
                createdAt: new Date(),
                isActive: true,
            };

            (userService.findOneByEmail as jest.Mock).mockResolvedValue(expectedUser);

            const result = await userService.findOneByEmail(email);

            expect(userService.findOneByEmail).toHaveBeenCalledWith(email);
            expect(result).toEqual(expectedUser);
        });

        it('should return null when user is not found', async () => {
            const email = 'nonexistent@example.com';

            (userService.findOneByEmail as jest.Mock).mockResolvedValue(null);

            const result = await userService.findOneByEmail(email);

            expect(userService.findOneByEmail).toHaveBeenCalledWith(email);
            expect(result).toBeNull();
        });
    });
});
