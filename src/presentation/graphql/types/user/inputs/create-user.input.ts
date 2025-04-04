import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsEnum, IsNotEmpty, MinLength } from 'class-validator';
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
    password: string;

    @Field()
    @IsNotEmpty({ message: 'Role is required' })
    @IsEnum(UserRole, { message: 'Invalid role' })
    role: UserRole;
}
