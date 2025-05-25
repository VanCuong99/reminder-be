import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponseDto } from '../dto/common/responses/api-response.dto';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponseDto<T>> {
    intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponseDto<T>> {
        return next.handle().pipe(
            map(data => {
                // Check if the response is already an ApiResponseDto
                if (data?.success !== undefined && data?.message !== undefined) {
                    return data;
                }

                // For paginated responses
                if (data?.items && data?.meta) {
                    const { items, meta } = data;
                    return {
                        success: true,
                        message: 'Success',
                        data: items,
                        total: meta.totalItems,
                        page: meta.currentPage,
                        limit: meta.itemsPerPage,
                        totalPages: meta.totalPages,
                        hasNext: meta.currentPage < meta.totalPages,
                        timestamp: new Date().toISOString(),
                    };
                }

                // Default transformation
                return {
                    success: true,
                    message: 'Success',
                    data,
                    timestamp: new Date().toISOString(),
                };
            }),
        );
    }
}
