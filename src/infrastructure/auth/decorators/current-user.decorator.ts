// src/infrastructure/auth/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export const CurrentUser = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
    if (ctx.getType() === 'http') {
        return ctx.switchToHttp().getRequest()?.user;
    }
    const gqlCtx = GqlExecutionContext.create(ctx).getContext();
    return gqlCtx.req?.user;
});
