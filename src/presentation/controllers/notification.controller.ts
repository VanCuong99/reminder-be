import {
    Controller,
    Get,
    Post,
    Param,
    Body,
    Query,
    UseGuards,
    ParseUUIDPipe,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../infrastructure/auth/guards/jwt-auth.guard';
import { NotificationService } from '../../infrastructure/messaging/notification.service';
import { CurrentUser } from '../../infrastructure/auth/decorators/current-user.decorator';
import { Roles } from '../../infrastructure/auth/decorators/role.decorator';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { UserRole } from '../../shared/constants/user-role.enum';
import { SendUserNotificationDto } from '../dto/notification/send-user-notification.dto';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
    constructor(private readonly notificationService: NotificationService) {}

    @Get()
    @ApiOperation({ summary: 'Get user notifications' })
    @ApiResponse({ status: 200, description: 'Return user notifications' })
    @ApiBearerAuth()
    async getUserNotifications(
        @CurrentUser('id') userId: string,
        @Query('limit') limit = 100,
        @Query('page') page = 0,
    ) {
        const { notifications, count } = await this.notificationService.getUserNotifications(
            userId,
            {
                limit: +limit,
                page: +page,
            },
        );

        return {
            data: notifications,
            meta: {
                total: count,
                limit: +limit,
                page: +page,
            },
        };
    }

    @Post('send')
    @ApiOperation({ summary: 'Send notification to a specific user' })
    @ApiResponse({ status: 201, description: 'Notification sent successfully' })
    @ApiBearerAuth()
    async sendNotificationToUser(@Body() sendDto: SendUserNotificationDto) {
        await this.notificationService.sendNotificationToUser(
            sendDto.userId,
            sendDto.notification,
            sendDto.data || {},
        );

        return {
            success: true,
            message: 'Notification sent successfully',
        };
    }

    @Post('user/:userId')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Send notification to a specific user (Admin only)' })
    @ApiResponse({ status: 201, description: 'Notification sent' })
    @ApiBearerAuth()
    async sendToUser(
        @Param('userId', ParseUUIDPipe) userId: string,
        @Body() payload: { title: string; body: string; data?: Record<string, string> },
    ) {
        await this.notificationService.sendNotificationToUser(
            userId,
            { title: payload.title, body: payload.body },
            payload.data || {},
        );

        return {
            success: true,
            message: 'Notification sent',
        };
    }

    @Post('broadcast')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Broadcast notification to all users (Admin only)' })
    @ApiResponse({ status: 201, description: 'Notification broadcast' })
    @ApiBearerAuth()
    async broadcast(
        @Body() payload: { title: string; body: string; data?: Record<string, string> },
    ) {
        await this.notificationService.broadcastNotification(
            { title: payload.title, body: payload.body },
            payload.data || {},
        );

        return {
            success: true,
            message: 'Notification broadcast to all users',
        };
    }

    @Post(':id/read')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Mark a notification as read' })
    @ApiResponse({ status: 200, description: 'Notification marked as read' })
    @ApiBearerAuth()
    async markAsRead(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
        const notification = await this.notificationService.markAsRead(userId, id);
        return {
            success: true,
            data: notification,
        };
    }

    @Post('mark-all-read')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Mark all notifications as read' })
    @ApiResponse({ status: 200, description: 'All notifications marked as read' })
    @ApiBearerAuth()
    async markAllAsRead(@CurrentUser('id') userId: string) {
        await this.notificationService.markAllAsRead(userId);
        return {
            success: true,
            message: 'All notifications marked as read',
        };
    }
}
