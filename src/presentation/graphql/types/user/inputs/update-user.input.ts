import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsOptional, MinLength } from 'class-validator';

@InputType()
export class UpdateUserInput {
    @Field()
    id: string;

    @Field({ nullable: true })
    @IsOptional()
    @MinLength(3, { message: 'Username must be at least 3 characters' })
    username?: string;

    @Field({ nullable: true })
    @IsOptional()
    @IsEmail({}, { message: 'Invalid email format' })
    email?: string;

    @Field({ nullable: true })
    @IsOptional()
    @MinLength(6, { message: 'Password must be at least 6 characters' })
    password?: string;
} 
