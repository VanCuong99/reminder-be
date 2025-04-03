import { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
    let guard: JwtAuthGuard;
    let mockContext: ExecutionContext;
    let mockGqlContext: any;

    beforeEach(() => {
        guard = new JwtAuthGuard();
        mockGqlContext = {
            getContext: () => ({
                req: {
                    headers: {
                        authorization: 'Bearer token123',
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

    it('should get request from GraphQL context', () => {
        jest.spyOn(GqlExecutionContext, 'create').mockReturnValue(mockGqlContext);

        const result = guard.getRequest(mockContext);

        expect(GqlExecutionContext.create).toHaveBeenCalledWith(mockContext);
        expect(result).toEqual(mockGqlContext.getContext().req);
    });
});
