export interface JwtPayload {
    sub: string; // User ID
    email: string;
    iat?: number; // Issued at
    exp?: number; // Expiration time
    roles?: string[];
    role?: string; // Single role (for backward compatibility)
    jti?: string; // JWT ID for token identification and revocation
    csrf?: string; // CSRF token for added security
    // Add any other fields you need in the JWT payload
}
