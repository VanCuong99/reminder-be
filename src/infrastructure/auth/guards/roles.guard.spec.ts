import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { UserRole } from 'src/shared/constants/user-role.enum';
import { GqlExecutionContext } from '@nestjs/graphql';

describe('RolesGuard', () => {
    let guard: RolesGuard;
    let reflector: Reflector;
    let mockExecutionContext: ExecutionContext;

    const createMockContext = (user: any = { role: UserRole.USER }) =>
        ({
            getType: () => 'graphql',
            getHandler: () => function mockHandler() {},
            getClass: () => class MockClass {},
            getArgs: () => [],
            getArgByIndex: () => null,
            switchToRpc: () => {
                throw new Error('Invalid context');
            },
            switchToWs: () => {
                throw new Error('Invalid context');
            },
            switchToHttp: () => ({
                getRequest: () => ({ user }),
                getResponse: () => ({}),
                getNext: () => () => {},
            }),
        }) as ExecutionContext;

    const mockGqlContext = (user: any = { role: UserRole.USER }) => ({
        getContext: () => ({
            req: { user },
        }),
    });

    beforeEach(() => {
        reflector = new Reflector();
        guard = new RolesGuard(reflector);
        mockExecutionContext = createMockContext();
        jest.spyOn(GqlExecutionContext, 'create').mockReturnValue(mockGqlContext() as any);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('canActivate', () => {
        it('should return true when no roles are required', () => {
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
            expect(guard.canActivate(mockExecutionContext)).toBe(true);
        });

        it('should return true when user has required role', () => {
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.USER]);
            expect(guard.canActivate(mockExecutionContext)).toBe(true);
        });

        it('should return false when user does not have required role', () => {
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
            expect(guard.canActivate(mockExecutionContext)).toBe(false);
        });

        it('should handle multiple required roles', () => {
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
                UserRole.ADMIN,
                UserRole.USER,
            ]);
            expect(guard.canActivate(mockExecutionContext)).toBe(true);
        });

        it('should handle missing user in context', () => {
            jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
                getContext: () => ({
                    req: {},
                }),
            } as any);
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.USER]);
            expect(guard.canActivate(mockExecutionContext)).toBe(false);
        });

        it('should handle missing user role', () => {
            jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
                getContext: () => ({
                    req: { user: {} },
                }),
            } as any);
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.USER]);
            expect(guard.canActivate(mockExecutionContext)).toBe(false);
        });

        it('should handle invalid context type', () => {
            mockExecutionContext = createMockContext();
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.USER]);
            expect(guard.canActivate(mockExecutionContext)).toBe(true);
        });

        it('should handle reflector error', () => {
            jest.spyOn(reflector, 'getAllAndOverride').mockImplementation(() => {
                throw new Error('Reflector error');
            });
            expect(guard.canActivate(mockExecutionContext)).toBe(false);
        });
    });
});
