// current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export const extractCurrentUser = (ctx: ExecutionContext) => {
    if (ctx.getType() === 'http') {
        return ctx.switchToHttp().getRequest()?.user;
    }
    const gqlCtx = GqlExecutionContext.create(ctx).getContext();
    return gqlCtx.req?.user;
};

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
    return extractCurrentUser(ctx);
});
