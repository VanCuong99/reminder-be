import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { RolesGuard } from './roles.guard';
import { UserRole } from 'src/shared/constants/user-role.enum';

describe('RolesGuard', () => {
    let guard: RolesGuard;
    let reflector: Reflector;
    let mockContext: ExecutionContext;
    let mockGqlContext: any;

    beforeEach(() => {
        reflector = new Reflector();
        guard = new RolesGuard(reflector);

        mockGqlContext = {
            getContext: () => ({
                req: {
                    user: {
                        role: UserRole.USER,
                    },
                },
            }),
        };

        mockContext = {
            switchToHttp: jest.fn(),
            getClass: jest.fn(),
            getHandler: jest.fn(),
            getArgs: jest.fn(),
            getArgByIndex: jest.fn(),
            switchToRpc: jest.fn(),
            switchToWs: jest.fn(),
            getType: jest.fn(),
        } as any;
    });

    it('should be defined', () => {
        expect(guard).toBeDefined();
    });

    it('should return true when no roles are required', () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
        jest.spyOn(GqlExecutionContext, 'create').mockReturnValue(mockGqlContext);

        const result = guard.canActivate(mockContext);
        expect(result).toBe(true);
    });

    it('should return true when user has required role', () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.USER]);
        jest.spyOn(GqlExecutionContext, 'create').mockReturnValue(mockGqlContext);

        const result = guard.canActivate(mockContext);
        expect(result).toBe(true);
    });

    it('should return false when user does not have required role', () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
        jest.spyOn(GqlExecutionContext, 'create').mockReturnValue(mockGqlContext);

        const result = guard.canActivate(mockContext);
        expect(result).toBe(false);
    });
});
