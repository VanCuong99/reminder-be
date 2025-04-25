import { ObjectType, Field, ID } from '@nestjs/graphql';
import { UserType } from '../user/outputs/user.type';

@ObjectType()
export class DeviceToken {
    @Field(() => ID)
    id: string;

    @Field()
    token: string;

    @Field()
    deviceType: string;

    @Field(() => UserType)
    user: UserType;

    @Field()
    userId: string;

    @Field()
    createdAt: Date;

    @Field()
    updatedAt: Date;

    @Field()
    isActive: boolean;
}
