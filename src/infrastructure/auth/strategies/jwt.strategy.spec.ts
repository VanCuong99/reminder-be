import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.srategies';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../../../application/services/users/user.service';
import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from 'src/shared/constants/user-role.enum';

// Mock the passport-jwt Strategy and ExtractJwt
jest.mock('passport-jwt', () => {
    const mockFromAuthHeaderAsBearerToken = jest.fn().mockReturnValue(() => 'mock-token');
    return {
        Strategy: class MockStrategy {
            constructor(options: any) {
                this.options = options;
            }
            options: any;
        },
        ExtractJwt: {
            fromAuthHeaderAsBearerToken: mockFromAuthHeaderAsBearerToken,
        },
    };
});

// Mock the PassportStrategy decorator
jest.mock('@nestjs/passport', () => {
    return {
        PassportStrategy: jest.fn().mockImplementation(Strategy => {
            return Strategy;
        }),
    };
});

describe('JwtStrategy', () => {
    let strategy: JwtStrategy;
    let userService: UserService;

    const mockUser = {
        id: '1',
        email: 'test@example.com',
        role: UserRole.USER,
        isActive: true,
        username: 'testuser',
        password: 'hashedpassword',
        createdAt: new Date(),
        updatedAt: new Date(),
        deviceTokens: [],
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                JwtStrategy,
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn().mockReturnValue('test-secret'),
                    },
                },
                {
                    provide: UserService,
                    useValue: {
                        findOne: jest.fn(),
                    },
                },
            ],
        }).compile();

        strategy = module.get<JwtStrategy>(JwtStrategy);
        userService = module.get<UserService>(UserService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(strategy).toBeDefined();
    });

    describe('validate', () => {
        it('should return user when token is valid and user is active', async () => {
            const payload = {
                sub: '1',
                email: 'test@example.com',
                role: UserRole.USER,
            };

            jest.spyOn(userService, 'findOne').mockResolvedValue(mockUser);

            const result = await strategy.validate(payload);
            expect(result).toEqual(mockUser);
            expect(userService.findOne).toHaveBeenCalledWith('1');
        });

        it('should throw UnauthorizedException when user is not found', async () => {
            const payload = {
                sub: '1',
                email: 'test@example.com',
                role: UserRole.USER,
            };

            jest.spyOn(userService, 'findOne').mockResolvedValue(null);

            await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
            expect(userService.findOne).toHaveBeenCalledWith('1');
        });

        it('should throw UnauthorizedException when user is not active', async () => {
            const payload = {
                sub: '1',
                email: 'test@example.com',
                role: UserRole.USER,
            };

            const inactiveUser = {
                ...mockUser,
                isActive: false,
                deviceTokens: [],
            };
            jest.spyOn(userService, 'findOne').mockResolvedValue(inactiveUser);

            await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
            expect(userService.findOne).toHaveBeenCalledWith('1');
        });
    });
});
