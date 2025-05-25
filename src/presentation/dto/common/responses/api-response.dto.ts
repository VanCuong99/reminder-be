import { ApiProperty } from '@nestjs/swagger';

export class ApiResponseDto<T = any> {
    @ApiProperty({
        description: 'The status of the response (success or error)',
        example: 'success',
        enum: ['success', 'error'],
    })
    status: 'success' | 'error';

    @ApiProperty({
        description: 'The data returned by the API',
        example: null,
        nullable: true,
    })
    data?: T | null;

    @ApiProperty({
        description: 'Error message (if status is error)',
        example: null,
        nullable: true,
    })
    error?: string | null;

    @ApiProperty({
        description: 'The timestamp of the response',
        example: '2025-01-01T00:00:00.000Z',
    })
    timestamp: string;
}
