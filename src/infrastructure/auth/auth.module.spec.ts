import { Test, TestingModule } from '@nestjs/testing';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from 'src/application/services/auth/auth.service';
import { AuthResolver } from 'src/presentation/graphql/resolvers/auth.resolver';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from 'src/domain/entities/user.entity';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './strategies/jwt.srategies';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { UserService } from 'src/application/services/users/user.service';
import { UserRole } from 'src/shared/constants/user-role.enum';

describe('AuthModule', () => {
    let module: TestingModule;
    let authService: AuthService;
    let authResolver: AuthResolver;
    let jwtStrategy: JwtStrategy;
    let jwtService: JwtService;

    // Mock repositories and services
    const mockUserRepository = {
        findOne: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
        findOneBy: jest.fn(),
    };

    // Mock ConfigService
    const mockConfigService = {
        get: jest.fn().mockImplementation((key: string) => {
            if (key === 'JWT_SECRET') return 'test-jwt-secret';
            if (key === 'JWT_EXPIRATION') return '1h';
            return null;
        }),
    };

    // Mock UserService
    const mockUserService = {
        findOneByEmail: jest.fn(),
        findOne: jest.fn(),
        create: jest.fn(),
    };

    beforeEach(async () => {
        module = await Test.createTestingModule({
            imports: [PassportModule.register({ defaultStrategy: 'jwt' }), ConfigModule],
            providers: [
                AuthService,
                AuthResolver,
                JwtService,
                JwtStrategy,
                {
                    provide: getRepositoryToken(User),
                    useValue: mockUserRepository,
                },
                {
                    provide: UserService,
                    useValue: mockUserService,
                },
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
            ],
        }).compile();

        authService = module.get<AuthService>(AuthService);
        authResolver = module.get<AuthResolver>(AuthResolver);
        jwtService = module.get<JwtService>(JwtService);
        jwtStrategy = module.get<JwtStrategy>(JwtStrategy);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Module initialization', () => {
        it('should compile the AuthModule', () => {
            expect(module).toBeDefined();
        });

        it('should have AuthService provider', () => {
            expect(authService).toBeDefined();
        });

        it('should have AuthResolver provider', () => {
            expect(authResolver).toBeDefined();
        });

        it('should have JwtStrategy provider', () => {
            expect(jwtStrategy).toBeDefined();
        });

        it('should have JwtService provider', () => {
            expect(jwtService).toBeDefined();
        });
    });

    describe('AuthService', () => {
        it('should validate user with correct credentials', async () => {
            const mockUser = {
                id: '1',
                email: 'test@example.com',
                password: 'hashedPassword',
                role: UserRole.USER,
                isActive: true,
            };
            mockUserService.findOneByEmail.mockResolvedValue(mockUser);
            jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
            jest.spyOn(jwtService, 'sign').mockReturnValue('mocked-jwt-token');

            const result = await authService.login({
                email: 'test@example.com',
                password: 'password',
            });

            expect(mockUserService.findOneByEmail).toHaveBeenCalledWith('test@example.com');
            expect(jwtService.sign).toHaveBeenCalled();
            expect(result).toEqual({
                access_token: 'mocked-jwt-token',
                user: expect.objectContaining({
                    id: '1',
                    email: 'test@example.com',
                }),
            });
        });

        it('should throw error with incorrect credentials', async () => {
            const mockUser = {
                id: '1',
                email: 'test@example.com',
                password: 'hashedPassword',
                role: UserRole.USER,
                isActive: true,
            };
            mockUserService.findOneByEmail.mockResolvedValue(mockUser);
            jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false));

            await expect(
                authService.login({
                    email: 'test@example.com',
                    password: 'wrong-password',
                }),
            ).rejects.toThrow(UnauthorizedException);
        });

        it('should throw error when user not found', async () => {
            mockUserService.findOneByEmail.mockResolvedValue(null);

            await expect(
                authService.login({
                    email: 'nonexistent@example.com',
                    password: 'password',
                }),
            ).rejects.toThrow(UnauthorizedException);
        });
    });

    describe('JwtStrategy', () => {
        it('should validate JWT payload and return user', async () => {
            const mockActiveUser = {
                id: '1',
                email: 'test@example.com',
                role: UserRole.USER,
                isActive: true,
            };
            const payload = { sub: '1', email: 'test@example.com' };
            mockUserService.findOne.mockResolvedValue(mockActiveUser);

            const validateResult = await jwtStrategy.validate(payload);

            expect(validateResult).toEqual(mockActiveUser);
            expect(mockUserService.findOne).toHaveBeenCalledWith('1');
        });

        it('should throw UnauthorizedException when user is inactive', async () => {
            const mockInactiveUser = {
                id: '1',
                email: 'test@example.com',
                role: UserRole.USER,
                isActive: false,
            };
            const payload = { sub: '1', email: 'test@example.com' };
            mockUserService.findOne.mockResolvedValue(mockInactiveUser);

            await expect(jwtStrategy.validate(payload)).rejects.toThrow(UnauthorizedException);
            expect(mockUserService.findOne).toHaveBeenCalledWith('1');
        });
    });

    describe('AuthResolver', () => {
        it('should call AuthService login method', async () => {
            const loginDto = { email: 'test@example.com', password: 'password' };
            const authResult = {
                access_token: 'mocked-jwt-token',
                user: {
                    id: '1',
                    email: 'test@example.com',
                    role: UserRole.USER,
                    isActive: true,
                },
            };
            jest.spyOn(authService, 'login').mockResolvedValue(authResult);

            const result = await authResolver.login(loginDto);

            expect(authService.login).toHaveBeenCalledWith(loginDto);
            expect(result).toEqual(authResult);
        });
    });
});
