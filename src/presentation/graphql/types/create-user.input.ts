import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsEmail } from 'class-validator';

@InputType()
export class CreateUserInput {
    @Field(() => String)
    @IsString()
    username: string;

    @Field(() => String)
    @IsEmail()
    email: string;

    @Field(() => String)
    @IsString()
    password: string;

    @Field(() => Date)
    createdAt: Date;
} 
