// src/infrastructure/auth/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../../shared/constants/user-role.enum';
import { ROLES_KEY } from '../decorators/role.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        try {
            const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
                context.getHandler(),
                context.getClass(),
            ]);

            // If no roles are required, allow access
            if (!requiredRoles || requiredRoles.length === 0) {
                return true;
            }

            const http = context.switchToHttp?.();
            if (!http || typeof http.getRequest !== 'function') return false;

            const request = http.getRequest();
            if (!request || !request.user?.role) {
                return false;
            }

            // Check if user has any of the required roles
            return requiredRoles.includes(request.user.role);
        } catch {
            return false;
        }
    }
}
