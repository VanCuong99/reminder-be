// src/domain/enums/user-role.enum.ts
import { registerEnumType } from '@nestjs/graphql';

export enum UserRole {
    ADMIN = 'admin',
    USER = 'user',
}

registerEnumType(UserRole, {
    name: 'UserRole',
    description: 'User role enum type',
});
