import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { RolesGuard } from './roles.guard';
import { UserRole } from 'src/shared/constants/user-role.enum';

describe('RolesGuard', () => {
    let guard: RolesGuard;
    let reflector: jest.Mocked<Reflector>;
    let mockContext: jest.Mocked<ExecutionContext>;
    let mockGqlContext: any;

    beforeEach(() => {
        reflector = {
            getAllAndOverride: jest.fn(),
        } as unknown as jest.Mocked<Reflector>;

        guard = new RolesGuard(reflector);

        mockContext = {
            getHandler: jest.fn(),
            getClass: jest.fn(),
            getType: jest.fn(() => 'graphql'),
            getArgs: jest.fn(),
            getArgByIndex: jest.fn(),
            switchToHttp: jest.fn(),
            switchToRpc: jest.fn(),
            switchToWs: jest.fn(),
        } as unknown as jest.Mocked<ExecutionContext>;

        mockGqlContext = {
            getContext: jest.fn().mockReturnValue({
                req: {
                    user: {
                        role: UserRole.USER,
                    },
                },
            }),
        };

        jest.spyOn(GqlExecutionContext, 'create').mockReturnValue(mockGqlContext);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should allow access when no roles are required', () => {
        reflector.getAllAndOverride.mockReturnValue(null);

        const result = guard.canActivate(mockContext);

        expect(result).toBe(true);
        expect(reflector.getAllAndOverride).toHaveBeenCalledWith('roles', [
            mockContext.getHandler(),
            mockContext.getClass(),
        ]);
    });

    it('should deny access for non-GraphQL contexts', () => {
        mockContext.getType.mockReturnValue('http');
        reflector.getAllAndOverride.mockReturnValue([UserRole.USER]);

        const result = guard.canActivate(mockContext);

        expect(result).toBe(false);
    });

    it('should allow access when user has required role', () => {
        reflector.getAllAndOverride.mockReturnValue([UserRole.USER]);
        mockGqlContext.getContext.mockReturnValue({
            req: {
                user: {
                    role: UserRole.USER,
                },
            },
        });

        const result = guard.canActivate(mockContext);

        expect(result).toBe(true);
    });

    it('should deny access when user lacks required role', () => {
        reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
        mockGqlContext.getContext.mockReturnValue({
            req: {
                user: {
                    role: UserRole.USER,
                },
            },
        });

        const result = guard.canActivate(mockContext);

        expect(result).toBe(false);
    });

    it('should deny access when user is not present', () => {
        reflector.getAllAndOverride.mockReturnValue([UserRole.USER]);
        mockGqlContext.getContext.mockReturnValue({
            req: {},
        });

        const result = guard.canActivate(mockContext);

        expect(result).toBe(false);
    });

    it('should deny access when request is not present', () => {
        reflector.getAllAndOverride.mockReturnValue([UserRole.USER]);
        mockGqlContext.getContext.mockReturnValue({});

        const result = guard.canActivate(mockContext);

        expect(result).toBe(false);
    });

    it('should deny access when context is invalid', () => {
        reflector.getAllAndOverride.mockReturnValue([UserRole.USER]);
        mockGqlContext.getContext.mockReturnValue(null);

        const result = guard.canActivate(mockContext);

        expect(result).toBe(false);
    });

    it('should handle multiple required roles', () => {
        reflector.getAllAndOverride.mockReturnValue([UserRole.USER, UserRole.ADMIN]);

        // Test with USER role
        mockGqlContext.getContext.mockReturnValue({
            req: {
                user: {
                    role: UserRole.USER,
                },
            },
        });
        expect(guard.canActivate(mockContext)).toBe(true);

        // Test with ADMIN role
        mockGqlContext.getContext.mockReturnValue({
            req: {
                user: {
                    role: UserRole.ADMIN,
                },
            },
        });
        expect(guard.canActivate(mockContext)).toBe(true);

        // Test with non-matching role
        mockGqlContext.getContext.mockReturnValue({
            req: {
                user: {
                    role: 'OTHER',
                },
            },
        });
        expect(guard.canActivate(mockContext)).toBe(false);
    });

    it('should handle errors gracefully', () => {
        reflector.getAllAndOverride.mockImplementation(() => {
            throw new Error('Unexpected error');
        });

        const result = guard.canActivate(mockContext);

        expect(result).toBe(false);
    });

    it('should handle invalid role values', () => {
        reflector.getAllAndOverride.mockReturnValue([UserRole.USER]);
        mockGqlContext.getContext.mockReturnValue({
            req: {
                user: {
                    role: 'INVALID_ROLE',
                },
            },
        });

        const result = guard.canActivate(mockContext);

        expect(result).toBe(false);
    });
});
