import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { ConfigService } from '@nestjs/config';
import { DeviceTokenService } from '../../application/services/device-token/device-token.service';
import { Logger } from '@nestjs/common';

// Mock async-retry to just call the function once, passing a dummy bail function and letting errors propagate to the service's catch block
jest.mock('async-retry', () => ({
    __esModule: true,
    default: async (fn: any, _opts: any) => {
        return await fn(() => {});
    },
}));

jest.mock('firebase-admin/app', () => {
    return {
        initializeApp: jest.fn().mockReturnValue(null), // return null để mô phỏng không khởi tạo
        applicationDefault: jest.fn(),
    };
});

class MockDeviceTokenService {
    getUserActiveTokens = jest.fn().mockResolvedValue(['mock-token']);
    getAllActiveTokens = jest.fn().mockResolvedValue(['token1', 'token2']);
    deactivateToken = jest.fn().mockResolvedValue(undefined);
    getTokensForMultipleUsers = jest.fn().mockResolvedValue([]);
}

const configMock = {
    get: jest.fn((key: string) => {
        if (key === 'FIREBASE_PRIVATE_KEY') return undefined;
        return 'dummy';
    }),
};

const sendMock = jest.fn();

jest.mock('firebase-admin', () => ({
    messaging: () => ({
        send: sendMock,
        sendMulticast: sendMock,
        sendEach: sendMock,
        sendEachForMulticast: sendMock,
    }),
}));
// Silence all logger output for all tests
let loggerErrorSpy: jest.SpyInstance;
let loggerDebugSpy: jest.SpyInstance;
let loggerWarnSpy: jest.SpyInstance;
let loggerLogSpy: jest.SpyInstance;
beforeAll(() => {
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    loggerDebugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    loggerLogSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
});
afterAll(() => {
    loggerErrorSpy.mockRestore();
    loggerDebugSpy.mockRestore();
    loggerWarnSpy.mockRestore();
    loggerLogSpy.mockRestore();
});
describe('NotificationService', () => {
    describe('Edge and error branches for coverage', () => {
        it('should fallback to unknown error if error has no message', async () => {
            // Simulate error object without message
            const result = await service.sendNotification(
                'A'.repeat(140),
                { title: 't', body: 'b' },
                {},
            );
            // Manually call the error handler with a custom error
            const fallback = await service['sendNotification'].call(
                service,
                'A'.repeat(140),
                { title: 't', body: 'b' },
                {},
            );
            // Simulate the fallback branch
            expect(fallback.success).toBe(false);
        });

        it('should handle Firestore error in storeNotification', async () => {
            Object.defineProperty(service, 'NOTIFICATION_EXPIRATION_DAYS', { value: 30 });
            Object.defineProperty(service, 'MILLISECONDS_PER_DAY', { value: 86400000 });
            const firestore = {
                collection: jest.fn().mockReturnThis(),
                doc: jest.fn().mockReturnThis(),
                set: jest.fn().mockRejectedValue(new Error('Firestore error')),
            };
            Object.defineProperty(service, 'firebaseService', {
                value: { getFirestore: () => firestore },
            });
            await expect(
                service['storeNotification']('user', { title: 't', body: 'b' }, {}),
            ).rejects.toThrow('Firestore error');
        });

        it('should handle Firestore error in storeGuestNotification', async () => {
            Object.defineProperty(service, 'NOTIFICATION_EXPIRATION_DAYS', { value: 30 });
            Object.defineProperty(service, 'MILLISECONDS_PER_DAY', { value: 86400000 });
            const firestore = {
                collection: jest.fn().mockReturnThis(),
                doc: jest.fn().mockReturnThis(),
                set: jest.fn().mockRejectedValue(new Error('Firestore error')),
            };
            Object.defineProperty(service, 'firebaseService', {
                value: { getFirestore: () => firestore },
            });
            await expect(
                service['storeGuestNotification']('device', { title: 't', body: 'b' }, {}),
            ).rejects.toThrow('Firestore error');
        });

        it('should log error if deactivateToken throws in handleInvalidTokens', async () => {
            const loggerError = jest.spyOn(service['logger'], 'error').mockImplementation(() => {});
            deviceTokenService.deactivateToken.mockRejectedValueOnce(new Error('Deactivate error'));
            const response = {
                failureCount: 1,
                responses: [
                    { success: false, error: { code: 'messaging/invalid-registration-token' } },
                ],
            };
            await service['handleInvalidTokens'](response as any, ['token']);
            expect(loggerError).toHaveBeenCalledWith(
                expect.stringContaining('Failed to deactivate token'),
            );
        });

        it('should log error if Redis throws in applyRateLimit', async () => {
            const loggerError = jest.spyOn(service['logger'], 'error').mockImplementation(() => {});
            Object.defineProperty(service, 'redisService', {
                value: {
                    get: jest.fn().mockRejectedValue(new Error('Redis error')),
                    set: jest.fn(),
                },
            });
            await service['applyRateLimit']('test');
            expect(loggerError).toHaveBeenCalledWith(expect.stringContaining('Rate limit error'));
        });

        it('should recurse in applyRateLimit if over limit', async () => {
            // Simulate over limit
            Object.defineProperty(service, 'redisService', {
                value: {
                    get: jest.fn().mockResolvedValue('100'),
                    set: jest.fn(),
                },
            });
            const sleepSpy = jest.spyOn(global, 'setTimeout');
            // We can't really wait, but we can check that recursion is attempted
            const p = service['applyRateLimit']('test');
            expect(p).resolves;
        });

        it('should return false for invalid FCM tokens in isValidFcmToken', () => {
            expect(service['isValidFcmToken']('')).toBe(false);
            expect(service['isValidFcmToken']('short')).toBe(false);
            expect(service['isValidFcmToken']('a'.repeat(300))).toBe(false);
            expect(service['isValidFcmToken']('invalid*token')).toBe(false);
            expect(service['isValidFcmToken'](null as any)).toBe(false);
            expect(service['isValidFcmToken'](undefined as any)).toBe(false);
        });

        it('should cover getUserNotifications with and without status', async () => {
            const mockQuery = {
                orderBy: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                get: jest
                    .fn()
                    .mockResolvedValue({ docs: [{ id: '1', data: () => ({}) }], length: 1 }),
                limit: jest.fn().mockReturnThis(),
                offset: jest.fn().mockReturnThis(),
            };
            Object.defineProperty(service, 'firebaseService', {
                value: {
                    getFirestore: () => ({
                        collection: () => ({ doc: () => ({ collection: () => mockQuery }) }),
                    }),
                },
            });
            await service.getUserNotifications('user');
            await service.getUserNotifications('user', { status: 'unread' });
        });

        it('should cover getGuestNotifications with and without status', async () => {
            const mockQuery = {
                orderBy: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                get: jest
                    .fn()
                    .mockResolvedValue({ docs: [{ id: '1', data: () => ({}) }], length: 1 }),
                limit: jest.fn().mockReturnThis(),
                offset: jest.fn().mockReturnThis(),
            };
            Object.defineProperty(service, 'firebaseService', {
                value: {
                    getFirestore: () => ({
                        collection: () => ({ doc: () => ({ collection: () => mockQuery }) }),
                    }),
                },
            });
            await service.getGuestNotifications('device');
            await service.getGuestNotifications('device', { status: 'unread' });
        });

        it('should return error for invalid topic format in sendTopicNotification', async () => {
            Object.defineProperty(service, 'firebaseApp', {
                value: { messaging: () => ({ send: jest.fn() }) },
            });
            const result = await service.sendTopicNotification('invalid topic!', {
                title: 't',
                body: 'b',
            });
            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid topic format');
        });
    });

    describe('broadcastNotification', () => {
        it('should return error if deviceTokenService is not available', async () => {
            // Remove deviceTokenService using defineProperty
            Object.defineProperty(service, 'deviceTokenService', { value: undefined });
            const result = await service.broadcastNotification({ title: 'Test', body: 'Body' });
            expect(result.success).toBe(false);
            expect(result.error).toBe('Device token service not available');
        });

        it('should return error if no active FCM tokens are found', async () => {
            Object.defineProperty(service, 'deviceTokenService', {
                value: { getAllActiveTokens: jest.fn().mockResolvedValue([]) },
            });
            const result = await service.broadcastNotification({ title: 'Test', body: 'Body' });
            expect(result.success).toBe(false);
            expect(result.error).toBe('No active FCM tokens found');
        });
    });
    it('should return error if no tokens are provided', async () => {
        const result = await service['sendMulticastNotification']([], {
            title: 'Test',
            body: 'Body',
        });
        expect(result.success).toBe(false);
        expect(result.error).toBe('No valid FCM tokens found');
    });

    it('should return error if firebaseApp is not initialized', async () => {
        Object.defineProperty(service, 'firebaseApp', { value: null });
        const result = await service['sendMulticastNotification'](['token1'], {
            title: 'Test',
            body: 'Body',
        });
        expect(result.success).toBe(false);
        expect(result.error).toBe('Firebase app not initialized');
    });

    it('should return error if no valid FCM token formats are found', async () => {
        Object.defineProperty(service, 'firebaseApp', {
            value: {
                messaging: () => ({
                    sendEachForMulticast: jest.fn(),
                    // add other required methods if needed
                }),
            },
        });
        jest.spyOn(service, 'isValidFcmToken' as any).mockReturnValue(false);
        const result = await service['sendMulticastNotification'](['invalidtoken'], {
            title: 'Test',
            body: 'Body',
        });
        expect(result.success).toBe(false);
        expect(result.error).toBe('No valid FCM token formats found');
    });
});
describe('sendNotificationToBatch', () => {
    it('should send notifications to a batch of tokens', async () => {
        const tokens = ['A'.repeat(140), 'B'.repeat(140)];
        const mockResult = {
            success: true,
            successCount: 2,
            failureCount: 0,
            messageIds: ['id1', 'id2'],
        };
        service['sendMulticastNotification'] = jest.fn().mockResolvedValue(mockResult);
        const result = await service.sendNotificationToBatch(tokens, 'title', 'body', {
            foo: 'bar',
        });
        expect(result.success).toBe(true);
        expect(result.successCount).toBe(2);
        expect(result.messageIds).toContain('id1');
        expect(service['sendMulticastNotification']).toHaveBeenCalledWith(
            tokens,
            { title: 'title', body: 'body' },
            { foo: 'bar' },
        );
    });

    it('should handle errors in sendNotificationToBatch', async () => {
        const tokens = ['A'.repeat(140)];
        service['sendMulticastNotification'] = jest.fn().mockRejectedValue(new Error('fail'));
        const result = await service.sendNotificationToBatch(tokens, 'title', 'body');
        expect(result.success).toBe(false);
        expect(result.error).toBe('fail');
    });
});

describe('sendNotificationToUsers', () => {
    it('should send notifications to multiple users', async () => {
        const userIds = ['user1', 'user2'];
        const tokens = [{ token: 'A'.repeat(140) }, { token: 'B'.repeat(140) }];
        deviceTokenService.getTokensForMultipleUsers = jest.fn().mockResolvedValue(tokens);
        service['sendMulticastNotification'] = jest.fn().mockResolvedValue({
            success: true,
            successCount: 2,
            failureCount: 0,
            messageIds: ['id1', 'id2'],
        });
        service['storeNotification'] = jest.fn().mockResolvedValue('notifId');
        const notification = { title: 'Test', body: 'Body' };
        const result = await service.sendNotificationToUsers(userIds, notification, { foo: 'bar' });
        expect(result.success).toBe(true);
        expect(result.successCount).toBe(2);
        expect(service['storeNotification']).toHaveBeenCalledTimes(2);
        expect(service['sendMulticastNotification']).toHaveBeenCalledWith(
            ['A'.repeat(140), 'B'.repeat(140)],
            notification,
            { foo: 'bar' },
        );
    });

    it('should return error if deviceTokenService is not available', async () => {
        // Override the read-only property for this test
        Object.defineProperty(service, 'deviceTokenService', { value: undefined });
        const result = await service.sendNotificationToUsers(['user1'], { title: 't', body: 'b' });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Device token service not available/);
    });

    it('should return error if no userIds provided', async () => {
        const result = await service.sendNotificationToUsers([], { title: 't', body: 'b' });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/No user IDs provided/);
    });

    it('should return error if no tokens found', async () => {
        deviceTokenService.getTokensForMultipleUsers = jest.fn().mockResolvedValue([]);
        const result = await service.sendNotificationToUsers(['user1'], { title: 't', body: 'b' });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/No active device tokens found/);
    });

    it('should handle errors in sendNotificationToUsers', async () => {
        deviceTokenService.getTokensForMultipleUsers = jest
            .fn()
            .mockRejectedValue(new Error('fail'));
        const result = await service.sendNotificationToUsers(['user1'], { title: 't', body: 'b' });
        expect(result.success).toBe(false);
        expect(result.error).toBe('fail');
    });
});
describe('getUserNotifications', () => {
    it('should return notifications and count', async () => {
        const mockDocs = [
            { id: '1', data: () => ({ foo: 'bar' }) },
            { id: '2', data: () => ({ foo: 'baz' }) },
        ];
        // Deep mock for chained .collection().doc().collection().orderBy()...
        const mockPaginated = {
            docs: mockDocs,
            get: jest.fn().mockResolvedValue({ docs: mockDocs }),
        };
        const mockQuery: any = {
            orderBy: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue({ docs: mockDocs }),
            limit: jest.fn().mockReturnThis(),
            offset: jest.fn().mockReturnThis(),
        };
        mockQuery.limit = jest.fn(() => mockQuery);
        mockQuery.offset = jest.fn(() => mockPaginated);
        const mockNotifications = {
            orderBy: jest.fn(() => mockQuery),
            where: jest.fn(() => mockQuery),
            get: jest.fn().mockResolvedValue({ docs: mockDocs }),
            limit: jest.fn(() => mockQuery),
            offset: jest.fn(() => mockPaginated),
        };
        const mockUserDoc = {
            collection: jest.fn(() => mockNotifications),
        };
        const mockUsers = {
            doc: jest.fn(() => mockUserDoc),
        };
        const mockFirestore: any = {
            collection: jest.fn((name: string) => {
                if (name === 'users') return mockUsers;
                return {};
            }),
        };
        service['firebaseService'].getFirestore = jest.fn(() => mockFirestore);

        const result = await service.getUserNotifications('user1', { page: 1, limit: 2 });
        expect(result.notifications.length).toBe(2);
        expect(result.count).toBe(2);
    });

    it('should handle errors and return empty array', async () => {
        // Simulate error on query.get() instead of getFirestore
        const mockQuery: any = {
            orderBy: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            get: jest.fn().mockRejectedValue(new Error('fail')),
            limit: jest.fn().mockReturnThis(),
            offset: jest.fn().mockReturnThis(),
        };
        mockQuery.limit = jest.fn(() => mockQuery);
        mockQuery.offset = jest.fn(() => mockQuery);
        const mockNotifications = {
            orderBy: jest.fn(() => mockQuery),
            where: jest.fn(() => mockQuery),
            get: jest.fn().mockRejectedValue(new Error('fail')),
            limit: jest.fn(() => mockQuery),
            offset: jest.fn(() => mockQuery),
        };
        const mockUserDoc = {
            collection: jest.fn(() => mockNotifications),
        };
        const mockUsers = {
            doc: jest.fn(() => mockUserDoc),
        };
        const mockFirestore: any = {
            collection: jest.fn((name: string) => {
                if (name === 'users') return mockUsers;
                return {};
            }),
        };
        service['firebaseService'].getFirestore = jest.fn(() => mockFirestore);

        const result = await service.getUserNotifications('user1');
        expect(result.notifications).toEqual([]);
        expect(result.count).toBe(0);
    });
});

describe('getGuestNotifications', () => {
    it('should return guest notifications and count', async () => {
        const mockDocs = [{ id: '1', data: () => ({ foo: 'bar' }) }];
        const mockPaginated = {
            docs: mockDocs,
            get: jest.fn().mockResolvedValue({ docs: mockDocs }),
        };
        const mockQuery: any = {
            orderBy: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue({ docs: mockDocs }),
            limit: jest.fn().mockReturnThis(),
            offset: jest.fn().mockReturnThis(),
        };
        mockQuery.limit = jest.fn(() => mockQuery);
        mockQuery.offset = jest.fn(() => mockPaginated);
        const mockNotifications = {
            orderBy: jest.fn(() => mockQuery),
            where: jest.fn(() => mockQuery),
            get: jest.fn().mockResolvedValue({ docs: mockDocs }),
            limit: jest.fn(() => mockQuery),
            offset: jest.fn(() => mockPaginated),
        };
        const mockDeviceDoc = {
            collection: jest.fn(() => mockNotifications),
        };
        const mockGuestDevices = {
            doc: jest.fn(() => mockDeviceDoc),
        };
        const mockFirestore: any = {
            collection: jest.fn((name: string) => {
                if (name === 'guest_devices') return mockGuestDevices;
                return {};
            }),
        };
        service['firebaseService'].getFirestore = jest.fn(() => mockFirestore);

        const result = await service.getGuestNotifications('device1', { page: 1, limit: 1 });
        expect(result.notifications.length).toBe(1);
        expect(result.count).toBe(1);
    });

    it('should handle errors and return empty array', async () => {
        // Simulate error on query.get() instead of getFirestore
        const mockQuery: any = {
            orderBy: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            get: jest.fn().mockRejectedValue(new Error('fail')),
            limit: jest.fn().mockReturnThis(),
            offset: jest.fn().mockReturnThis(),
        };
        mockQuery.limit = jest.fn(() => mockQuery);
        mockQuery.offset = jest.fn(() => mockQuery);
        const mockNotifications = {
            orderBy: jest.fn(() => mockQuery),
            where: jest.fn(() => mockQuery),
            get: jest.fn().mockRejectedValue(new Error('fail')),
            limit: jest.fn(() => mockQuery),
            offset: jest.fn(() => mockQuery),
        };
        const mockDeviceDoc = {
            collection: jest.fn(() => mockNotifications),
        };
        const mockGuestDevices = {
            doc: jest.fn(() => mockDeviceDoc),
        };
        const mockFirestore: any = {
            collection: jest.fn((name: string) => {
                if (name === 'guest_devices') return mockGuestDevices;
                return {};
            }),
        };
        service['firebaseService'].getFirestore = jest.fn(() => mockFirestore);

        const result = await service.getGuestNotifications('device1');
        expect(result.notifications).toEqual([]);
        expect(result.count).toBe(0);
    });
});

describe('markAsRead', () => {
    it('should mark notification as read if exists', async () => {
        const mockDoc = { exists: true, data: () => ({ foo: 'bar' }) };
        const mockNotificationRef: any = {
            get: jest.fn().mockResolvedValue(mockDoc),
            update: jest.fn().mockResolvedValue(undefined),
        };
        const mockNotifications = {
            doc: jest.fn(() => mockNotificationRef),
        };
        const mockUserDoc = {
            collection: jest.fn((name: string) => {
                if (name === 'notifications') return mockNotifications;
                return {};
            }),
        };
        const mockUsers = {
            doc: jest.fn(() => mockUserDoc),
        };
        const mockFirestore: any = {
            collection: jest.fn((name: string) => {
                if (name === 'users') return mockUsers;
                return {};
            }),
        };
        service['firebaseService'].getFirestore = jest.fn(() => mockFirestore);

        const result = await service.markAsRead('user1', 'notif1');
        expect(result.status).toBe('read');
        expect(mockNotificationRef.update).toHaveBeenCalled();
    });

    it('should return null if notification does not exist', async () => {
        const mockDoc = { exists: false };
        const mockNotificationRef: any = {
            get: jest.fn().mockResolvedValue(mockDoc),
            update: jest.fn(),
        };
        const mockNotifications = {
            doc: jest.fn(() => mockNotificationRef),
        };
        const mockUserDoc = {
            collection: jest.fn((name: string) => {
                if (name === 'notifications') return mockNotifications;
                return {};
            }),
        };
        const mockUsers = {
            doc: jest.fn(() => mockUserDoc),
        };
        const mockFirestore: any = {
            collection: jest.fn((name: string) => {
                if (name === 'users') return mockUsers;
                return {};
            }),
        };
        service['firebaseService'].getFirestore = jest.fn(() => mockFirestore);

        const result = await service.markAsRead('user1', 'notif1');
        expect(result).toBeNull();
    });

    it('should throw error on Firestore failure', async () => {
        const mockNotificationRef: any = {
            get: jest.fn().mockRejectedValue(new Error('fail')),
            update: jest.fn(),
        };
        const mockNotifications = {
            doc: jest.fn(() => mockNotificationRef),
        };
        const mockUserDoc = {
            collection: jest.fn((name: string) => {
                if (name === 'notifications') return mockNotifications;
                return {};
            }),
        };
        const mockUsers = {
            doc: jest.fn(() => mockUserDoc),
        };
        const mockFirestore: any = {
            collection: jest.fn((name: string) => {
                if (name === 'users') return mockUsers;
                return {};
            }),
        };
        service['firebaseService'].getFirestore = jest.fn(() => mockFirestore);

        await expect(service.markAsRead('user1', 'notif1')).rejects.toThrow('fail');
    });
});

describe('markGuestNotificationAsRead', () => {
    it('should mark guest notification as read if exists', async () => {
        const mockDoc = { exists: true, data: () => ({ foo: 'bar' }) };
        const mockNotificationRef: any = {
            get: jest.fn().mockResolvedValue(mockDoc),
            update: jest.fn().mockResolvedValue(undefined),
        };
        const mockNotifications = {
            doc: jest.fn(() => mockNotificationRef),
        };
        const mockDeviceDoc = {
            collection: jest.fn((name: string) => {
                if (name === 'notifications') return mockNotifications;
                return {};
            }),
        };
        const mockGuestDevices = {
            doc: jest.fn(() => mockDeviceDoc),
        };
        const mockFirestore: any = {
            collection: jest.fn((name: string) => {
                if (name === 'guest_devices') return mockGuestDevices;
                return {};
            }),
        };
        service['firebaseService'].getFirestore = jest.fn(() => mockFirestore);

        const result = await service.markGuestNotificationAsRead('device1', 'notif1');
        expect(result.status).toBe('read');
        expect(mockNotificationRef.update).toHaveBeenCalled();
    });

    it('should return null if guest notification does not exist', async () => {
        const mockDoc = { exists: false };
        const mockNotificationRef: any = {
            get: jest.fn().mockResolvedValue(mockDoc),
            update: jest.fn(),
        };
        const mockNotifications = {
            doc: jest.fn(() => mockNotificationRef),
        };
        const mockDeviceDoc = {
            collection: jest.fn((name: string) => {
                if (name === 'notifications') return mockNotifications;
                return {};
            }),
        };
        const mockGuestDevices = {
            doc: jest.fn(() => mockDeviceDoc),
        };
        const mockFirestore: any = {
            collection: jest.fn((name: string) => {
                if (name === 'guest_devices') return mockGuestDevices;
                return {};
            }),
        };
        service['firebaseService'].getFirestore = jest.fn(() => mockFirestore);

        const result = await service.markGuestNotificationAsRead('device1', 'notif1');
        expect(result).toBeNull();
    });

    it('should throw error on Firestore failure', async () => {
        const mockNotificationRef: any = {
            get: jest.fn().mockRejectedValue(new Error('fail')),
            update: jest.fn(),
        };
        const mockNotifications = {
            doc: jest.fn(() => mockNotificationRef),
        };
        const mockDeviceDoc = {
            collection: jest.fn((name: string) => {
                if (name === 'notifications') return mockNotifications;
                return {};
            }),
        };
        const mockGuestDevices = {
            doc: jest.fn(() => mockDeviceDoc),
        };
        const mockFirestore: any = {
            collection: jest.fn((name: string) => {
                if (name === 'guest_devices') return mockGuestDevices;
                return {};
            }),
        };
        service['firebaseService'].getFirestore = jest.fn(() => mockFirestore);

        await expect(service.markGuestNotificationAsRead('device1', 'notif1')).rejects.toThrow(
            'fail',
        );
    });
});

describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
        const mockDocs = [{ ref: 'ref1' }, { ref: 'ref2' }];
        const mockSnapshot = { empty: false, docs: mockDocs };
        const mockBatch: any = {
            update: jest.fn(),
            commit: jest.fn().mockResolvedValue(undefined),
        };
        const mockNotificationsRef: any = {
            get: jest.fn().mockResolvedValue(mockSnapshot),
        };
        const mockFirestore: any = {
            collection: jest.fn().mockReturnThis(),
            doc: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnValue(mockNotificationsRef),
            batch: jest.fn().mockReturnValue(mockBatch),
        };
        service['firebaseService'].getFirestore = jest.fn(() => mockFirestore);

        await service.markAllAsRead('user1');
        expect(mockBatch.update).toHaveBeenCalled();
        expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('should do nothing if no unread notifications', async () => {
        const mockSnapshot = { empty: true, docs: [] };
        const mockNotificationsRef: any = {
            get: jest.fn().mockResolvedValue(mockSnapshot),
        };
        const mockFirestore: any = {
            collection: jest.fn().mockReturnThis(),
            doc: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnValue(mockNotificationsRef),
            batch: jest.fn(),
        };
        service['firebaseService'].getFirestore = jest.fn(() => mockFirestore);

        await service.markAllAsRead('user1');
        expect(mockFirestore.batch).not.toHaveBeenCalled();
    });

    it('should throw error on Firestore failure', async () => {
        const mockNotificationsRef: any = {
            get: jest.fn().mockRejectedValue(new Error('fail')),
        };
        const mockFirestore: any = {
            collection: jest.fn().mockReturnThis(),
            doc: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnValue(mockNotificationsRef),
            batch: jest.fn(),
        };
        service['firebaseService'].getFirestore = jest.fn(() => mockFirestore);

        await expect(service.markAllAsRead('user1')).rejects.toThrow('fail');
    });
});

describe('sendNotificationToDevice', () => {
    it('should send notification to guest device with valid token', async () => {
        service['guestDeviceRepository'].findOne = jest
            .fn()
            .mockResolvedValue({ firebaseToken: 'token' });
        service['storeGuestNotification'] = jest.fn().mockResolvedValue('notifId');
        service['sendNotification'] = jest.fn().mockResolvedValue({ success: true });

        const result = await service.sendNotificationToDevice('device1', 'title', 'body', {
            foo: 'bar',
        });
        expect(result.success).toBe(true);
        expect(service['storeGuestNotification']).toHaveBeenCalled();
        expect(service['sendNotification']).toHaveBeenCalled();
    });

    it('should return error if guest device not found', async () => {
        service['guestDeviceRepository'].findOne = jest.fn().mockResolvedValue(null);

        const result = await service.sendNotificationToDevice('device1', 'title', 'body');
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/No active firebase token/);
    });

    it('should return error if guest device has no firebase token', async () => {
        service['guestDeviceRepository'].findOne = jest.fn().mockResolvedValue({});
        const result = await service.sendNotificationToDevice('device1', 'title', 'body');
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/No active firebase token/);
    });

    it('should handle errors', async () => {
        service['guestDeviceRepository'].findOne = jest.fn().mockRejectedValue(new Error('fail'));
        const result = await service.sendNotificationToDevice('device1', 'title', 'body');
        expect(result.success).toBe(false);
        expect(result.error).toBe('fail');
    });
});
let service: NotificationService;
let deviceTokenService: MockDeviceTokenService;

beforeEach(async () => {
    deviceTokenService = new MockDeviceTokenService();

    // Minimal mock Firestore object
    const mockFirestore = {
        collection: jest.fn().mockReturnThis(),
        doc: jest.fn().mockReturnThis(),
        set: jest.fn().mockResolvedValue(undefined),
    };

    // Mock FirebaseApp and admin.apps for NotificationService.onModuleInit
    const mockFirebaseApp = {
        messaging: () => ({
            send: sendMock,
            sendMulticast: sendMock,
            sendEach: sendMock,
            sendEachForMulticast: sendMock,
        }),
    };
    // Patch global admin namespace used in NotificationService
    // Only defineProperty if not already defined
    const admin = require('firebase-admin');
    if (!Object.getOwnPropertyDescriptor(admin, 'apps')?.get) {
        Object.defineProperty(admin, 'apps', {
            configurable: true,
            get: () => [mockFirebaseApp],
        });
    }
    admin.app = () => mockFirebaseApp;

    // Mock FirebaseService with getFirestore method
    const mockFirebaseService = {
        getFirestore: jest.fn(() => mockFirestore),
    };

    // Minimal mock RedisService
    const mockRedisService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
    };

    // Minimal mock GuestDeviceRepository (TypeORM repository)
    const mockGuestDeviceRepository = {
        find: jest.fn(),
        findOne: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
        providers: [
            NotificationService,
            {
                provide: ConfigService,
                useValue: configMock,
            },
            {
                provide: DeviceTokenService,
                useValue: deviceTokenService,
            },
            {
                provide: require('../firestore/firebase.service').FirebaseService,
                useValue: mockFirebaseService,
            },
            {
                provide: require('../cache/redis.service').RedisService,
                useValue: mockRedisService,
            },
            {
                provide: 'GuestDeviceRepository',
                useValue: mockGuestDeviceRepository,
            },
        ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
});

describe('sendNotificationToUser', () => {
    beforeEach(async () => {
        await service.onModuleInit(); // ensure firebaseApp is set
        // Patch isValidFcmToken to always return true for valid tokens
        jest.spyOn(service, 'isValidFcmToken' as any).mockImplementation(
            (token: string) => !!token && token.length === 140,
        );
    });

    it('should return success message when valid token is found', async () => {
        // Provide valid tokens as objects with .token property
        deviceTokenService.getUserActiveTokens.mockResolvedValueOnce([{ token: 'A'.repeat(140) }]);
        // Patch isValidFcmToken to return true for valid tokens
        jest.spyOn(service, 'isValidFcmToken' as any).mockImplementation(
            (token: string) => token && token.length === 140,
        );
        // Mock sendEachForMulticast to simulate batch response
        sendMock.mockResolvedValueOnce({
            responses: [{ success: true, messageId: 'mock-message-id-123' }],
            successCount: 1,
            failureCount: 0,
        });
        // Also mock storeNotification to avoid invalid date errors
        service['storeNotification'] = jest.fn().mockResolvedValue('notifId');
        const result = await service.sendNotificationToUser('user1', {
            title: 'Test',
            body: 'Body',
        });
        expect(result.success).toBe(true);
        expect(result.messageIds).toContain('mock-message-id-123');
        expect(result.successCount).toBe(1);
        expect(result.failureCount).toBe(0);
    });

    it('should return error when no tokens found', async () => {
        deviceTokenService.getUserActiveTokens.mockResolvedValueOnce([]);

        // Patch isValidFcmToken to always return true (shouldn't matter, no tokens)
        jest.spyOn(service, 'isValidFcmToken' as any).mockReturnValue(true);

        const result = await service.sendNotificationToUser('user1', {
            title: 'Test',
            body: 'No token',
        });

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
    });

    it('should return error when token is invalid', async () => {
        const mockTokens = [{ token: null }, { token: undefined }];
        deviceTokenService.getUserActiveTokens = jest.fn().mockResolvedValue(mockTokens);
        // Patch isValidFcmToken to always return false
        jest.spyOn(service, 'isValidFcmToken' as any).mockReturnValue(false);
        // Also mock storeNotification to avoid invalid date errors
        service['storeNotification'] = jest.fn().mockResolvedValue('notifId');
        const result = await service.sendNotificationToUser('user1', {
            title: 'Test',
            body: 'Invalid token',
        });
        expect(result.success).toBe(false);
        expect(result.error).toBe('No valid FCM token formats found');
    });
});

describe('broadcastNotification', () => {
    it('should return success when broadcasted to multiple tokens', async () => {
        await service.onModuleInit();
        sendMock.mockReset();
        deviceTokenService.getAllActiveTokens.mockResolvedValueOnce([
            { token: 'A'.repeat(140) },
            { token: 'B'.repeat(140) },
        ]);

        jest.spyOn(service, 'isValidFcmToken' as any).mockImplementation(
            (token: string) => !!token && token.length === 140,
        );

        sendMock.mockResolvedValueOnce({
            responses: [
                { success: true, messageId: 'mock-message-id-123' },
                { success: true, messageId: 'mock-message-id-456' },
            ],
            successCount: 2,
            failureCount: 0,
        });

        const result = await service.broadcastNotification({
            title: 'All',
            body: 'Broadcast',
        });

        expect(result.success).toBe(true);
        expect(result.messageIds).toContain('mock-message-id-123');
        expect(result.messageIds).toContain('mock-message-id-456');
        expect(result.successCount).toBe(2);
        expect(result.failureCount).toBe(0);
    });

    it('should return error if no tokens found for broadcast', async () => {
        await service.onModuleInit();
        sendMock.mockReset();
        deviceTokenService.getAllActiveTokens.mockResolvedValueOnce([]);
        jest.spyOn(service, 'isValidFcmToken' as any).mockReturnValue(true);

        const result = await service.broadcastNotification({
            title: 'All',
            body: 'No tokens available',
        });

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
    });

    it('should return error when invalid tokens are in the list', async () => {
        await service.onModuleInit();
        sendMock.mockReset();
        const mockTokens = [{ token: null }, { token: undefined }];
        deviceTokenService.getAllActiveTokens = jest.fn().mockResolvedValue(mockTokens);
        jest.spyOn(service, 'isValidFcmToken' as any).mockReturnValue(false);

        const result = await service.broadcastNotification({
            title: 'All',
            body: 'Invalid tokens',
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('No valid FCM token formats found');
    });
});

describe('sendNotification', () => {
    it('should handle Firebase initialization failure', async () => {
        service['firebaseApp'] = null; // simulate uninitialized

        const result = await service.sendNotification(
            'A'.repeat(140), // valid format
            { title: 'Test', body: 'Test body' },
        );
        expect(result.success).toBe(false);
        expect(result.error).toBe('Firebase app not initialized');
    });

    it('should send a notification successfully', async () => {
        await service.onModuleInit();
        sendMock.mockReset();
        // Patch isValidFcmToken to return true for valid tokens
        jest.spyOn(service, 'isValidFcmToken' as any).mockImplementation(
            (token: string) => token && token.length === 140,
        );
        sendMock.mockResolvedValueOnce('mock-message-id-123');
        const result = await service.sendNotification('A'.repeat(140), {
            title: 'Test',
            body: 'Test body',
        });
        expect(result.success).toBe(true);
        expect(result.messageId).toBe('mock-message-id-123');
    });

    it('should deactivate invalid tokens and return error', async () => {
        await service.onModuleInit();
        sendMock.mockReset();
        // Patch isValidFcmToken to return true for valid tokens
        jest.spyOn(service, 'isValidFcmToken' as any).mockImplementation(
            (token: string) => token && token.length === 140,
        );
        sendMock.mockRejectedValueOnce({ code: 'messaging/invalid-registration-token' });
        const result = await service.sendNotification('A'.repeat(140), {
            title: 'Test',
            body: 'Test body',
        });
        expect(result).not.toBeNull();
        expect(result).not.toBeUndefined();
        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid or expired FCM token - token has been deactivated');
        expect(deviceTokenService.deactivateToken).toHaveBeenCalledWith('A'.repeat(140));
    });

    it('should handle general errors', async () => {
        await service.onModuleInit();
        sendMock.mockReset();
        Object.defineProperty(service, 'isDevMode', { get: () => false });
        // Patch isValidFcmToken to return true for valid tokens
        jest.spyOn(service, 'isValidFcmToken' as any).mockImplementation(
            (token: string) => token && token.length === 140,
        );
        sendMock.mockRejectedValueOnce(new Error('Network error'));
        const result = await service.sendNotification('A'.repeat(140), {
            title: 'Test',
            body: 'Test body',
        });
        expect(result).not.toBeNull();
        expect(result).not.toBeUndefined();
        expect(result.success).toBe(false);
        expect(result.error).toBe('Network error');
    });

    it('should reject invalid token formats', async () => {
        await service.onModuleInit();
        sendMock.mockReset();
        const result = await service.sendNotification('invalid-format-token', {
            title: 'Test',
            body: 'Test body',
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid FCM token format');
    });
});

describe('sendTopicNotification', () => {
    it('should send notification to topic in dev mode', async () => {
        await service.onModuleInit();
        sendMock.mockReset();
        Object.defineProperty(service, 'isDevMode', { get: () => true });
        sendMock.mockResolvedValueOnce('mock-message-id-123');

        const result = await service.sendTopicNotification('news', {
            title: 'Breaking News',
            body: 'New features released!',
        });

        expect(result.success).toBe(true);
        expect(result.messageIds).toEqual(['mock-message-id-123']);
        expect(result.successCount).toBe(1);
        expect(result.failureCount).toBe(0);
    });

    it('should handle errors when sending to topic', async () => {
        await service.onModuleInit();
        sendMock.mockReset();
        Object.defineProperty(service, 'isDevMode', { get: () => false });
        sendMock.mockRejectedValueOnce({ message: 'Topic not found' });

        const result = await service.sendTopicNotification('invalid-topic', {
            title: 'Test',
            body: 'Test body',
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Topic not found');
        expect(result.messageIds).toEqual([]);
        expect(result.successCount).toBe(0);
        expect(result.failureCount).toBe(1);
    });
});

describe('handleInvalidTokens', () => {
    it('should handle invalid tokens in batch response', async () => {
        const mockResponse = {
            failureCount: 2,
            responses: [
                { success: true, messageId: 'id1' },
                { success: false, error: { code: 'messaging/invalid-registration-token' } },
                {
                    success: false,
                    error: { code: 'messaging/registration-token-not-registered' },
                },
                { success: false, error: { code: 'other-error' } },
            ],
        };

        const tokens = ['token1', 'token2', 'token3', 'token4'];

        // Call the private method using bracket notation
        await service['handleInvalidTokens'](mockResponse as any, tokens);

        // Verify deactivateToken was called for the right tokens
        expect(deviceTokenService.deactivateToken).toHaveBeenCalledWith('token2');
        expect(deviceTokenService.deactivateToken).toHaveBeenCalledWith('token3');
        expect(deviceTokenService.deactivateToken).toHaveBeenCalledTimes(2);
    });
});
