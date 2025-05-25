import { Injectable, Logger } from '@nestjs/common';
import { timezoneConfig } from '../config/timezone.config';
import { getHeaderCaseInsensitive, getRelevantHeaders } from '../utils/header-helper';
import { HTTP_HEADERS } from '../constants/http-headers';

/**
 * Service for handling timezone-related operations
 */
@Injectable()
export class TimezoneService {
    private readonly logger = new Logger(TimezoneService.name);

    /**
     * Default timezone to use when none is provided
     */
    readonly DEFAULT_TIMEZONE = timezoneConfig.defaultTimezone;

    /**
     * Map of common locales to their typical timezones
     * This is a simple mapping for common locales
     */
    private readonly localeTimezoneMap = {
        'en-US': 'America/New_York',
        'en-GB': 'Europe/London',
        'fr-FR': 'Europe/Paris',
        'de-DE': 'Europe/Berlin',
        'es-ES': 'Europe/Madrid',
        'it-IT': 'Europe/Rome',
        'ja-JP': 'Asia/Tokyo',
        'zh-CN': 'Asia/Shanghai',
        'ru-RU': 'Europe/Moscow',
        'pt-BR': 'America/Sao_Paulo',
        'en-AU': 'Australia/Sydney',
        'en-CA': 'America/Toronto',
        'en-NZ': 'Pacific/Auckland',
        'en-ZA': 'Africa/Johannesburg',
        'vi-VN': 'Asia/Ho_Chi_Minh',
        'th-TH': 'Asia/Bangkok',
        'id-ID': 'Asia/Jakarta',
        'ms-MY': 'Asia/Kuala_Lumpur',
    };

    /**
     * IANA timezone database validates if a timezone string is valid
     * @param timezone The timezone string to validate
     * @returns True if the timezone is valid, false otherwise
     */
    isValidTimezone(timezone: string): boolean {
        try {
            Intl.DateTimeFormat(undefined, { timeZone: timezone });
            return true;
        } catch (error) {
            this.logger.warn(`Invalid timezone detected: ${timezone}`);
            return false;
        }
    }

    /**
     * Get a timezone based on locale
     * @param locale The locale string (e.g., 'en-US', 'fr-FR')
     * @returns A timezone string if found, undefined otherwise
     */
    getTimezoneByLocale(locale: string): string | undefined {
        // Check direct match
        if (this.localeTimezoneMap[locale]) {
            return this.localeTimezoneMap[locale];
        }

        // Check language part only (e.g., 'en' from 'en-US')
        const language = locale.split('-')[0];

        // Find any locale that starts with this language
        for (const [mapLocale, timezone] of Object.entries(this.localeTimezoneMap)) {
            if (mapLocale.startsWith(language + '-')) {
                return timezone;
            }
        }

        return undefined;
    }

    /**
     * Extracts user's timezone from request headers or falls back to a default
     * Simplified logic to prioritize headers and fallbacks
     * @param headers The request headers
     * @returns A valid IANA timezone string
     */
    getTimezoneFromHeaders(headers: Record<string, any>): string {
        try {
            // Log relevant headers for debugging
            const relevantHeaders = getRelevantHeaders(headers);
            this.logger.debug(`Checking headers for timezone: ${JSON.stringify(relevantHeaders)}`);

            // 1. Check X-Timezone header (recommended approach)
            const xTimezone = getHeaderCaseInsensitive(headers, HTTP_HEADERS.X_TIMEZONE);
            if (xTimezone && this.isValidTimezone(xTimezone)) {
                this.logger.debug(`Using timezone from X-Timezone header: ${xTimezone}`);
                return xTimezone;
            }

            // 2. Check timezone in the request body if available
            if (headers.body?.timezone && this.isValidTimezone(headers.body.timezone)) {
                this.logger.debug(`Using timezone from request body: ${headers.body.timezone}`);
                return headers.body.timezone;
            }

            // 3. Check alternative header names
            for (const headerName of [HTTP_HEADERS.TIMEZONE, HTTP_HEADERS.TIME_ZONE]) {
                const altTimezone = getHeaderCaseInsensitive(headers, headerName);
                if (altTimezone && this.isValidTimezone(altTimezone)) {
                    this.logger.debug(`Using timezone from ${headerName} header: ${altTimezone}`);
                    return altTimezone;
                }
            }

            // 4. Try to get timezone from Accept-Language header
            const acceptLanguage = getHeaderCaseInsensitive(headers, HTTP_HEADERS.ACCEPT_LANGUAGE);
            if (acceptLanguage) {
                const locale = acceptLanguage.split(',')[0].trim();
                if (locale) {
                    const localeTimezone = this.getTimezoneByLocale(locale);
                    if (localeTimezone && this.isValidTimezone(localeTimezone)) {
                        this.logger.debug(
                            `Using timezone from locale ${locale}: ${localeTimezone}`,
                        );
                        return localeTimezone;
                    }
                }
            }

            // 5. Fall back to default timezone
            this.logger.debug(`No timezone detected, using default: ${this.DEFAULT_TIMEZONE}`);
            return this.DEFAULT_TIMEZONE;
        } catch (error) {
            this.logger.warn(`Error determining timezone from headers: ${error.message}`);
            return this.DEFAULT_TIMEZONE;
        }
    }

    /**
     * Get client timezone from request object or headers
     * @param reqOrHeaders Express Request object or headers object
     * @returns A valid IANA timezone string
     */
    getClientTimezone(reqOrHeaders: any): string {
        try {
            // Handle both direct Request objects and headers objects
            const headers = reqOrHeaders.headers ?? reqOrHeaders;
            return this.getTimezoneFromHeaders(headers);
        } catch (error) {
            this.logger.warn(`Error determining client timezone: ${error.message}`);
            return this.DEFAULT_TIMEZONE;
        }
    }

    /**
     * Set timezone for event creation if not provided or invalid
     * Simplified to prioritize client-provided timezone data
     * @param eventData The event data object
     * @param headers Request headers to extract timezone from if needed
     * @returns The updated event data with valid timezone
     */
    ensureValidTimezone(eventData: any, headers: any): any {
        // Always check both the event data and headers
        const originalTimezone = eventData.timezone;

        // Check if there's a timezone in the body and it's valid
        if (eventData.timezone && this.isValidTimezone(eventData.timezone)) {
            this.logger.debug(`Using valid timezone from request body: ${eventData.timezone}`);
            return eventData;
        }

        // If we're here, either no timezone was provided or it was invalid
        // Create enriched headers that include the event data to improve detection
        const enrichedHeaders = { ...headers, body: eventData };
        const detectedTimezone = this.getClientTimezone(enrichedHeaders);

        // Set the detected timezone
        eventData.timezone = detectedTimezone;

        if (originalTimezone && !this.isValidTimezone(originalTimezone)) {
            this.logger.warn(
                `Replaced invalid timezone: "${originalTimezone}" with detected timezone: "${detectedTimezone}"`,
            );
        } else if (!originalTimezone) {
            this.logger.debug(
                `No timezone provided in event data, using detected timezone: "${detectedTimezone}"`,
            );
        }

        return eventData;
    }

    /**
     * Detect timezone from headers with detailed information about the detection source
     */
    detectTimezoneFromHeaders(headers: Record<string, any>): {
        detectedTimezone: string;
        detectionSource: string;
        headers: Record<string, any>;
    } {
        const mockEventDto = {};
        const enrichedHeaders = { ...headers, body: mockEventDto };

        // Apply timezone detection
        this.ensureValidTimezone(mockEventDto, enrichedHeaders);

        // Determine detection source
        let detectionSource = 'default';
        const headerSources = {
            [HTTP_HEADERS.X_TIMEZONE]: 'X-Timezone header',
            [HTTP_HEADERS.TIMEZONE]: 'Timezone header',
            [HTTP_HEADERS.TIME_ZONE]: 'Time-Zone header',
            [HTTP_HEADERS.ACCEPT_LANGUAGE]: 'Accept-Language header',
        };

        for (const [headerKey, sourceName] of Object.entries(headerSources)) {
            const headerValue = this.getHeaderCaseInsensitive(headers, headerKey);
            if (headerValue) {
                if (
                    headerKey === 'accept-language' ||
                    (headerValue && this.isValidTimezone(headerValue))
                ) {
                    detectionSource = sourceName;
                    break;
                }
            }
        }

        return {
            detectedTimezone: mockEventDto['timezone'],
            detectionSource,
            headers: Object.fromEntries(
                Object.keys(headerSources).map(key => [
                    key,
                    this.getHeaderCaseInsensitive(headers, key),
                ]),
            ),
        };
    }

    /**
     * Helper method to get a header value case-insensitively
     */
    private getHeaderCaseInsensitive(
        headers: Record<string, any>,
        headerName: string,
    ): string | undefined {
        const normalizedHeaders = Object.fromEntries(
            Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
        );
        return normalizedHeaders[headerName.toLowerCase()];
    }
}
