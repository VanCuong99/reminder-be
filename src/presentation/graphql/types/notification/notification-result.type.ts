import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class NotificationResult {
    @Field()
    success: boolean;

    @Field({ nullable: true })
    error?: string;

    @Field(() => [String], { nullable: true })
    messageIds?: string[];

    @Field(() => Number, { nullable: true })
    successCount?: number;

    @Field(() => Number, { nullable: true })
    failureCount?: number;
}
