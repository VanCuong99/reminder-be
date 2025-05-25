// Centralized constants file to avoid duplication and hardcoded values

export const DEFAULT_EXPIRATION_DAYS = 30;
export const MILLISECONDS_PER_DAY = 86400000;
export const FCM_BATCH_SIZE = 500;
export const FCM_TTL_IN_SECONDS = 60 * 60; // 1 hour
export const FCM_TOKEN_MIN_LENGTH = 140;
export const FCM_TOKEN_MAX_LENGTH = 256;
export const FCM_RATE_LIMIT_MAX_REQUESTS = 10;
export const FCM_RATE_LIMIT_TIMEOUT = 1000;
export const FCM_RETRY_ATTEMPTS = 3;
export const FCM_RETRY_FACTOR = 2;
export const FCM_RETRY_MIN_TIMEOUT = 1000;
export const FCM_RETRY_MAX_TIMEOUT = 5000;
