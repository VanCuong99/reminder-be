import { Test, TestingModule } from '@nestjs/testing';
import { UserResolver } from './user.resolver';
import { UserService } from '../../../application/services/users/user.service';
import { UserType } from '../types/user/outputs/user.type';
import { CreateUserInput } from '../types/user/inputs/create-user.input';
import { UpdateUserInput } from '../types/user/inputs/update-user.input';
import { PaginationInput } from '../../../shared/types/graphql/inputs/pagination.input';
import { UserRole } from 'src/shared/constants/user-role.enum';
import { NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from 'src/infrastructure/auth/guards/jwt-auth.guard';

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
    });

    describe('users', () => {
        it('should have correct decorators and return paginated users', async () => {
            // Check decorators
            const resolverType = Reflect.getMetadata('graphql:resolver_type', resolver.users);
            expect(resolverType).toBe('Query');

            // Test functionality
            const pagination: PaginationInput = {
                page: 1,
                limit: 10,
                sortBy: 'createdAt',
                sortDirection: 'DESC',
            };

            const paginatedResult = {
                items: [
                    {
                        id: '1',
                        username: 'test1',
                        email: 'test1@example.com',
                        createdAt: new Date(),
                    },
                    {
                        id: '2',
                        username: 'test2',
                        email: 'test2@example.com',
                        createdAt: new Date(),
                    },
                ],
                total: 2,
                page: 1,
                totalPages: 1,
                hasNext: false,
                hasPrevious: false,
            };

            mockUserService.findAll.mockResolvedValue(paginatedResult);

            const result = await resolver.users(pagination);

            expect(result).toEqual(paginatedResult);
            expect(userService.findAll).toHaveBeenCalledWith(pagination);
        });

        it('should handle empty pagination input', async () => {
            const paginatedResult = {
                items: [],
                total: 0,
                page: 1,
                totalPages: 0,
                hasNext: false,
                hasPrevious: false,
            };

            mockUserService.findAll.mockResolvedValue(paginatedResult);

            const result = await resolver.users();

            expect(result).toEqual(paginatedResult);
            expect(userService.findAll).toHaveBeenCalledWith(undefined);
        });
    });

    describe('user', () => {
        it('should have correct decorators and return a single user', async () => {
            // Check decorators
            const resolverType = Reflect.getMetadata('graphql:resolver_type', resolver.user);
            expect(resolverType).toBe('Query');

            // Test functionality
            const userId = '1';
            const user = {
                id: userId,
                username: 'test',
                email: 'test@example.com',
                createdAt: new Date(),
            };

            mockUserService.findOne.mockResolvedValue(user);

            const result = await resolver.user(userId);

            expect(result).toEqual(user);
            expect(userService.findOne).toHaveBeenCalledWith(userId);
        });

        it('should handle service throwing NotFoundException', async () => {
            const userId = 'non-existent';
            mockUserService.findOne.mockRejectedValue(
                new NotFoundException(`User with ID "${userId}" not found`),
            );

            await expect(resolver.user(userId)).rejects.toThrow(NotFoundException);
            expect(userService.findOne).toHaveBeenCalledWith(userId);
        });
    });

    describe('createUser', () => {
        it('should have correct decorators and create a new user', async () => {
            // Check decorators
            const resolverType = Reflect.getMetadata('graphql:resolver_type', resolver.createUser);
            expect(resolverType).toBe('Mutation');

            // Test functionality
            const createUserInput: CreateUserInput = {
                username: 'newuser',
                email: 'newuser@example.com',
                password: 'password123',
                role: UserRole.USER,
            };

            const createdUser = {
                id: '1',
                username: createUserInput.username,
                email: createUserInput.email,
                createdAt: new Date(),
            };

            mockUserService.create.mockResolvedValue(createdUser);

            const result = await resolver.createUser(createUserInput);

            expect(result).toEqual(createdUser);
            expect(userService.create).toHaveBeenCalledWith(createUserInput);
        });

        it('should handle validation errors in create', async () => {
            const invalidInput: CreateUserInput = {
                username: '', // invalid username
                email: 'invalid-email', // invalid email
                password: '123', // invalid password
                role: UserRole.USER,
            };

            mockUserService.create.mockRejectedValue(new Error('Validation failed'));

            await expect(resolver.createUser(invalidInput)).rejects.toThrow('Validation failed');
            expect(userService.create).toHaveBeenCalledWith(invalidInput);
        });

        it('should handle service errors in create', async () => {
            const createUserInput: CreateUserInput = {
                username: 'newuser',
                email: 'newuser@example.com',
                password: 'password123',
                role: UserRole.USER,
            };

            mockUserService.create.mockRejectedValue(new Error('Database error'));

            await expect(resolver.createUser(createUserInput)).rejects.toThrow('Database error');
            expect(userService.create).toHaveBeenCalledWith(createUserInput);
        });
    });

    describe('updateUser', () => {
        it('should have correct decorators and update a user', async () => {
            // Check decorators
            const resolverType = Reflect.getMetadata('graphql:resolver_type', resolver.updateUser);
            expect(resolverType).toBe('Mutation');

            // Test functionality
            const userId = '1';
            const updateUserInput: UpdateUserInput = {
                username: 'updateduser',
                email: 'updated@example.com',
            };

            const updatedUser = {
                id: userId,
                ...updateUserInput,
                createdAt: new Date(),
            };

            mockUserService.update.mockResolvedValue(updatedUser);

            const result = await resolver.updateUser(userId, updateUserInput);

            expect(result).toEqual(updatedUser);
            expect(userService.update).toHaveBeenCalledWith(userId, updateUserInput);
        });

        it('should handle partial updates', async () => {
            const userId = '1';
            const existingUser = {
                id: userId,
                username: 'existinguser',
                email: 'existing@example.com',
                createdAt: new Date(),
            };

            const updateUserInput: UpdateUserInput = {
                username: 'updateduser',
            };

            const updatedUser = {
                ...existingUser,
                username: updateUserInput.username,
            };

            mockUserService.update.mockResolvedValue(updatedUser);

            const result = await resolver.updateUser(userId, updateUserInput);

            expect(result).toEqual(updatedUser);
            expect(userService.update).toHaveBeenCalledWith(userId, updateUserInput);
        });

        it('should handle password updates', async () => {
            const userId = '1';
            const existingUser = {
                id: userId,
                username: 'existinguser',
                email: 'existing@example.com',
                createdAt: new Date(),
            };

            const updateUserInput: UpdateUserInput = {
                password: 'newpassword123',
            };

            const updatedUser = {
                ...existingUser,
            };

            mockUserService.update.mockResolvedValue(updatedUser);

            const result = await resolver.updateUser(userId, updateUserInput);

            expect(result).toEqual(updatedUser);
            expect(userService.update).toHaveBeenCalledWith(userId, updateUserInput);
        });

        it('should handle user not found error', async () => {
            const nonExistentId = 'non-existent';
            const updateUserInput: UpdateUserInput = {
                username: 'updateduser',
            };

            mockUserService.update.mockRejectedValue(
                new NotFoundException(`User with ID "${nonExistentId}" not found`),
            );

            await expect(resolver.updateUser(nonExistentId, updateUserInput)).rejects.toThrow(
                NotFoundException,
            );
            expect(userService.update).toHaveBeenCalledWith(nonExistentId, updateUserInput);
        });

        it('should handle validation errors in update', async () => {
            const userId = '1';
            const invalidInput: UpdateUserInput = {
                email: 'invalid-email', // invalid email format
            };

            mockUserService.update.mockRejectedValue(new Error('Validation failed'));

            await expect(resolver.updateUser(userId, invalidInput)).rejects.toThrow(
                'Validation failed',
            );
            expect(userService.update).toHaveBeenCalledWith(userId, invalidInput);
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
