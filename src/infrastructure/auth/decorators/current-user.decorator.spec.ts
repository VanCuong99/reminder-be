import { ExecutionContext, Logger } from '@nestjs/common';
import { extractCurrentUser } from './current-user.decorator';

describe('CurrentUser Decorator', () => {
    // Silence all logger output for all tests
    let loggerErrorSpy: jest.SpyInstance;
    let loggerDebugSpy: jest.SpyInstance;
    let loggerWarnSpy: jest.SpyInstance;
    let loggerLogSpy: jest.SpyInstance;
    beforeAll(() => {
        loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
        loggerDebugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
        loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
        loggerLogSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    });
    afterAll(() => {
        loggerErrorSpy.mockRestore();
        loggerDebugSpy.mockRestore();
        loggerWarnSpy.mockRestore();
        loggerLogSpy.mockRestore();
    });

    let mockExecutionContext: Partial<ExecutionContext>;
    let mockRequest: any;

    beforeEach(() => {
        mockRequest = {
            user: { id: '1', email: 'test@example.com' },
        };

        mockExecutionContext = {
            switchToHttp: jest.fn().mockReturnValue({
                getRequest: jest.fn().mockReturnValue(mockRequest),
            }),
            getType: jest.fn().mockReturnValue('http'),
            getHandler: jest.fn(),
            getClass: jest.fn(),
            getArgs: jest.fn(),
            getArgByIndex: jest.fn(),
            switchToRpc: jest.fn(),
            switchToWs: jest.fn(),
        };
    });

    it('should extract user from HTTP context', () => {
        const result = extractCurrentUser(mockExecutionContext as ExecutionContext);
        expect(result).toEqual(mockRequest.user);
        expect(mockExecutionContext.switchToHttp).toHaveBeenCalled();
    });

    it('should return undefined for non-HTTP context types', () => {
        (mockExecutionContext.getType as jest.Mock).mockReturnValue('rpc');
        const result = extractCurrentUser(mockExecutionContext as ExecutionContext);
        expect(result).toBeUndefined();
    });

    it('should handle missing request gracefully', () => {
        (mockExecutionContext.switchToHttp as jest.Mock).mockReturnValue({
            getRequest: jest.fn().mockReturnValue(undefined),
        });
        const result = extractCurrentUser(mockExecutionContext as ExecutionContext);
        expect(result).toBeUndefined();
    });

    it('should handle missing user gracefully', () => {
        mockRequest.user = undefined;
        const result = extractCurrentUser(mockExecutionContext as ExecutionContext);
        expect(result).toBeUndefined();
    });

    it('should handle implementation errors gracefully', () => {
        (mockExecutionContext.switchToHttp as jest.Mock).mockImplementation(() => {
            throw new Error('Unexpected error');
        });
        const result = extractCurrentUser(mockExecutionContext as ExecutionContext);
        expect(result).toBeUndefined();
    });
});
