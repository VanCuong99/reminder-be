import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, Logger } from '@nestjs/common';
import { LocalStrategy } from './local.strategy';
import { AuthService } from '../../../application/services/auth/auth.service';
import { UserRole } from '../../../shared/constants/user-role.enum';

describe('LocalStrategy', () => {
    let strategy: LocalStrategy;
    let authService: AuthService;
    const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        username: 'testuser',
        role: UserRole.USER,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        timezone: 'UTC',
        notificationPrefs: {
            email: true,
            push: true,
            frequency: 'immediate' as const,
        },
        deviceTokens: [],
    };

    // Spy on Logger to prevent console output in tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                LocalStrategy,
                {
                    provide: AuthService,
                    useValue: {
                        validateUser: jest.fn(),
                    },
                },
            ],
        }).compile();

        strategy = module.get<LocalStrategy>(LocalStrategy);
        authService = module.get<AuthService>(AuthService);
    });

    it('should be defined', () => {
        expect(strategy).toBeDefined();
    });

    describe('validate', () => {
        it('should return a user when credentials are valid', async () => {
            // Setup mock
            jest.spyOn(authService, 'validateUser').mockResolvedValue(mockUser);

            const result = await strategy.validate('test@example.com', 'password123');

            expect(authService.validateUser).toHaveBeenCalledWith(
                'test@example.com',
                'password123',
            );
            expect(result).toEqual(mockUser);
        });

        it('should throw UnauthorizedException when credentials are invalid', async () => {
            // Setup mock to return null (invalid credentials)
            jest.spyOn(authService, 'validateUser').mockResolvedValue(null);

            await expect(strategy.validate('test@example.com', 'wrong-password')).rejects.toThrow(
                UnauthorizedException,
            );

            expect(authService.validateUser).toHaveBeenCalledWith(
                'test@example.com',
                'wrong-password',
            );
        });

        it('should throw UnauthorizedException when email is missing', async () => {
            await expect(strategy.validate('', 'password123')).rejects.toThrow(
                UnauthorizedException,
            );

            // AuthService should not be called when credentials are missing
            expect(authService.validateUser).not.toHaveBeenCalled();
        });

        it('should throw UnauthorizedException when password is missing', async () => {
            await expect(strategy.validate('test@example.com', '')).rejects.toThrow(
                UnauthorizedException,
            );

            // AuthService should not be called when credentials are missing
            expect(authService.validateUser).not.toHaveBeenCalled();
        });

        it('should propagate errors from AuthService', async () => {
            // Setup mock to throw an error
            const testError = new Error('Database connection error');
            jest.spyOn(authService, 'validateUser').mockRejectedValue(testError);

            await expect(strategy.validate('test@example.com', 'password123')).rejects.toThrow(
                testError,
            );
        });
    });
});
