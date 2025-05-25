import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';
import { UserRole } from '../../../shared/constants/user-role.enum';

export class CreateUserDto {
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
    })
    @IsNotEmpty()
    @IsString()
    @Length(6, 30)
    password: string;

    @ApiPropertyOptional({
        description: 'User role',
        enum: UserRole,
        default: UserRole.USER,
    })
    @IsOptional()
    @IsEnum(UserRole)
    role?: UserRole = UserRole.USER;
}
