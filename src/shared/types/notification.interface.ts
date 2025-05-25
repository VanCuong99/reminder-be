export interface NotificationResult {
    success: boolean;
    messageId?: string;
    error?: string;
    successCount?: number;
    failureCount?: number;
    messageIds?: string[];
}

export interface NotificationPayload {
    title: string;
    body: string;
}

export interface NotificationData {
    [key: string]: string;
}
