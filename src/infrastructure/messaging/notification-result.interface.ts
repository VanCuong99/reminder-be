/**
 * Interface for notification results
 */
export interface NotificationResult {
    success: boolean;
    messageId?: string;
    error?: string;
    successCount?: number;
    failureCount?: number;
    messageIds?: string[];
}
