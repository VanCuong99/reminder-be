import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from '../user/user.dto';

export class AuthResponseDto {
    @ApiProperty({
        description: 'Authenticated user information',
        type: UserDto,
    })
    user: UserDto;

    @ApiProperty({
        description: 'JWT access token',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    })
    access_token: string;

    @ApiProperty({
        description: 'Refresh token',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    })
    refresh_token: string;
}
