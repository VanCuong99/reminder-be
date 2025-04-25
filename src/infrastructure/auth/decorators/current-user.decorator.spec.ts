import { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { extractCurrentUser } from './current-user.decorator';

const callback = (data: unknown, ctx: ExecutionContext) => {
    if (!ctx) {
        return undefined;
    }
    if (ctx.getType() === 'http') {
        return ctx.switchToHttp().getRequest()?.user;
    }
    const gqlCtx = GqlExecutionContext.create(ctx).getContext();
    return gqlCtx.req?.user;
};

const createMockUser = () => ({
    id: '123',
    email: 'test@example.com',
    role: 'USER',
});

const createMockGqlContext = (user = createMockUser()) => ({
    getContext: () => ({
        req: { user },
    }),
});

const createEmptyGqlContext = () => ({
    getContext: () => ({
        req: { user: undefined },
    }),
});

describe('CurrentUser Decorator', () => {
    let mockContext: ExecutionContext;
    let gqlExecutionContextSpy: jest.SpyInstance;

    const createUndefinedReqGqlContext = () => {
        return {
            getContext: () => ({ req: undefined }),
        };
    };

    beforeEach(() => {
        mockContext = {
            switchToHttp: jest.fn(),
            getClass: jest.fn(),
            getHandler: jest.fn(),
            getArgs: jest.fn(),
            getArgByIndex: jest.fn(),
            switchToRpc: jest.fn(),
            switchToWs: jest.fn(),
            getType: jest.fn().mockReturnValue('graphql'),
            getRequest: jest.fn(),
            constructor: {
                name: 'ExecutionContext',
            },
        } as any;

        gqlExecutionContextSpy = jest
            .spyOn(GqlExecutionContext, 'create')
            .mockImplementation(() => createMockGqlContext() as any);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Callback logic', () => {
        it('should extract user from GraphQL request', () => {
            const result = callback(null, mockContext);

            expect(gqlExecutionContextSpy).toHaveBeenCalledWith(mockContext);
            expect(result).toEqual(createMockUser());
        });

        it('should extract user from HTTP request', () => {
            const mockHttpRequest = { user: createMockUser() };

            (mockContext.getType as jest.Mock).mockReturnValue('http');
            (mockContext.switchToHttp as jest.Mock).mockReturnValue({
                getRequest: () => mockHttpRequest,
            });

            const result = callback(null, mockContext);

            expect(mockContext.switchToHttp).toHaveBeenCalled();
            expect(result).toEqual(mockHttpRequest.user);
        });

        it('should handle null context', () => {
            const result = callback(null, null);
            expect(result).toBeUndefined();
        });

        it('should handle undefined user in GraphQL context', () => {
            gqlExecutionContextSpy.mockImplementation(() => createEmptyGqlContext() as any);

            const result = callback(null, mockContext);
            expect(result).toBeUndefined();
        });

        it('should handle undefined user in HTTP context', () => {
            (mockContext.getType as jest.Mock).mockReturnValue('http');
            (mockContext.switchToHttp as jest.Mock).mockReturnValue({
                getRequest: () => ({ user: undefined }),
            });

            gqlExecutionContextSpy.mockImplementation(createUndefinedReqGqlContext);
            gqlExecutionContextSpy.mockImplementation(createUndefinedReqGqlContext);

            const result = callback(null, mockContext);
            expect(result).toBeUndefined();
        });
    });

    it('should ignore data argument and still return user', () => {
        const result = callback('any-data', mockContext);
        expect(result).toEqual(createMockUser());
    });

    describe('Decorator usage (createParamDecorator)', () => {
        it('should return user via extractCurrentUser in GraphQL context', () => {
            gqlExecutionContextSpy.mockImplementation(() => createMockGqlContext() as any);

            const result = extractCurrentUser(mockContext as any);
            expect(result).toEqual(createMockUser());
        });

        it('should return user via extractCurrentUser in HTTP context', () => {
            const mockHttpRequest = { user: createMockUser() };

            (mockContext.getType as jest.Mock).mockReturnValue('http');
            (mockContext.switchToHttp as jest.Mock).mockReturnValue({
                getRequest: () => mockHttpRequest,
            });

            const result = extractCurrentUser(mockContext as any);
            expect(result).toEqual(createMockUser());
        });
    });
});
