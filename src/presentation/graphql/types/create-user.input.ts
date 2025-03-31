import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsEmail } from 'class-validator';

@InputType()
export class CreateUserInput {
    @Field()
    @IsString()
    username: string;

    @Field()
    @IsEmail()
    email: string;

    @Field()
    @IsString()
    password: string;

    @Field()
    createdAt: Date;
} 
