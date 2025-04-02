import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Type } from '@nestjs/common';

export interface IPaginatedType<T> {
    items: T[];
    total: number;
    page: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
}

export function Paginated<T>(ItemType: Type<T>): Type<IPaginatedType<T>> {
    @ObjectType({ isAbstract: true })
    abstract class PaginatedResponseClass implements IPaginatedType<T> {
        @Field(() => [ItemType])
        items: T[];

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

    return PaginatedResponseClass as Type<IPaginatedType<T>>;
} 
