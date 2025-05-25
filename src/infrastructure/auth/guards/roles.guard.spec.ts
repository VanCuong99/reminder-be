import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { UserRole } from 'src/shared/constants/user-role.enum';
import { ROLES_KEY } from '../decorators/role.decorator';

describe('RolesGuard', () => {
    let guard: RolesGuard;
    let reflector: jest.Mocked<Reflector>;
    let mockContext: jest.Mocked<ExecutionContext>;
    let mockHttpContext: any;

    beforeEach(() => {
        reflector = {
            getAllAndOverride: jest.fn(),
        } as unknown as jest.Mocked<Reflector>;

        guard = new RolesGuard(reflector);

        mockContext = {
            getHandler: jest.fn(),
            getClass: jest.fn(),
            getType: jest.fn(() => 'http'),
            getArgs: jest.fn(),
            getArgByIndex: jest.fn(),
            switchToHttp: jest.fn(),
            switchToRpc: jest.fn(),
            switchToWs: jest.fn(),
        } as unknown as jest.Mocked<ExecutionContext>;

        mockHttpContext = {
            getRequest: jest.fn().mockReturnValue({
                user: {
                    role: UserRole.USER,
                },
            }),
        };

        mockContext.switchToHttp.mockReturnValue(mockHttpContext);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should allow access when no roles are required', () => {
        reflector.getAllAndOverride.mockReturnValue(null);

        const result = guard.canActivate(mockContext);

        expect(result).toBe(true);
        expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
            mockContext.getHandler(),
            mockContext.getClass(),
        ]);
    });

    it('should deny access for non-HTTP contexts (switchToHttp missing)', () => {
        // Simulate context.switchToHttp is not a function
        (mockContext as any).switchToHttp = undefined;
        reflector.getAllAndOverride.mockReturnValue([UserRole.USER]);
        const result = guard.canActivate(mockContext);
        expect(result).toBe(false);
    });

    it('should deny access if getRequest is not a function', () => {
        reflector.getAllAndOverride.mockReturnValue([UserRole.USER]);
        mockContext.switchToHttp.mockReturnValue({
            getRequest: undefined,
            getResponse: () => ({}) as any,
            getNext: () => ({}) as any,
        });
        const result = guard.canActivate(mockContext);
        expect(result).toBe(false);
    });
    it('should allow access when ROLES_KEY is not defined', () => {
        reflector.getAllAndOverride.mockReturnValue(undefined);
        const result = guard.canActivate(mockContext);
        expect(result).toBe(true);
    });

    it('should allow access when user has required role', () => {
        reflector.getAllAndOverride.mockReturnValue([UserRole.USER]);
        mockHttpContext.getRequest.mockReturnValue({
            user: {
                role: UserRole.USER,
            },
        });

        const result = guard.canActivate(mockContext);

        expect(result).toBe(true);
    });

    it('should deny access when user lacks required role', () => {
        reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
        mockHttpContext.getRequest.mockReturnValue({
            user: {
                role: UserRole.USER,
            },
        });

        const result = guard.canActivate(mockContext);

        expect(result).toBe(false);
    });

    it('should deny access when user is not present', () => {
        reflector.getAllAndOverride.mockReturnValue([UserRole.USER]);
        mockHttpContext.getRequest.mockReturnValue({});

        const result = guard.canActivate(mockContext);

        expect(result).toBe(false);
    });

    it('should deny access when request is not present', () => {
        reflector.getAllAndOverride.mockReturnValue([UserRole.USER]);
        mockContext.switchToHttp.mockReturnValue({
            getRequest: () => null,
            getResponse: () => ({}) as any,
            getNext: () => ({}) as any,
        });

        const result = guard.canActivate(mockContext);

        expect(result).toBe(false);
    });

    it('should deny access when context is invalid', () => {
        reflector.getAllAndOverride.mockReturnValue([UserRole.USER]);
        mockContext.switchToHttp.mockReturnValue(null);

        const result = guard.canActivate(mockContext);

        expect(result).toBe(false);
    });

    it('should handle multiple required roles', () => {
        reflector.getAllAndOverride.mockReturnValue([UserRole.USER, UserRole.ADMIN]);

        // Test with USER role
        mockHttpContext.getRequest.mockReturnValue({
            user: {
                role: UserRole.USER,
            },
        });
        expect(guard.canActivate(mockContext)).toBe(true);

        // Test with ADMIN role
        mockHttpContext.getRequest.mockReturnValue({
            user: {
                role: UserRole.ADMIN,
            },
        });
        expect(guard.canActivate(mockContext)).toBe(true);

        // Test with non-matching role
        mockHttpContext.getRequest.mockReturnValue({
            user: {
                role: 'OTHER',
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
        mockHttpContext.getRequest.mockReturnValue({
            user: {
                role: 'INVALID_ROLE',
            },
        });

        const result = guard.canActivate(mockContext);

        expect(result).toBe(false);
    });
});
