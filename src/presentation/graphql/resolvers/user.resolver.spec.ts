import { Test, TestingModule } from '@nestjs/testing';
import { UserResolver } from './user.resolver';
import { UserService } from '../../../application/services/user.service';
import { CreateUserInput } from '../types/user/inputs/create-user.input';
import { UpdateUserInput } from '../types/user/inputs/update-user.input';
import { PaginationInput } from '../../../shared/types/graphql/inputs/pagination.input';
import { NotFoundException } from '@nestjs/common';

describe('UserResolver', () => {
    let resolver: UserResolver;
    let userService: UserService;

    const mockUserService = {
        findAll: jest.fn(),
        findOne: jest.fn(),
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
            ],
        }).compile();

        resolver = module.get<UserResolver>(UserResolver);
        userService = module.get<UserService>(UserService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(resolver).toBeDefined();
    });

    describe('users', () => {
        it('should return paginated users', async () => {
            const pagination: PaginationInput = {
                page: 1,
                limit: 10,
                sortBy: 'createdAt',
                sortDirection: 'DESC',
            };

            const paginatedResult = {
                items: [
                    { id: '1', username: 'test1', email: 'test1@example.com', createdAt: new Date() },
                    { id: '2', username: 'test2', email: 'test2@example.com', createdAt: new Date() },
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
        it('should return a single user', async () => {
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
        it('should create and return a new user', async () => {
            const createUserInput: CreateUserInput = {
                username: 'newuser',
                email: 'newuser@example.com',
                password: 'password123',
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
                username: '',  // invalid username
                email: 'invalid-email',  // invalid email
                password: '123', // invalid password
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
            };

            mockUserService.create.mockRejectedValue(new Error('Database error'));

            await expect(resolver.createUser(createUserInput)).rejects.toThrow('Database error');
            expect(userService.create).toHaveBeenCalledWith(createUserInput);
        });
    });

    describe('updateUser', () => {
        const userId = '1';
        const existingUser = {
            id: userId,
            username: 'existinguser',
            email: 'existing@example.com',
            createdAt: new Date(),
        };

        it('should update and return the user', async () => {
            const updateUserInput: UpdateUserInput = {
                username: 'updateduser',
                email: 'updated@example.com',
            };

            const updatedUser = {
                ...existingUser,
                ...updateUserInput,
            };

            mockUserService.update.mockResolvedValue(updatedUser);

            const result = await resolver.updateUser(userId, updateUserInput);

            expect(result).toEqual(updatedUser);
            expect(userService.update).toHaveBeenCalledWith(userId, updateUserInput);
        });

        it('should handle partial updates', async () => {
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

            await expect(resolver.updateUser(nonExistentId, updateUserInput))
                .rejects
                .toThrow(NotFoundException);
            expect(userService.update).toHaveBeenCalledWith(nonExistentId, updateUserInput);
        });

        it('should handle validation errors in update', async () => {
            const invalidInput: UpdateUserInput = {
                email: 'invalid-email',  // invalid email format
            };

            mockUserService.update.mockRejectedValue(new Error('Validation failed'));

            await expect(resolver.updateUser(userId, invalidInput))
                .rejects
                .toThrow('Validation failed');
            expect(userService.update).toHaveBeenCalledWith(userId, invalidInput);
        });
    });
}); 
