import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsEnum, IsNotEmpty, IsStrongPassword, MinLength } from 'class-validator';
import { UserRole } from 'src/shared/constants/user-role.enum';

@InputType()
export class CreateUserInput {
    @Field()
    @IsNotEmpty({ message: 'Username is required' })
    @MinLength(3, { message: 'Username must be at least 3 characters' })
    username: string;

    @Field()
    @IsEmail({}, { message: 'Invalid email format' })
    @IsNotEmpty({ message: 'Email is required' })
    email: string;

    @Field()
    @IsNotEmpty({ message: 'Password is required' })
    @MinLength(6, { message: 'Password must be at least 6 characters' })
    @IsStrongPassword(
        {
            minLength: 6,
            minLowercase: 1,
            minUppercase: 1,
            minNumbers: 1,
            minSymbols: 1,
        },
        { message: 'Password is not strong enough' },
    )
    password: string;

    @Field()
    @IsNotEmpty({ message: 'Role is required' })
    @IsEnum(UserRole, { message: 'Invalid role' })
    role: UserRole;
}
