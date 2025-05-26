import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginDto {
    @ApiProperty({
        description: 'User email address',
        example: 'newuser@example.com',
    })
    @IsNotEmpty()
    @IsEmail()
    email: string;

    @ApiProperty({
        description: 'User password',
        example: 'SecurePassword123!',
    })
    @IsNotEmpty()
    @IsString()
    password: string;

    @ApiProperty({
        description: 'User agent string from the client browser',
        required: false,
    })
    @IsOptional()
    @IsString()
    userAgent?: string;

    @ApiProperty({
        description: 'IP address of the client',
        required: false,
    })
    @IsOptional()
    @IsString()
    ip?: string;
}
