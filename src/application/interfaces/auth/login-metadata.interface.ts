import { AuthProvider } from '../../../shared/constants/auth.constants';

/**
 * Interface for user login metadata
 */
export interface LoginMetadata {
    lastLoginAt: Date;
    lastLoginProvider: AuthProvider;
    loginCount: number;
    lastUserAgent?: string;
    lastLoginIp?: string;
    failedAttempts?: number;
}

export interface NotificationPreferences {
    email: boolean;
    push: boolean;
    frequency: 'immediate' | 'daily' | 'weekly' | 'never';
    emailTypes?: {
        marketing: boolean;
        security: boolean;
        updates: boolean;
    };
    pushTypes?: {
        loginAlerts: boolean;
        activityUpdates: boolean;
        promotions: boolean;
    };
}
