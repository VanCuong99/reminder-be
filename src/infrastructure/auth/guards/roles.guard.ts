// src/infrastructure/auth/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { UserRole } from 'src/shared/constants/user-role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        try {
            const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>('roles', [
                context.getHandler(),
                context.getClass(),
            ]);

            if (!requiredRoles) {
                return true;
            }

            if (context.getType<string>() !== 'graphql') {
                return false;
            }

            const ctx = GqlExecutionContext.create(context);
            const user = ctx.getContext().req?.user;

            if (!user?.role) {
                return false;
            }

            return requiredRoles.includes(user.role);
        } catch (error) {
            return false;
        }
    }
}
