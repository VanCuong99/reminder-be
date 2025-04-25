// src/presentation/graphql/types/auth/outputs/auth.response.ts
import { ObjectType, Field } from '@nestjs/graphql';
import { UserType } from '../../user/outputs/user.type';

@ObjectType()
export class AuthResponse {
    @Field()
    access_token: string;

    @Field(() => UserType)
    user: UserType;
}
