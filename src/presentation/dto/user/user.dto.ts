import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../shared/constants/user-role.enum';

export class UserDto {
    @ApiProperty({
        description: 'Unique identifier',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    id: string;

    @ApiProperty({
        description: 'Username',
        example: 'johndoe',
    })
    username: string;

    @ApiProperty({
        description: 'Email address',
        example: 'john.doe@example.com',
    })
    email: string;

    @ApiProperty({
        description: 'User role',
        enum: UserRole,
        example: UserRole.USER,
    })
    role: UserRole;

    @ApiProperty({
        description: 'Account status',
        example: true,
    })
    isActive: boolean;

    @ApiProperty({
        description: 'Account creation date',
        example: '2023-01-01T00:00:00.000Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'Account last update date',
        example: '2023-01-01T00:00:00.000Z',
    })
    updatedAt: Date;

    @ApiPropertyOptional({
        description: 'Device tokens for push notifications',
        type: [String],
        example: ['token1', 'token2'],
    })
    deviceTokens?: string[];
}
