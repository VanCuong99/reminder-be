/**
 * Enum for different authentication providers
 */
export enum AuthProvider {
    LOCAL = 'local',
    GOOGLE = 'google',
    FACEBOOK = 'facebook',
    GITHUB = 'github',
    REGISTRATION = 'registration',
    TOKEN_REFRESH = 'TokenRefresh',
    // Add other providers as needed
}

/**
 * Constants related to authentication
 */
export const AUTH_CONSTANTS = {
    // Account security
    MAX_FAILED_ATTEMPTS: 5,
    LOCKOUT_DURATION: 15, // minutes
    PASSWORD_MIN_LENGTH: 8,
    PASSWORD_MAX_LENGTH: 128,

    // Rate limiting
    LOGIN_RATE_LIMIT: {
        WINDOW_MS: 15 * 60 * 1000, // 15 minutes
        MAX_ATTEMPTS: 5,
    },

    // Default values
    DEFAULT_VALUES: {
        LOGIN_COUNT: 0,
        FAILED_ATTEMPTS: 0,
    }, // Token settings
    TOKEN_SETTINGS: {
        ACCESS_TOKEN_EXPIRY: '1h',
        REFRESH_TOKEN_EXPIRY: '7d',
        CSRF_TOKEN_LENGTH: 32,
    },

    // Cookie settings
    COOKIE: {
        SECURE: true,
        HTTP_ONLY: true,
        SAME_SITE: 'strict' as const,
    },
    // Response messages
    MESSAGES: {
        [AuthProvider.LOCAL]: 'Login successful',
        [AuthProvider.FACEBOOK]: 'Facebook login successful',
        [AuthProvider.GOOGLE]: 'Google login successful',
        [AuthProvider.GITHUB]: 'GitHub login successful',
        [AuthProvider.REGISTRATION]: 'Registration successful',
        [AuthProvider.TOKEN_REFRESH]: 'Token refreshed successfully',
        LOGOUT: 'Logout successful',
        ERROR: {
            INVALID_CREDENTIALS: 'Invalid credentials',
            USER_INACTIVE: 'User account is inactive',
            REGISTRATION_FAILED: 'Registration failed. Please check your input and try again.',
            LOGIN_FAILED: 'Login failed. Please try again.',
            REFRESH_FAILED: 'Failed to refresh token',
            LOGOUT_FAILED: 'Failed to logout. Please try again.',
            AUTH_FAILED: 'Authentication failed',
            NO_USER: 'Authentication failed - no user found',
            NO_AUTH_TOKEN: 'No authentication token provided',
            INVALID_TOKEN: 'Invalid or expired token',
            INCOMPLETE_SOCIAL_PROFILE: 'Incomplete social login profile data',
            RATE_LIMIT: 'Too many attempts. Please try again later.',
        },
    } as const,
} as const;

/**
 * Interface for tracking authentication attempts
 */
export interface AuthAttempt {
    timestamp: Date;
    provider: AuthProvider;
    success: boolean;
    userAgent?: string;
    ipAddress?: string;
}
