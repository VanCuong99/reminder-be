import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../infrastructure/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../../infrastructure/auth/decorators/role.decorator';
import { UserRole } from '../../../shared/constants/user-role.enum';
import { NotificationService } from '../../../infrastructure/messaging/notification.service';
import { NotificationInput } from '../types/notification/inputs/notification.input';
import { NotificationResult } from '../types/notification/notification-result.type';

@Resolver('Notification')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationResolver {
    constructor(private readonly notificationService: NotificationService) {}

    @Mutation(() => NotificationResult)
    @Roles(UserRole.ADMIN)
    async sendNotificationToUser(
        @Args('userId') userId: string,
        @Args('notification') notification: NotificationInput,
    ): Promise<NotificationResult> {
        return this.notificationService.sendNotificationToUser(
            userId,
            notification,
            notification.data,
        );
    }

    @Mutation(() => NotificationResult)
    @Roles(UserRole.ADMIN)
    async broadcastNotification(
        @Args('notification') notification: NotificationInput,
    ): Promise<NotificationResult> {
        return this.notificationService.broadcastNotification(notification, notification.data);
    }

    @Mutation(() => NotificationResult)
    @Roles(UserRole.ADMIN)
    async sendTopicNotification(
        @Args('topic') topic: string,
        @Args('notification') notification: NotificationInput,
    ): Promise<NotificationResult> {
        return this.notificationService.sendTopicNotification(
            topic,
            notification,
            notification.data,
        );
    }

    @Mutation(() => NotificationResult)
    @Roles(UserRole.ADMIN)
    async sendNotification(
        @Args('token') token: string,
        @Args('notification') notification: NotificationInput,
    ): Promise<NotificationResult> {
        return this.notificationService.sendNotification(token, notification, notification.data);
    }
}
