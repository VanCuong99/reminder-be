/**
 * Timezone configuration for the application.
 * Simple configuration to set appropriate defaults
 */

interface TimezoneConfig {
    // The default timezone to fall back to when one can't be detected
    defaultTimezone: string;

    // Whether to force the default timezone (optional)
    forceDefaultTimezone?: boolean;
}

/**
 * For production, we'll use UTC as a safe default
 * For development, we can use the local timezone (Vietnam)
 */
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Get the configuration based on the environment
 */
function getTimezoneConfig(): TimezoneConfig {
    const env = process.env.NODE_ENV || 'development';

    // Define configuration for different environments
    const devConfig: TimezoneConfig = {
        defaultTimezone: 'Asia/Ho_Chi_Minh',
        forceDefaultTimezone: false,
    };

    const prodConfig: TimezoneConfig = {
        defaultTimezone: 'UTC',
        forceDefaultTimezone: false,
    };

    // Default configuration
    const defaultConfig: TimezoneConfig = isProduction ? prodConfig : devConfig;

    // Check for forced timezone from environment variable
    const forcedTimezone = process.env.FORCE_TIMEZONE;
    if (forcedTimezone) {
        // Create a config that forces the specified timezone
        try {
            // Try to validate the timezone (simple check)
            Intl.DateTimeFormat(undefined, { timeZone: forcedTimezone });

            console.log(
                `[Timezone Config] Using forced timezone from environment: ${forcedTimezone}`,
            );

            // Return config with forced timezone
            return {
                defaultTimezone: forcedTimezone,
                forceDefaultTimezone: true,
            };
        } catch (error) {
            console.warn(
                `[Timezone Config] Invalid forced timezone: ${forcedTimezone}. Using environment defaults.`,
            );
            throw error; // Rethrow the error to be handled by the caller
        }
    }

    // If no forced timezone or it was invalid, use environment-based config
    if (env === 'test' || env === 'testing') {
        return {
            defaultTimezone: 'UTC', // Use UTC for consistent test results
            forceDefaultTimezone: true, // Override any detection in tests for consistency
        };
    }

    // Return the default config for all other environments
    return defaultConfig;
}

// Export the timezone configuration
export const timezoneConfig = getTimezoneConfig();
