import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UserService } from '../../application/services/users/user.service';
import { CreateUserDto } from '../dto/user/create-user.dto';
import { UpdateUserDto } from '../dto/user/update-user.dto';
import { PaginationDto, SortDirection } from '../dto/common/pagination.dto';
import { UserRole } from '../../shared/constants/user-role.enum';
import { Logger, NotFoundException } from '@nestjs/common';
import { createMockUser } from '../../test/mocks/user.mock';
import { IPaginatedType } from '../../application/services/base/base.service';

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

    const mockUser = createMockUser();
    const mockAdminUser = createMockUser({
        id: '2',
        username: 'adminuser',
        email: 'admin@example.com',
        role: UserRole.ADMIN,
    });

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

    describe('findAll', () => {
        it('should return an array of users', async () => {
            const paginationDto: PaginationDto = {
                page: 1,
                limit: 10,
                sortBy: 'createdAt',
                sortDirection: SortDirection.DESC,
            };

            const result: IPaginatedType<typeof mockUser> = {
                items: [mockUser, mockAdminUser],
                total: 2,
                page: 1,
                totalPages: 1,
                hasNext: false,
                hasPrevious: false,
            };

            userService.findAll.mockResolvedValue(result);

            expect(await controller.findAll(paginationDto)).toBe(result);
            expect(userService.findAll).toHaveBeenCalledWith(paginationDto);
        });
    });

    describe('findOne', () => {
        it('should return a user by id', async () => {
            userService.findOne.mockResolvedValue(mockUser);
            expect(await controller.findOne(mockUser.id)).toBe(mockUser);
            expect(userService.findOne).toHaveBeenCalledWith(mockUser.id);
        });

        it('should throw NotFoundException when user not found', async () => {
            userService.findOne.mockRejectedValue(new NotFoundException());
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

            const createdUser = createMockUser({
                username: createUserDto.username,
                email: createUserDto.email,
            });

            userService.create.mockResolvedValue(createdUser);

            expect(await controller.create(createUserDto)).toBe(createdUser);
            expect(userService.create).toHaveBeenCalledWith(createUserDto);
        });
    });

    describe('update', () => {
        it('should update and return the user', async () => {
            const updateUserDto: UpdateUserDto = {
                username: 'updatedname',
            };

            const updatedUser = { ...mockUser, ...updateUserDto };
            userService.update.mockResolvedValue(updatedUser);

            expect(await controller.update(mockUser.id, updateUserDto)).toBe(updatedUser);
            expect(userService.update).toHaveBeenCalledWith(mockUser.id, updateUserDto);
        });
    });
});
