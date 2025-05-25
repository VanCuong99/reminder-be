/**
 * Helper functions for timezone handling in Momento
 */

/**
 * Gets the user's local timezone in IANA format
 * @returns {string} Timezone name (e.g., 'America/New_York')
 */
export function getClientTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (error) {
        console.error('Error detecting timezone:', error);
        return 'UTC'; // Default fallback
    }
}

/**
 * Adds timezone headers to a fetch request config
 * @param {RequestInit} options - Fetch API request options
 * @returns {RequestInit} Updated options with timezone header
 */
export function addTimezoneHeader(options: RequestInit = {}): RequestInit {
    const headers = options.headers || {};
    const updatedHeaders = {
        ...headers,
        'X-Timezone': getClientTimezone(),
    };

    return {
        ...options,
        headers: updatedHeaders,
    };
}

/**
 * Formats a date for API requests, ensuring the timezone is preserved
 * @param {Date} date - The date to format
 * @param {string} [timezone] - Optional timezone override
 * @returns {string} ISO formatted date string
 */
export function formatDateWithTimezone(date: Date, timezone: string = 'Asia/Ho_Chi_Minh'): string {
    // The date.toISOString() always converts to UTC
    // For timezone-aware applications, you may need additional logic here
    // or use a library like date-fns-tz
    return date.toISOString();
}

/**
 * Adds timezone info to event data
 * @param {any} eventData - The event data object
 * @returns {any} Event data with timezone information
 */
export function addTimezoneToEventData(eventData: any): any {
    return {
        ...eventData,
        timezone: getClientTimezone(),
    };
}

/**
 * Creates headers for Momento API requests
 * @param {string} deviceId - Optional device ID
 * @returns {Record<string, string>} Headers object
 */
export function createMomentoHeaders(deviceId?: string): Record<string, string> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Timezone': getClientTimezone(),
    };

    if (deviceId) {
        headers['X-Device-ID'] = deviceId;
    }

    return headers;
}
