/**
 * Constants for HTTP headers to ensure consistency and prevent typos
 * This follows clean architecture principles by isolating HTTP-specific details
 */

export const HTTP_HEADERS = {
    /**
     * User agent header containing browser/client information
     */
    USER_AGENT: 'user-agent',

    /**
     * IP address of the client, typically set by proxies
     */
    X_FORWARDED_FOR: 'x-forwarded-for',

    /**
     * Connection information including remote address
     */
    CONNECTION: 'connection',

    /**
     * Accept-Language header for language preferences
     */
    ACCEPT_LANGUAGE: 'accept-language',

    /**
     * Time-Zone header for client timezone information
     */
    TIME_ZONE: 'time-zone',

    /**
     * X-Timezone header for client timezone information (primary)
     */
    X_TIMEZONE: 'x-timezone',

    /**
     * Alternative timezone header
     */
    TIMEZONE: 'timezone',

    /**
     * Response header for detected timezone information
     */
    X_DETECTED_TIMEZONE: 'x-detected-timezone',

    /**
     * X-Device-ID header for unique device identification
     */
    X_DEVICE_ID: 'x-device-id',

    UNKNOWN_AGENT: 'unknown-agent',

    UNKNOWN_IP: 'unknown-ip',
};
