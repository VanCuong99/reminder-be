import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class BaseResponse {
    @Field(() => Boolean)
    success: boolean;

    @Field(() => String, { nullable: true })
    message?: string;

    @Field(() => String, { nullable: true })
    error?: string;
}
