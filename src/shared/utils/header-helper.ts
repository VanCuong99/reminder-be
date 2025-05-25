/**
 * Utilities for working with HTTP headers
 */
import { HTTP_HEADERS } from '../constants/http-headers';

/**
 * Gets a header value in a case-insensitive manner
 * @param headers Headers object
 * @param headerName Header name to find (case-insensitive)
 * @returns The header value if found, undefined otherwise
 */
export function getHeaderCaseInsensitive(
    headers: Record<string, any>,
    headerName: string,
): string | undefined {
    // Direct access first (most common case)
    if (headers[headerName] !== undefined) {
        return headers[headerName];
    }

    // Case-insensitive search
    const lowerHeaderName = headerName.toLowerCase();
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === lowerHeaderName) {
            return headers[key];
        }
    }

    return undefined;
}

/**
 * Generates a debug-friendly representation of relevant headers
 * @param headers Headers object
 * @returns Object with relevant header values
 */
export function getRelevantHeaders(headers: Record<string, any>): Record<string, any> {
    return {
        [HTTP_HEADERS.X_TIMEZONE]: getHeaderCaseInsensitive(headers, HTTP_HEADERS.X_TIMEZONE),
        [HTTP_HEADERS.TIMEZONE]: getHeaderCaseInsensitive(headers, HTTP_HEADERS.TIMEZONE),
        [HTTP_HEADERS.TIME_ZONE]: getHeaderCaseInsensitive(headers, HTTP_HEADERS.TIME_ZONE),
        [HTTP_HEADERS.ACCEPT_LANGUAGE]: getHeaderCaseInsensitive(
            headers,
            HTTP_HEADERS.ACCEPT_LANGUAGE,
        ),
    };
}
