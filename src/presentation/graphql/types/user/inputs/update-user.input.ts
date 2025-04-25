import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsOptional, IsString, IsStrongPassword, Length } from 'class-validator';

@InputType()
export class UpdateUserInput {
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @Length(3, 50)
    username?: string;

    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsEmail()
    email?: string;

    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
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
    password?: string;
}
