import { InputType, Field, Int } from '@nestjs/graphql';
import { IsOptional, Min } from 'class-validator';

@InputType()
export class PaginationInput {
    @Field(() => Int, { defaultValue: 1 })
    @Min(1)
    page: number;

    @Field(() => Int, { defaultValue: 10 })
    @Min(1)
    limit: number;

    @Field({ nullable: true })
    @IsOptional()
    sortBy?: string;

    @Field({ nullable: true })
    @IsOptional()
    sortDirection?: 'ASC' | 'DESC';
} 
