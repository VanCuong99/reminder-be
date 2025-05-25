import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length, IsOptional } from 'class-validator';

export class RegisterDto {
    @ApiProperty({
        description: 'Username of the user',
        minLength: 3,
        maxLength: 30,
        example: 'johndoe',
    })
    @IsNotEmpty()
    @IsString()
    @Length(3, 30)
    username: string;

    @ApiProperty({
        description: 'Email address',
        example: 'john.doe@example.com',
    })
    @IsNotEmpty()
    @IsEmail()
    email: string;

    @ApiProperty({
        description: 'User password',
        minLength: 6,
        maxLength: 30,
        example: 'Password123!',
    })
    @IsNotEmpty()
    @IsString()
    @Length(6, 30)
    password: string;

    @ApiPropertyOptional({
        description:
            'User timezone in IANA format (e.g., "America/New_York", "Asia/Ho_Chi_Minh"). If not provided, it will be automatically detected from request headers.',
        example: 'Asia/Ho_Chi_Minh',
        default: 'Auto-detected',
    })
    @IsOptional()
    @IsString()
    timezone?: string;
}
