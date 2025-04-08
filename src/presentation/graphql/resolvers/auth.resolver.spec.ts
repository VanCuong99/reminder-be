import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthResolver } from './auth.resolver';
import { AuthService } from 'src/application/services/auth/auth.service';
import { LoginInput } from '../types/auth/inputs/login.input';
import { AuthResponse } from '../types/auth/outputs/auth.response';
import { UserRole } from 'src/shared/constants/user-role.enum';
import { UnauthorizedException } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';

jest.mock('@nestjs/graphql', () => {
    const originalModule = jest.requireActual('@nestjs/graphql');
    return {
        ...originalModule,
        Mutation: () => {
            return function (target: any, propertyKey: string) {
                Reflect.defineMetadata('graphql:resolver_type', 'Mutation', target[propertyKey]);
            };
        },
        Args: (name: string) => {
            return function (target: any, propertyKey: string, parameterIndex: number) {
                const existingArgs = Reflect.getMetadata('graphql:args', target[propertyKey]) || [];
                existingArgs[parameterIndex] = { name };
                Reflect.defineMetadata('graphql:args', existingArgs, target[propertyKey]);
            };
        },
    };
});

describe('AuthResolver', () => {
    let resolver: AuthResolver;
    let authService: AuthService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            imports: [
                GraphQLModule.forRoot<ApolloDriverConfig>({
                    driver: ApolloDriver,
                    autoSchemaFile: true,
                }),
            ],
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

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(resolver).toBeDefined();
    });

    describe('Decorators', () => {
        it('should have Mutation decorator with AuthResponse return type', async () => {
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

            const metadata = Reflect.getMetadata('graphql:resolver_type', resolver.login);
            expect(metadata).toBe('Mutation');

            expect(authService.login).toHaveBeenCalledWith(loginInput);
            expect(result).toEqual(expectedResponse);
        });

        it('should have Args decorator on login method', () => {
            const metadata = Reflect.getMetadata('graphql:args', resolver.login);
            expect(metadata).toBeDefined();
            expect(metadata[0].name).toBe('input');
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

        it('should throw UnauthorizedException when authService.login throws', async () => {
            const loginInput: LoginInput = {
                email: 'test@example.com',
                password: 'wrongpassword',
            };

            (authService.login as jest.Mock).mockRejectedValue(new UnauthorizedException());

            await expect(resolver.login(loginInput)).rejects.toThrow(UnauthorizedException);
            expect(authService.login).toHaveBeenCalledWith(loginInput);
        });

        it('should handle empty or invalid input', async () => {
            const invalidInputs = [
                { email: '', password: 'password123' },
                { email: 'test@example.com', password: '' },
                { email: 'invalid-email', password: 'password123' },
                { email: 'test@example.com', password: 'short' },
            ];

            for (const input of invalidInputs) {
                (authService.login as jest.Mock).mockRejectedValue(new UnauthorizedException());
                await expect(resolver.login(input as LoginInput)).rejects.toThrow(
                    UnauthorizedException,
                );
            }
        });
    });
});
