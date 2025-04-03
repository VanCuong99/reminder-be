import { Test, TestingModule } from '@nestjs/testing';
import { AuthResolver } from './auth.resolver';
import { AuthService } from 'src/application/services/auth/auth.service';
import { LoginInput } from '../types/auth/inputs/login.input';
import { AuthResponse } from '../types/auth/outputs/auth.response';
import { UserRole } from 'src/shared/constants/user-role.enum';

describe('AuthResolver', () => {
    let resolver: AuthResolver;
    let authService: AuthService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthResolver,
                {
                    provide: AuthService,
                    useValue: {
                        login: jest.fn(),
                    },
                },
            ],
        }).compile();

        resolver = module.get<AuthResolver>(AuthResolver);
        authService = module.get<AuthService>(AuthService);
    });

    it('should be defined', () => {
        expect(resolver).toBeDefined();
    });

    describe('Decorators', () => {
        it('should have Mutation decorator with AuthResponse return type', async () => {
            // Test both the decorator and the actual execution
            const loginInput: LoginInput = {
                email: 'test@example.com',
                password: 'password123',
            };
            const expectedResponse: AuthResponse = {
                access_token: 'mock-token',
                user: {
                    id: '1',
                    email: 'test@example.com',
                    username: 'testuser',
                    role: UserRole.USER,
                    createdAt: new Date(),
                    isActive: true,
                },
            };

            (authService.login as jest.Mock).mockResolvedValue(expectedResponse);

            const result = await resolver.login(loginInput);

            // Verify the decorator
            const metadata = Reflect.getMetadata('graphql:resolver_type', resolver.login);
            expect(metadata).toBe('Mutation');

            // Verify the execution
            expect(authService.login).toHaveBeenCalledWith(loginInput);
            expect(result).toEqual(expectedResponse);
        });
    });

    describe('login', () => {
        it('should call authService.login with correct input', async () => {
            const loginInput: LoginInput = {
                email: 'test@example.com',
                password: 'password123',
            };
            const expectedResponse: AuthResponse = {
                access_token: 'mock-token',
                user: {
                    id: '1',
                    email: 'test@example.com',
                    username: 'testuser',
                    role: UserRole.USER,
                    createdAt: new Date(),
                    isActive: true,
                },
            };

            (authService.login as jest.Mock).mockResolvedValue(expectedResponse);

            const result = await resolver.login(loginInput);

            expect(authService.login).toHaveBeenCalledWith(loginInput);
            expect(result).toEqual(expectedResponse);
        });
    });
});
