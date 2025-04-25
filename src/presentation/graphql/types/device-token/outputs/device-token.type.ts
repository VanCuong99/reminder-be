import { ObjectType, Field, ID } from '@nestjs/graphql';
import { UserType } from '../../user/outputs/user.type';

@ObjectType('DeviceToken')
export class DeviceTokenType {
    @Field(() => ID)
    id: string;

    @Field()
    token: string;

    @Field()
    deviceType: string;

    @Field()
    userId: string;

    @Field(() => UserType, { nullable: true })
    user?: UserType;

    @Field()
    createdAt: Date;

    @Field()
    updatedAt: Date;

    @Field()
    isActive: boolean;
}
