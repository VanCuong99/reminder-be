import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger(LoggingInterceptor.name);

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const now = Date.now();
        const request = context.switchToHttp().getRequest<Request>();
        const { method, url, ip } = request;
        const userAgent = request.get('user-agent') || '';

        // Log the request
        this.logger.log(`Request: ${method} ${url} - IP: ${ip} - User Agent: ${userAgent}`);

        return next.handle().pipe(
            tap({
                next: val => {
                    const response = context.switchToHttp().getResponse<Response>();
                    const delay = Date.now() - now;
                    this.logger.log(
                        `Response: ${method} ${url} - Status: ${response.statusCode} - ${delay}ms`,
                    );
                },
                error: err => {
                    const response = context.switchToHttp().getResponse<Response>();
                    const delay = Date.now() - now;
                    this.logger.error(
                        `Response Error: ${method} ${url} - Status: ${response.statusCode} - ${delay}ms - ${err.message}`,
                    );
                },
            }),
        );
    }
}
