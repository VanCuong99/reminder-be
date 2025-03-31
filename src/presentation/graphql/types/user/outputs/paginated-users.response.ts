import { ObjectType, Field, Int } from '@nestjs/graphql';
import { UserType } from './user.type';

@ObjectType()
export class PaginatedUsersResponse {
    @Field(() => [UserType])
    items: UserType[];

    @Field(() => Int)
    total: number;

    @Field(() => Int)
    page: number;

    @Field(() => Int)
    totalPages: number;

    @Field(() => Boolean)
    hasNext: boolean;

    @Field(() => Boolean)
    hasPrevious: boolean;
} 
