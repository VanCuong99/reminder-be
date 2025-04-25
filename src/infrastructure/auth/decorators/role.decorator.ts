// src/infrastructure/auth/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { UserRole } from 'src/shared/constants/user-role.enum';

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);
