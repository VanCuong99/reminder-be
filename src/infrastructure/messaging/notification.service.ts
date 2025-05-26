import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { FirebaseService } from '../firestore/firebase.service';
import { RedisService } from '../cache/redis.service';
import { DeviceTokenService } from '../../application/services/device-token/device-token.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GuestDevice } from '../../domain/entities/guest-device.entity';
import retry from 'async-retry';

import { NotificationResult } from './notification-result.interface';
import {
    DEFAULT_EXPIRATION_DAYS,
    FCM_BATCH_SIZE,
    FCM_TTL_IN_SECONDS,
    FCM_TOKEN_MIN_LENGTH,
    FCM_TOKEN_MAX_LENGTH,
    FCM_RATE_LIMIT_MAX_REQUESTS,
    FCM_RATE_LIMIT_TIMEOUT,
    FCM_RETRY_ATTEMPTS,
    FCM_RETRY_FACTOR,
    FCM_RETRY_MIN_TIMEOUT,
    FCM_RETRY_MAX_TIMEOUT,
    MILLISECONDS_PER_DAY,
} from '../../shared/constants/constants';

@Injectable()
export class NotificationService implements OnModuleInit {
    private readonly logger = new Logger(NotificationService.name);

    // Firebase Cloud Messaging constants
    private readonly BATCH_SIZE: number;
    private readonly TTL_IN_SECONDS: number;
    private readonly FCM_TOKEN_MIN_LENGTH: number;
    private readonly FCM_TOKEN_MAX_LENGTH: number;
    private readonly FCM_RATE_LIMIT_MAX_REQUESTS: number;
    private readonly FCM_RATE_LIMIT_TIMEOUT: number;

    // Notification expiration constants
    private readonly NOTIFICATION_EXPIRATION_DAYS: number;
    private readonly MILLISECONDS_PER_DAY: number;

    // Retry mechanism configuration
    private readonly retryAttempts: number;
    private readonly retryFactor: number;
    private readonly retryMinTimeout: number;
    private readonly retryMaxTimeout: number;

    private firebaseApp: admin.app.App;
    private readonly isDevMode: boolean;

    constructor(
        private readonly configService: ConfigService,
        private readonly firebaseService: FirebaseService,
        private readonly redisService: RedisService,
        @InjectRepository(GuestDevice)
        private readonly guestDeviceRepository: Repository<GuestDevice>,
        private readonly deviceTokenService?: DeviceTokenService,
    ) {
        this.isDevMode = this.configService.get('NODE_ENV') !== 'production';

        // Initialize FCM configuration from environment variables or use defaults
        this.BATCH_SIZE = this.configService.get<number>('FCM_BATCH_SIZE') || FCM_BATCH_SIZE;
        this.TTL_IN_SECONDS =
            this.configService.get<number>('FCM_TTL_IN_SECONDS') || FCM_TTL_IN_SECONDS;
        this.FCM_TOKEN_MIN_LENGTH =
            this.configService.get<number>('FCM_TOKEN_MIN_LENGTH') || FCM_TOKEN_MIN_LENGTH;
        this.FCM_TOKEN_MAX_LENGTH =
            this.configService.get<number>('FCM_TOKEN_MAX_LENGTH') || FCM_TOKEN_MAX_LENGTH;
        this.FCM_RATE_LIMIT_MAX_REQUESTS =
            this.configService.get<number>('FCM_RATE_LIMIT_MAX_REQUESTS') ||
            FCM_RATE_LIMIT_MAX_REQUESTS;
        this.FCM_RATE_LIMIT_TIMEOUT =
            this.configService.get<number>('FCM_RATE_LIMIT_TIMEOUT') || FCM_RATE_LIMIT_TIMEOUT;

        // Initialize notification expiration configuration
        this.NOTIFICATION_EXPIRATION_DAYS =
            this.configService.get<number>('NOTIFICATION_EXPIRATION_DAYS') ||
            DEFAULT_EXPIRATION_DAYS;
        this.MILLISECONDS_PER_DAY = MILLISECONDS_PER_DAY;

        // Initialize retry configuration
        this.retryAttempts =
            this.configService.get<number>('FCM_RETRY_ATTEMPTS') || FCM_RETRY_ATTEMPTS;
        this.retryFactor = this.configService.get<number>('FCM_RETRY_FACTOR') || FCM_RETRY_FACTOR;
        this.retryMinTimeout =
            this.configService.get<number>('FCM_RETRY_MIN_TIMEOUT') || FCM_RETRY_MIN_TIMEOUT;
        this.retryMaxTimeout =
            this.configService.get<number>('FCM_RETRY_MAX_TIMEOUT') || FCM_RETRY_MAX_TIMEOUT;
    }

    async onModuleInit() {
        try {
            // Initialize Firebase if not already initialized
            if (admin.apps.length === 0) {
                let firebaseConfig = this.configService.get('FIREBASE_CONFIG');

                // If FIREBASE_CONFIG is not set, try to build config from individual environment variables
                if (!firebaseConfig) {
                    const projectId = this.configService.get('FIREBASE_PROJECT_ID');
                    const clientEmail = this.configService.get('FIREBASE_CLIENT_EMAIL');
                    const privateKey = this.configService.get('FIREBASE_PRIVATE_KEY');
                    const privateKeyId = this.configService.get('FIREBASE_PRIVATE_KEY_ID');

                    if (projectId && clientEmail && privateKey) {
                        this.logger.log(
                            'Building Firebase config from individual environment variables',
                        );
                        firebaseConfig = {
                            type: 'service_account',
                            project_id: projectId,
                            private_key_id: privateKeyId,
                            private_key: privateKey,
                            client_email: clientEmail,
                            client_id: this.configService.get('FIREBASE_CLIENT_ID'),
                            auth_uri: this.configService.get('FIREBASE_AUTH_URI'),
                            token_uri: this.configService.get('FIREBASE_TOKEN_URI'),
                            auth_provider_x509_cert_url: this.configService.get(
                                'FIREBASE_AUTH_PROVIDER_X509_CERT_URL',
                            ),
                            client_x509_cert_url: this.configService.get(
                                'FIREBASE_CLIENT_X509_CERT_URL',
                            ),
                            universe_domain: this.configService.get('FIREBASE_UNIVERSE_DOMAIN'),
                        };
                    }
                }

                // If config is provided as a string, parse it
                const config =
                    typeof firebaseConfig === 'string'
                        ? JSON.parse(firebaseConfig)
                        : firebaseConfig;

                this.firebaseApp = admin.initializeApp({
                    credential: admin.credential.cert(config),
                });
            } else {
                this.firebaseApp = admin.app();
            }

            this.logger.log('Firebase initialized successfully for notifications');
        } catch (error) {
            this.logger.error(`Failed to initialize Firebase: ${error.message}`, error.stack);
        }
    }

    /**
     * Send notification to a single token
     * This implementation includes retry mechanism for FCM calls
     */
    async sendNotification(
        token: string,
        notification: { title: string; body: string },
        data: Record<string, string> = {},
    ): Promise<NotificationResult> {
        if (!this.firebaseApp) {
            return { success: false, error: 'Firebase app not initialized' };
        }

        // Validate FCM token format
        if (!this.isValidFcmToken(token)) {
            return { success: false, error: 'Invalid FCM token format' };
        }

        try {
            // Rate limit for FCM calls
            await this.applyRateLimit('fcm_send');

            // Use async-retry to handle retries with exponential backoff
            const result = await retry(
                async bail => {
                    try {
                        const messaging = this.firebaseApp.messaging();
                        const messageId = await messaging.send({
                            token,
                            notification,
                            data,
                            android: {
                                priority: 'high',
                                notification: { sound: 'default' },
                            },
                            apns: {
                                payload: {
                                    aps: {
                                        sound: 'default',
                                        badge: 1,
                                    },
                                },
                            },
                        });

                        return {
                            success: true,
                            messageId,
                        };
                    } catch (error: any) {
                        // Don't retry for permanent errors like invalid tokens
                        if (
                            error.code === 'messaging/invalid-registration-token' ||
                            error.code === 'messaging/registration-token-not-registered'
                        ) {
                            // Deactivate invalid token if token service is available
                            if (this.deviceTokenService) {
                                await this.deviceTokenService.deactivateToken(token);
                            }
                            // Bail out with the error (don't retry)
                            bail(error);
                            return {
                                success: false,
                                error: 'Invalid or expired FCM token - token has been deactivated',
                            };
                        }

                        // For network or server errors, throw to trigger retry
                        if (
                            error.code === 'messaging/server-unavailable' ||
                            error.code === 'messaging/internal-error' ||
                            error.code === 'messaging/unknown-error' ||
                            error.message?.toLowerCase().includes('network') ||
                            error.message?.toLowerCase().includes('timeout')
                        ) {
                            this.logger.warn(`FCM call failed, will retry: ${error.message}`);
                            throw error; // This will trigger retry
                        }

                        // For any other errors, bail out
                        bail(error);
                        return {
                            success: false,
                            error: error.message ?? 'Unknown error sending notification',
                        };
                    }
                },
                {
                    retries: this.retryAttempts,
                    factor: this.retryFactor,
                    minTimeout: this.retryMinTimeout,
                    maxTimeout: this.retryMaxTimeout,
                    onRetry: (error: Error, attempt) => {
                        this.logger.log(
                            `Retry attempt ${attempt} for token ${token.substring(0, 10)}...: ${error.message}`,
                        );
                    },
                },
            );

            if (result && typeof result === 'object' && result.success === true) {
                return result;
            } else if (
                result &&
                typeof result === 'object' &&
                result.success === false &&
                result.error
            ) {
                return result;
            } else {
                // Defensive: ensure we never return null/undefined
                // If the retry threw an error, the catch block below will handle it
                return { success: false, error: 'Unknown error sending notification' };
            }
        } catch (error: any) {
            this.logger.error(
                `Failed to send notification after retries: ${error.message}`,
                error.stack,
            );

            // Handle invalid token errors
            if (
                error.code === 'messaging/invalid-registration-token' ||
                error.code === 'messaging/registration-token-not-registered'
            ) {
                // Deactivate invalid token if token service is available
                if (this.deviceTokenService) {
                    await this.deviceTokenService.deactivateToken(token);
                }
                return {
                    success: false,
                    error: 'Invalid or expired FCM token - token has been deactivated',
                };
            }

            // If error is an Error object with message, return its message
            if (error instanceof Error && error.message) {
                return { success: false, error: error.message };
            }

            // If error is an object with a message property
            if (error && typeof error.message === 'string') {
                return { success: false, error: error.message };
            }

            // Otherwise, fallback
            return { success: false, error: 'Unknown error sending notification' };
        }
    }

    /**
     * Send a push notification to a specific user
     */
    async sendNotificationToUser(
        userId: string,
        notification: { title: string; body: string },
        data: Record<string, string> = {},
    ): Promise<NotificationResult> {
        try {
            if (!this.deviceTokenService) {
                return { success: false, error: 'Device token service not available' };
            }

            // Get user's active device tokens
            const tokens = await this.deviceTokenService.getUserActiveTokens(userId);

            if (!tokens || tokens.length === 0) {
                return { success: false, error: 'No active device tokens found for user' };
            }

            const tokenValues = tokens.map(t => t.token);

            // Store notification in Firestore
            const notificationId = await this.storeNotification(userId, notification, data);

            // Add notification ID to data payload
            const notificationData = {
                ...data,
                notificationId,
            };

            // Send push notifications to all user tokens
            const results = await this.sendMulticastNotification(
                tokenValues,
                notification,
                notificationData,
            );

            return results;
        } catch (error) {
            this.logger.error(`Failed to send user notification: ${error.message}`, error.stack);
            return { success: false, error: error.message };
        }
    }

    /**
     * Broadcast notification to all users
     */
    async broadcastNotification(
        notification: { title: string; body: string },
        data: Record<string, string> = {},
    ): Promise<NotificationResult> {
        try {
            if (!this.deviceTokenService) {
                return { success: false, error: 'Device token service not available' };
            }

            // Get all active tokens
            const tokens = await this.deviceTokenService.getAllActiveTokens();

            if (!tokens || tokens.length === 0) {
                return { success: false, error: 'No active FCM tokens found' };
            }

            const tokenValues = tokens.map(t => t.token);

            // Send notification to all tokens
            const result = await this.sendMulticastNotification(tokenValues, notification, data);

            return result;
        } catch (error) {
            this.logger.error(`Failed to broadcast notification: ${error.message}`, error.stack);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send notification to a topic
     */
    async sendTopicNotification(
        topic: string,
        notification: { title: string; body: string },
        data: Record<string, string> = {},
    ): Promise<NotificationResult> {
        if (!this.firebaseApp) {
            return { success: false, error: 'Firebase app not initialized' };
        }

        try {
            // Validate topic format
            if (!/^[a-zA-Z0-9-_.~%]+$/.exec(topic)) {
                return { success: false, error: 'Invalid topic format' };
            }

            // Rate limit for FCM calls
            await this.applyRateLimit('fcm_topic_send');

            const messaging = this.firebaseApp.messaging();
            const messageId = await messaging.send({
                topic,
                notification,
                data,
                android: {
                    priority: 'high',
                    notification: { sound: 'default' },
                },
                apns: {
                    payload: {
                        aps: {
                            sound: 'default',
                            badge: 1,
                        },
                    },
                },
            });

            return {
                success: true,
                messageId,
                successCount: 1,
                failureCount: 0,
                messageIds: [messageId],
            };
        } catch (error) {
            this.logger.error(`Failed to send topic notification: ${error.message}`, error.stack);
            return {
                success: false,
                error: error.message,
                successCount: 0,
                failureCount: 1,
                messageIds: [],
            };
        }
    }

    /**
     * Send notifications to multiple device tokens
     */
    private async sendMulticastNotification(
        tokens: string[],
        notification: { title: string; body: string },
        data: Record<string, string> = {},
    ): Promise<NotificationResult> {
        if (!tokens.length) {
            return {
                success: false,
                error: 'No valid FCM tokens found',
                successCount: 0,
                failureCount: 0,
                messageIds: [],
            };
        }

        if (!this.firebaseApp) {
            return {
                success: false,
                error: 'Firebase app not initialized',
                successCount: 0,
                failureCount: tokens.length,
                messageIds: [],
            };
        }

        try {
            const messaging = this.firebaseApp.messaging();
            const validTokens = tokens.filter(token => this.isValidFcmToken(token));

            if (!validTokens.length) {
                return {
                    success: false,
                    error: 'No valid FCM token formats found',
                    successCount: 0,
                    failureCount: tokens.length,
                    messageIds: [],
                };
            }

            // Process tokens in batches
            let totalSuccess = 0;
            let totalFailure = 0;
            const messageIds = [];

            for (let i = 0; i < validTokens.length; i += this.BATCH_SIZE) {
                const batchTokens = validTokens.slice(i, i + this.BATCH_SIZE);

                // Rate limit to avoid FCM throttling
                await this.applyRateLimit('fcm_multicast');

                const response = await messaging.sendEachForMulticast({
                    tokens: batchTokens,
                    notification,
                    data,
                    android: {
                        priority: 'high',
                        notification: {
                            sound: 'default',
                            channelId: 'default',
                        },
                    },
                    apns: {
                        payload: {
                            aps: {
                                sound: 'default',
                                badge: 1,
                            },
                        },
                    },
                });

                // Handle results
                totalSuccess += response.successCount;
                totalFailure += response.failureCount;

                // Add message IDs
                if (response.responses) {
                    response.responses.forEach((resp, idx) => {
                        if (resp.success && resp.messageId) {
                            messageIds.push(resp.messageId);
                        }
                    });
                }

                // Handle failed tokens
                await this.handleInvalidTokens(response, batchTokens);
            }

            return {
                success: totalSuccess > 0,
                successCount: totalSuccess,
                failureCount: totalFailure,
                messageIds,
            };
        } catch (error) {
            this.logger.error(
                `Failed to send multicast notifications: ${error.message}`,
                error.stack,
            );
            return {
                success: false,
                error: error.message,
                successCount: 0,
                failureCount: tokens.length,
                messageIds: [],
            };
        }
    }

    /**
     * Store notification in Firestore
     */
    private async storeNotification(
        userId: string,
        notification: { title: string; body: string },
        data: Record<string, string> = {},
    ): Promise<string> {
        const firestore = this.firebaseService.getFirestore();
        const notificationRef = firestore
            .collection('users')
            .doc(userId)
            .collection('notifications')
            .doc();

        await notificationRef.set({
            title: notification.title,
            body: notification.body,
            data,
            status: 'unread',
            type: 'push',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(
                Date.now() + this.NOTIFICATION_EXPIRATION_DAYS * this.MILLISECONDS_PER_DAY,
            ).toISOString(),
        });

        return notificationRef.id;
    }

    /**
     * Store notification in Firestore for guest users
     */
    private async storeGuestNotification(
        deviceId: string,
        notification: { title: string; body: string },
        data: Record<string, string> = {},
    ): Promise<string> {
        const firestore = this.firebaseService.getFirestore();
        const notificationRef = firestore
            .collection('guest_devices')
            .doc(deviceId)
            .collection('notifications')
            .doc();

        await notificationRef.set({
            title: notification.title,
            body: notification.body,
            data,
            status: 'unread',
            type: 'push',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(
                Date.now() + this.NOTIFICATION_EXPIRATION_DAYS * this.MILLISECONDS_PER_DAY,
            ).toISOString(),
        });

        return notificationRef.id;
    }

    /**
     * Handle invalid tokens from multicast response
     */
    private async handleInvalidTokens(
        response: admin.messaging.BatchResponse,
        tokens: string[],
    ): Promise<void> {
        if (!response.failureCount || !this.deviceTokenService) return;

        const invalidTokens = [];

        response.responses.forEach((resp, idx) => {
            if (!resp.success && resp.error) {
                const errorCode = resp.error.code;

                // Only handle permanent failures
                if (
                    errorCode === 'messaging/invalid-registration-token' ||
                    errorCode === 'messaging/registration-token-not-registered'
                ) {
                    invalidTokens.push(tokens[idx]);
                }
            }
        });

        // Deactivate invalid tokens
        for (const token of invalidTokens) {
            try {
                await this.deviceTokenService.deactivateToken(token);
                this.logger.debug(`Deactivated invalid token: ${token}`);
            } catch (error) {
                this.logger.error(`Failed to deactivate token: ${error.message}`);
            }
        }
    }

    /**
     * Apply rate limiting for FCM API calls
     */
    private async applyRateLimit(key: string): Promise<void> {
        try {
            // Simple token bucket algorithm
            const currentCount = (await this.redisService.get(`rate_limit:${key}`)) || '0';
            const count = parseInt(currentCount);

            if (count >= this.FCM_RATE_LIMIT_MAX_REQUESTS) {
                // Wait before proceeding
                await new Promise(resolve => setTimeout(resolve, this.FCM_RATE_LIMIT_TIMEOUT));
                return this.applyRateLimit(key);
            }

            // Increment counter
            await this.redisService.set(
                `rate_limit:${key}`,
                (count + 1).toString(),
                1, // TTL 1 second
            );
        } catch (error) {
            // If Redis is down, continue anyway but log the error
            this.logger.error(`Rate limit error: ${error.message}`);
        }
    }

    /**
     * Validate FCM token format
     */
    private isValidFcmToken(token: string): boolean {
        // FCM tokens are typically 140+ characters and contain only alphanumeric characters plus -_
        return Boolean(
            token &&
                typeof token === 'string' &&
                token.length >= this.FCM_TOKEN_MIN_LENGTH &&
                token.length <= this.FCM_TOKEN_MAX_LENGTH &&
                /^[a-zA-Z0-9_-]+$/.test(token),
        );
    }

    private getFirebaseAppInternal(): admin.app.App {
        return this.firebaseApp;
    }

    /**
     * Get user notifications
     */
    async getUserNotifications(
        userId: string,
        options: {
            page?: number;
            limit?: number;
            status?: string;
        } = {},
    ): Promise<{ notifications: any[]; count: number }> {
        const firestore = this.firebaseService.getFirestore();
        const page = options.page || 1;
        const limit = options.limit || 20;

        try {
            // Build query
            let query = firestore
                .collection('users')
                .doc(userId)
                .collection('notifications')
                .orderBy('createdAt', 'desc');

            // Add status filter if provided
            if (options.status) {
                query = query.where('status', '==', options.status);
            }

            // Get total count (in a real app, this should be optimized)
            const snapshot = await query.get();
            const total = snapshot.docs.length;

            // Get paginated results
            const paginated = await query
                .limit(limit)
                .offset((page - 1) * limit)
                .get();

            const notifications = paginated.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));

            return {
                notifications,
                count: total,
            };
        } catch (error) {
            this.logger.error(`Failed to get notifications: ${error.message}`);
            return {
                notifications: [],
                count: 0,
            };
        }
    }

    /**
     * Get guest device notifications
     */
    async getGuestNotifications(
        deviceId: string,
        options: {
            page?: number;
            limit?: number;
            status?: string;
        } = {},
    ): Promise<{ notifications: any[]; count: number }> {
        const firestore = this.firebaseService.getFirestore();
        const page = options.page || 1;
        const limit = options.limit || 20;

        try {
            // Build query
            let query = firestore
                .collection('guest_devices')
                .doc(deviceId)
                .collection('notifications')
                .orderBy('createdAt', 'desc');

            // Add status filter if provided
            if (options.status) {
                query = query.where('status', '==', options.status);
            }

            // Get total count
            const snapshot = await query.get();
            const total = snapshot.docs.length;

            // Get paginated results
            const paginated = await query
                .limit(limit)
                .offset((page - 1) * limit)
                .get();

            const notifications = paginated.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));

            return {
                notifications,
                count: total,
            };
        } catch (error) {
            this.logger.error(`Failed to get guest notifications: ${error.message}`);
            return {
                notifications: [],
                count: 0,
            };
        }
    }

    /**
     * Mark notification as read
     */
    async markAsRead(userId: string, notificationId: string): Promise<any> {
        try {
            const firestore = this.firebaseService.getFirestore();
            const notificationRef = firestore
                .collection('users')
                .doc(userId)
                .collection('notifications')
                .doc(notificationId);

            const notificationDoc = await notificationRef.get();

            if (!notificationDoc.exists) {
                this.logger.warn(`Notification ${notificationId} not found for user ${userId}`);
                return null;
            }

            await notificationRef.update({
                status: 'read',
                readAt: new Date().toISOString(),
            });

            return {
                id: notificationId,
                ...notificationDoc.data(),
                status: 'read',
                readAt: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error(`Failed to mark notification as read: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Mark guest notification as read
     */
    async markGuestNotificationAsRead(deviceId: string, notificationId: string): Promise<any> {
        try {
            const firestore = this.firebaseService.getFirestore();
            const notificationRef = firestore
                .collection('guest_devices')
                .doc(deviceId)
                .collection('notifications')
                .doc(notificationId);

            const notificationDoc = await notificationRef.get();

            if (!notificationDoc.exists) {
                this.logger.warn(
                    `Notification ${notificationId} not found for guest device ${deviceId}`,
                );
                return null;
            }

            await notificationRef.update({
                status: 'read',
                readAt: new Date().toISOString(),
            });

            return {
                id: notificationId,
                ...notificationDoc.data(),
                status: 'read',
                readAt: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error(
                `Failed to mark guest notification as read: ${error.message}`,
                error.stack,
            );
            throw error;
        }
    }

    /**
     * Mark all notifications as read
     */
    async markAllAsRead(userId: string): Promise<void> {
        try {
            const firestore = this.firebaseService.getFirestore();
            const notificationsRef = firestore
                .collection('users')
                .doc(userId)
                .collection('notifications')
                .where('status', '==', 'unread');

            const snapshot = await notificationsRef.get();

            if (snapshot.empty) {
                return;
            }

            // Use batched writes for better performance
            const batch = firestore.batch();
            const now = new Date().toISOString();

            snapshot.docs.forEach(doc => {
                batch.update(doc.ref, {
                    status: 'read',
                    readAt: now,
                });
            });

            await batch.commit();
        } catch (error) {
            this.logger.error(`Failed to mark all notifications as read: ${error.message}`);
            throw error;
        }
    }

    /**
     * Send a push notification to a guest device
     */
    async sendNotificationToDevice(
        deviceId: string,
        title: string,
        body: string,
        data: Record<string, string> = {},
    ): Promise<NotificationResult> {
        try {
            // Find guest device
            const guestDevice = await this.guestDeviceRepository.findOne({
                where: { deviceId, isActive: true },
            });

            if (!guestDevice?.firebaseToken) {
                return { success: false, error: 'No active firebase token found for guest device' };
            }

            // Store notification in Firestore for guests
            const notificationId = await this.storeGuestNotification(
                deviceId,
                { title, body },
                data,
            );

            // Add notification ID to data payload
            const notificationData = {
                ...data,
                notificationId,
                isGuest: 'true',
            };

            // Send push notification
            const result = await this.sendNotification(
                guestDevice.firebaseToken,
                { title, body },
                notificationData,
            );

            return result;
        } catch (error) {
            this.logger.error(`Failed to send guest notification: ${error.message}`, error.stack);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send notification to multiple devices using tokens
     * Use this for batched notification sending instead of calling sendNotificationToDevice multiple times
     * @param tokens Array of FCM tokens
     * @param title Notification title
     * @param body Notification body
     * @param data Optional data payload
     */
    async sendNotificationToBatch(
        tokens: string[],
        title: string,
        body: string,
        data: Record<string, string> = {},
    ): Promise<NotificationResult> {
        try {
            const notification = { title, body };
            const results = await this.sendMulticastNotification(tokens, notification, data);

            return results;
        } catch (error) {
            this.logger.error(`Failed to send batch notifications: ${error.message}`, error.stack);
            return {
                success: false,
                error: error.message,
                successCount: 0,
                failureCount: tokens.length,
                messageIds: [],
            };
        }
    }

    /**
     * Send a push notification to multiple users
     * More efficient than calling sendNotificationToUser for each user
     */
    async sendNotificationToUsers(
        userIds: string[],
        notification: { title: string; body: string },
        data: Record<string, string> = {},
    ): Promise<NotificationResult> {
        try {
            if (!this.deviceTokenService) {
                return { success: false, error: 'Device token service not available' };
            }

            if (!userIds.length) {
                return { success: false, error: 'No user IDs provided' };
            }

            // Get tokens for all users in one batch query
            const allTokens = await this.deviceTokenService.getTokensForMultipleUsers(userIds);

            if (!allTokens?.length) {
                return { success: false, error: 'No active device tokens found for users' };
            }

            const tokenValues = allTokens.map(t => t.token);

            // Store notifications in Firestore - could be batched in future if needed
            const notificationPromises = userIds.map(userId =>
                this.storeNotification(userId, notification, data),
            );

            await Promise.all(notificationPromises);

            // Send push notifications to all tokens in a single multicast call
            const results = await this.sendMulticastNotification(tokenValues, notification, data);

            return results;
        } catch (error) {
            this.logger.error(
                `Failed to send notifications to multiple users: ${error.message}`,
                error.stack,
            );
            return { success: false, error: error.message };
        }
    }
}
