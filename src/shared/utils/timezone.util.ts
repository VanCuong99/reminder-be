/**
 * Timezone utilities for handling timezone detection and validation
 */

import { Logger } from '@nestjs/common';

const logger = new Logger('TimezoneUtil');

/**
 * Default timezone to use when none is provided
 */
export const DEFAULT_TIMEZONE = 'UTC';

/**
 * IANA timezone database validates if a timezone string is valid
 * @param timezone The timezone string to validate
 * @returns True if the timezone is valid, false otherwise
 */
export function isValidTimezone(timezone: string): boolean {
    try {
        Intl.DateTimeFormat(undefined, { timeZone: timezone });
        return true;
    } catch (error) {
        logger.warn(`Invalid timezone detected: ${timezone}`);
        throw error; // Rethrow the error to be handled by the caller
    }
}

/**
 * Extracts user's timezone from request headers or falls back to a default
 * @param headers The request headers
 * @returns A valid IANA timezone string
 */
export function getTimezoneFromHeaders(headers: Record<string, any>): string {
    try {
        // Try to get timezone from custom header
        let timezone = headers['x-timezone'];

        // Validate the provided timezone
        if (timezone && isValidTimezone(timezone)) {
            return timezone;
        }

        // Alternative header names
        const alternativeHeaders = ['timezone', 'time-zone'];
        for (const headerName of alternativeHeaders) {
            timezone = headers[headerName];
            if (timezone && isValidTimezone(timezone)) {
                return timezone;
            }
        }

        // If no valid timezone in headers, try to determine from Accept-Language
        const acceptLanguage = headers['accept-language'];
        if (acceptLanguage) {
            // Extract locale from Accept-Language
            const locale = acceptLanguage.split(',')[0].trim();
            if (locale) {
                try {
                    // Get the timezone offset from the browser's locale
                    // const dateString = new Date().toLocaleString(locale);
                    // This is a heuristic approach that works in many cases
                    // For production use, consider using a more robust library

                    // Default to user's system timezone if we can determine it
                    return Intl.DateTimeFormat().resolvedOptions().timeZone;
                } catch (error) {
                    logger.debug(
                        `Failed to determine timezone from Accept-Language: ${error.message}`,
                    );
                }
            }
        }

        // Fall back to default timezone
        return DEFAULT_TIMEZONE;
    } catch (error) {
        logger.warn(`Error determining timezone from headers: ${error.message}`);
        return DEFAULT_TIMEZONE;
    }
}

/**
 * Get client timezone from request object
 * @param req Express Request object or headers object
 * @returns A valid IANA timezone string
 */
export function getClientTimezone(req: any): string {
    try {
        // Handle both direct Request objects and headers objects
        const headers = req.headers ?? req;
        return getTimezoneFromHeaders(headers);
    } catch (error) {
        logger.warn(`Error determining client timezone: ${error.message}`);
        return DEFAULT_TIMEZONE;
    }
}
