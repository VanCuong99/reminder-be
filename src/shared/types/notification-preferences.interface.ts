export interface NotificationPreferences {
    email: boolean;
    push: boolean;
    frequency: 'immediate' | 'daily' | 'weekly';
}
