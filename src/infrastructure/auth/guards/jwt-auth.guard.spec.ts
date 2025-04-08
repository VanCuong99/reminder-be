import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtAuthGuard } from './jwt-auth.guard';

// Mock AuthGuard to return a class that can be extended
jest.mock('@nestjs/passport', () => {
    return {
        AuthGuard: () => {
            return class MockAuthGuard {
                canActivate() {
                    throw new UnauthorizedException();
                }
            };
        },
    };
});

describe('JwtAuthGuard', () => {
    let guard: JwtAuthGuard;
    let mockContext: ExecutionContext;
    let mockGqlContext: any;

    beforeEach(() => {
        guard = new JwtAuthGuard();
        mockContext = {
            switchToHttp: jest.fn(),
            getClass: jest.fn(),
            getHandler: jest.fn(),
            getArgs: jest.fn(),
            getArgByIndex: jest.fn(),
            switchToRpc: jest.fn(),
            switchToWs: jest.fn(),
            getType: jest.fn(() => 'graphql'),
        } as any;

        mockGqlContext = {
            getContext: jest.fn().mockReturnValue({
                req: {
                    headers: {},
                    body: {},
                },
            }),
        };

        jest.spyOn(GqlExecutionContext, 'create').mockReturnValue(mockGqlContext);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(guard).toBeDefined();
    });

    describe('getRequest', () => {
        it('should return request from GraphQL context', () => {
            const mockReq = { headers: {}, body: {} };
            mockGqlContext.getContext.mockReturnValue({ req: mockReq });

            const request = guard.getRequest(mockContext);
            expect(request).toEqual(mockReq);
        });

        it('should handle missing request in context', () => {
            mockGqlContext.getContext.mockReturnValue({});

            expect(() => guard.getRequest(mockContext)).toThrow('Request not found in context');
        });

        it('should handle invalid context type', () => {
            (mockContext.getType as jest.Mock).mockReturnValue('http');

            expect(() => guard.getRequest(mockContext)).toThrow('Unsupported context type');
        });
    });

    describe('canActivate', () => {
        it('should call super.canActivate with transformed request', async () => {
            const mockReq = { headers: {}, body: {} };
            mockGqlContext.getContext.mockReturnValue({ req: mockReq });

            await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
        });

        it('should handle authentication errors', async () => {
            const mockRequest = {
                headers: {
                    authorization: 'Bearer invalid-token',
                },
            };
            const mockHttpContext = {
                getRequest: () => mockRequest,
            };
            const mockContext = {
                switchToHttp: () => mockHttpContext,
                getType: () => 'http',
            };

            await expect(guard.canActivate(mockContext as any)).rejects.toThrow(
                UnauthorizedException,
            );
        });
    });
});
