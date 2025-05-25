import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { UserRole } from '../../../shared/constants/user-role.enum';

export class UpdateUserDto {
    @ApiPropertyOptional({
        description: 'Username of the user',
        minLength: 3,
        maxLength: 30,
        example: 'johndoe',
    })
    @IsOptional()
    @IsString()
    @Length(3, 30)
    username?: string;

    @ApiPropertyOptional({
        description: 'Email address',
        example: 'john.doe@example.com',
    })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiPropertyOptional({
        description: 'User password',
        minLength: 6,
        maxLength: 30,
    })
    @IsOptional()
    @IsString()
    @Length(6, 30)
    password?: string;

    @ApiPropertyOptional({
        description: 'User role',
        enum: UserRole,
    })
    @IsOptional()
    @IsEnum(UserRole)
    role?: UserRole;

    @ApiPropertyOptional({
        description: 'User active status',
        type: Boolean,
    })
    @IsOptional()
    isActive?: boolean;
}
