import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { DeviceTokenService } from '../../application/services/device-token/device-token.service';

@Injectable()
export class NotificationService implements OnModuleInit {
    private firebaseApp: admin.app.App;
    private readonly logger = new Logger(NotificationService.name);

    constructor(
        private readonly configService: ConfigService,
        private readonly deviceTokenService: DeviceTokenService,
    ) {}

    async onModuleInit() {
        try {
            const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');
            if (!privateKey) {
                throw new Error('Firebase private key is not configured');
            }

            const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');

            this.firebaseApp = admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: this.configService.get('FIREBASE_PROJECT_ID'),
                    clientEmail: this.configService.get('FIREBASE_CLIENT_EMAIL'),
                    privateKey: formattedPrivateKey,
                }),
            });

            this.logger.log('Firebase initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize Firebase:', error);
            throw error;
        }
    }

    private validateTokenFormat(token: string): boolean {
        const isTestMode = this.configService.get('NODE_ENV') !== 'production';

        if (isTestMode && token.startsWith('test_')) {
            return true;
        }

        // Production validation: FCM tokens are base64 strings typically 140-200 characters
        const fcmTokenRegex = /^[A-Za-z0-9_-]{140,200}$/;
        return fcmTokenRegex.test(token);
    }

    private isTestToken(token: string): boolean {
        return token.startsWith('test_');
    }

    private mockSendMessage(
        token: string,
        notification: { title: string; body: string },
        data?: Record<string, string>,
    ): Promise<string> {
        this.logger.log(`[MOCK] Sending notification to test token: ${token}`);
        this.logger.log(`[MOCK] Notification:`, { notification, data });
        return Promise.resolve(`mock-message-id-${Date.now()}`);
    }

    private mockSendMulticast(
        tokens: string[],
        notification: { title: string; body: string },
        data?: Record<string, string>,
    ): Promise<admin.messaging.BatchResponse> {
        this.logger.log(`[MOCK] Sending multicast notification to test tokens:`, tokens);
        this.logger.log(`[MOCK] Notification:`, { notification, data });

        const responses = tokens.map(token => ({
            success: true,
            messageId: `mock-message-id-${Date.now()}-${token}`,
        }));

        return Promise.resolve({
            responses,
            successCount: tokens.length,
            failureCount: 0,
        });
    }

    async sendNotification(
        token: string,
        notification: { title: string; body: string },
        data?: Record<string, string>,
    ) {
        try {
            if (!this.validateTokenFormat(token)) {
                this.logger.warn(`Invalid token format: ${token}`);
                return {
                    success: false,
                    error: 'Invalid FCM token format',
                };
            }

            const isTestMode = this.configService.get('NODE_ENV') !== 'production';
            if (isTestMode && this.isTestToken(token)) {
                const messageId = await this.mockSendMessage(token, notification, data);
                return {
                    success: true,
                    messageId,
                };
            }

            const message: admin.messaging.Message = {
                token,
                notification: {
                    title: notification.title,
                    body: notification.body,
                },
                data,
            };

            this.logger.debug('Sending Firebase message:', message);
            const response = await this.firebaseApp.messaging().send(message);
            this.logger.log('Firebase response:', response);
            return {
                success: true,
                messageId: response,
            };
        } catch (error) {
            this.logger.error('Error sending notification:', error);

            if (
                error?.code === 'messaging/invalid-argument' ||
                error?.code === 'messaging/invalid-registration-token' ||
                error?.code === 'messaging/registration-token-not-registered'
            ) {
                await this.deviceTokenService.deactivateToken(token);
                return {
                    success: false,
                    error: 'Invalid or expired FCM token - token has been deactivated',
                };
            }

            return {
                success: false,
                error: error.message,
            };
        }
    }

    async sendNotificationToUser(
        userId: string,
        notification: { title: string; body: string },
        data?: Record<string, string>,
    ) {
        this.logger.log(`Sending notification to user ${userId}`);
        const deviceTokens = await this.deviceTokenService.getUserActiveTokens(userId);
        this.logger.log(`Found ${deviceTokens.length} active device tokens for user`);

        if (deviceTokens.length === 0) {
            this.logger.warn('No active device tokens found for user');
            return {
                success: false,
                error: 'No active device tokens found for user',
            };
        }

        const validTokens = deviceTokens
            .map(dt => dt.token)
            .filter(token => this.validateTokenFormat(token));

        if (validTokens.length === 0) {
            this.logger.warn('No valid tokens found among active tokens');
            return {
                success: false,
                error: 'No valid FCM tokens found for user',
            };
        }

        this.logger.log(`Attempting to send notification with title: ${notification.title}`);
        const result = await this.sendMulticastNotification(validTokens, notification, data);
        this.logger.log('Notification result:', result);
        return result;
    }

    async broadcastNotification(
        notification: { title: string; body: string },
        data?: Record<string, string>,
    ) {
        this.logger.log('Starting broadcast notification');
        const deviceTokens = await this.deviceTokenService.getAllActiveTokens();
        this.logger.log(`Found ${deviceTokens.length} total active device tokens`);

        if (deviceTokens.length === 0) {
            this.logger.warn('No active device tokens found');
            return {
                success: false,
                error: 'No active device tokens found',
            };
        }

        const validTokens = deviceTokens
            .map(dt => dt.token)
            .filter(token => this.validateTokenFormat(token));

        if (validTokens.length === 0) {
            this.logger.warn('No valid tokens found among active tokens');
            return {
                success: false,
                error: 'No valid FCM tokens found',
            };
        }

        const result = await this.sendMulticastNotification(validTokens, notification, data);
        this.logger.log('Broadcast result:', result);
        return result;
    }

    async sendTopicNotification(
        topic: string,
        notification: { title: string; body: string },
        data?: Record<string, string>,
    ) {
        try {
            this.logger.log(`Sending notification to topic: ${topic}`);
            const message: admin.messaging.Message = {
                topic,
                notification: {
                    title: notification.title,
                    body: notification.body,
                },
                data,
            };

            this.logger.debug('Sending Firebase topic message:', message);
            const response = await this.firebaseApp.messaging().send(message);
            this.logger.log('Firebase topic response:', response);

            return {
                success: true,
                messageIds: [response],
                successCount: 1,
                failureCount: 0,
            };
        } catch (error) {
            this.logger.error('Error sending topic notification:', error);
            return {
                success: false,
                error: error.message,
                messageIds: [],
                successCount: 0,
                failureCount: 1,
            };
        }
    }

    private async sendMulticastNotification(
        tokens: string[],
        notification: { title: string; body: string },
        data?: Record<string, string>,
    ) {
        try {
            this.logger.log(`Sending multicast notification to ${tokens.length} devices`);
            const chunkSize = 500;
            const results = [];

            const isTestMode = this.configService.get('NODE_ENV') !== 'production';
            const hasTestTokens = tokens.some(token => this.isTestToken(token));

            for (let i = 0; i < tokens.length; i += chunkSize) {
                const chunk = tokens.slice(i, i + chunkSize);

                let response;
                if (isTestMode && hasTestTokens) {
                    response = await this.mockSendMulticast(chunk, notification, data);
                } else {
                    const message: admin.messaging.MulticastMessage = {
                        tokens: chunk,
                        notification: {
                            title: notification.title,
                            body: notification.body,
                        },
                        data,
                    };

                    this.logger.debug('Sending Firebase message:', message);
                    response = await this.firebaseApp.messaging().sendEachForMulticast(message);
                }

                this.logger.log('Firebase response:', response);
                results.push(response);

                if (!isTestMode || !hasTestTokens) {
                    await this.handleInvalidTokens(response, chunk);
                }
            }

            const successCount = results.reduce((acc, res) => acc + res.successCount, 0);
            const failureCount = results.reduce((acc, res) => acc + res.failureCount, 0);

            this.logger.log(
                `Notification sent. Success: ${successCount}, Failures: ${failureCount}`,
            );

            return {
                success: successCount > 0,
                error: failureCount > 0 ? `Failed to send to ${failureCount} devices` : null,
                messageIds: results.flatMap(r =>
                    r.responses.filter(resp => resp.success).map(resp => resp.messageId),
                ),
                successCount,
                failureCount,
            };
        } catch (error) {
            this.logger.error('Error sending multicast notification:', error);
            return {
                success: false,
                error: error.message,
                messageIds: [],
                successCount: 0,
                failureCount: tokens.length,
            };
        }
    }

    private async handleInvalidTokens(response: admin.messaging.BatchResponse, tokens: string[]) {
        const invalidTokenPromises = response.responses.map(async (resp, idx) => {
            if (
                resp.error?.code === 'messaging/invalid-registration-token' ||
                resp.error?.code === 'messaging/registration-token-not-registered'
            ) {
                this.logger.warn(`Deactivating invalid token: ${tokens[idx]}`);
                await this.deviceTokenService.deactivateToken(tokens[idx]);
            } else if (resp.error) {
                this.logger.warn(`Error for token ${tokens[idx]}:`, resp.error);
            }
        });

        await Promise.all(invalidTokenPromises);
    }
}
