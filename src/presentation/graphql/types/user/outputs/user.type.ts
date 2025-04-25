// src/presentation/graphql/types/user/outputs/user.type.ts
import { ObjectType, Field } from '@nestjs/graphql';
import { UserRole } from '../../../../../shared/constants/user-role.enum';

@ObjectType()
export class UserType {
    @Field()
    id: string;

    @Field()
    username: string;

    @Field()
    email: string;

    @Field(() => UserRole)
    role: UserRole;

    @Field()
    createdAt: Date;

    @Field()
    isActive: boolean;
}
