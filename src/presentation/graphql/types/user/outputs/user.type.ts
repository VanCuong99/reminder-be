import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class UserType {
    @Field()
    id: string;

    @Field()
    username: string;

    @Field()
    email: string;

    @Field()
    password: string;

    @Field()
    createdAt: Date;
} 
