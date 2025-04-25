import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { GraphQLJSON } from 'graphql-type-json';

@InputType()
export class NotificationInput {
    @Field()
    @IsNotEmpty()
    @IsString()
    title: string;

    @Field()
    @IsNotEmpty()
    @IsString()
    body: string;

    @Field(() => GraphQLJSON, { nullable: true })
    @IsOptional()
    data?: { [key: string]: string };
}
