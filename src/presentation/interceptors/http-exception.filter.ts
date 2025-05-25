import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: HttpException, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        const status = exception.getStatus();
        const errorResponse = exception.getResponse();

        let message = 'An error occurred';
        let errors = null;

        if (typeof errorResponse === 'string') {
            message = errorResponse;
        } else if (typeof errorResponse === 'object') {
            const errorObj = errorResponse as any;
            message = errorObj.message ?? 'An error occurred';
            errors = errorObj.errors ?? null;
        }

        response.status(status).json({
            success: false,
            message,
            errors,
            statusCode: status,
            path: request.url,
            timestamp: new Date().toISOString(),
        });
    }
}
