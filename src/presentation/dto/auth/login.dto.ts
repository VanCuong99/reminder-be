import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

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
}
