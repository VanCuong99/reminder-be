// src/infrastructure/auth/guards/jwt-auth.guard.ts
import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';
import { Observable, firstValueFrom } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    getRequest(context: ExecutionContext) {
        if (context.getType<string>() !== 'graphql') {
            throw new UnauthorizedException('Unsupported context type');
        }

        const ctx = GqlExecutionContext.create(context);
        const request = ctx.getContext().req;

        if (!request) {
            throw new UnauthorizedException('Request not found in context');
        }

        return request;
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        try {
            const result = super.canActivate(context);

            if (result instanceof Observable) {
                return await firstValueFrom(result);
            }

            return result;
        } catch (error) {
            if (error instanceof UnauthorizedException) {
                throw error;
            }
            throw new UnauthorizedException('Authentication failed');
        }
    }
}
