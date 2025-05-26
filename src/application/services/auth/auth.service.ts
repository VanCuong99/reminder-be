// src/application/services/auth.service.ts
import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcryptjs from 'bcryptjs'; // Use bcryptjs for consistency
import { v4 as uuidv4 } from 'uuid';
import { AuthProvider, AUTH_CONSTANTS } from '../../../shared/constants/auth.constants';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { UserService } from '../users/user.service';
import { JwtPayload } from '../../../shared/types/jwt-payload.interface';
import { JwtConfigService } from '../../../infrastructure/auth/services/jwt-config.service';
import { User } from '../../../domain/entities/user.entity';
import { LoginInput } from '../../interfaces/auth/login-input.interface';
import { AuthResponse } from '../../interfaces/auth/auth-response.interface';
import { LoginMetadata } from '../../interfaces/auth/login-metadata.interface';
import { SocialUserInput } from '../../interfaces/auth/social-account.interface';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private readonly jwtService: JwtService,
        private readonly userService: UserService,
        private readonly redisService: RedisService,
        private readonly configService: ConfigService,
        private readonly jwtConfigService: JwtConfigService,
    ) {
        this.logger.log(
            `Auth service initialized with algorithm: ${this.jwtConfigService.algorithm}`,
        );
    }

    async validateUser(email: string, password: string): Promise<Omit<User, 'password'> | null> {
        try {
            this.logger.debug(`Validating user with email: ${email}`);

            // Directly query the user from the repository
            const user = await this.userService.findByEmail(email);

            this.logger.debug(`User lookup result: ${user ? 'Found' : 'Not found'}`);

            if (!user) {
                this.logger.warn(`Login failed - User not found: ${email}`);
                return null;
            }

            if (!user.isActive) {
                this.logger.warn(`Login failed - User account is inactive: ${email}`);
                throw new UnauthorizedException(AUTH_CONSTANTS.MESSAGES.ERROR.USER_INACTIVE);
            }

            // Extra debugging for password
            this.logger.debug(`Password structure check - has stored password: ${!!user.password}`);

            const passwordIsValid = await this.comparePassword(password, user.password);

            this.logger.debug(
                `Password validation result: ${passwordIsValid ? 'Valid' : 'Invalid'}`,
            );

            if (!passwordIsValid) {
                this.logger.warn(`Login failed - Invalid password for user: ${email}`);
                return null;
            }

            this.logger.log(`User validated successfully: ${email}`);
            const { password: _, ...result } = user;
            return result;
        } catch (error: unknown) {
            const err = error as Error;
            this.logger.error(`validateUser error: ${err.message}`, err.stack);
            throw error;
        }
    }
    private async updateLoginMetadata(
        user: Partial<User> & { id: string },
        provider: AuthProvider,
        metadata?: Partial<LoginMetadata>,
    ): Promise<void> {
        try {
            const currentLoginCount = user.loginCount ?? AUTH_CONSTANTS.DEFAULT_VALUES.LOGIN_COUNT;

            await this.userService.updateLoginMetadata(user.id, {
                lastLoginAt: new Date(),
                lastLoginProvider: provider,
                loginCount: currentLoginCount + 1,
                lastUserAgent: metadata?.lastUserAgent,
                lastLoginIp: metadata?.lastLoginIp,
                failedAttempts: AUTH_CONSTANTS.DEFAULT_VALUES.FAILED_ATTEMPTS, // Reset on successful login
            });
        } catch (error) {
            this.logger.error(`Failed to update login metadata: ${error.message}`);
            // Don't throw - this is not critical for the login flow
        }
    }

    async login(loginInput: LoginInput): Promise<AuthResponse> {
        try {
            // Validate the user credentials
            const userResult = await this.validateUser(loginInput.email, loginInput.password);

            if (!userResult) {
                // Increment failed attempts
                const user = await this.userService.findByEmail(loginInput.email);
                if (user) {
                    await this.userService.updateLoginMetadata(user.id, {
                        lastLoginAt: new Date(),
                        lastLoginProvider: AuthProvider.LOCAL,
                        loginCount: user.loginCount || 0,
                        failedAttempts: (user.failedAttempts || 0) + 1,
                    });
                }
                throw new UnauthorizedException(AUTH_CONSTANTS.MESSAGES.ERROR.INVALID_CREDENTIALS);
            }

            // Reset failed attempts and update login metadata
            await this.updateLoginMetadata(userResult, AuthProvider.LOCAL, {
                lastUserAgent: loginInput.userAgent,
                lastLoginIp: loginInput.ip,
            });

            // Generate tokens
            const csrfToken = uuidv4();
            const jwtId = uuidv4();

            const payload: JwtPayload = {
                sub: userResult.id,
                email: userResult.email,
                role: userResult.role,
                csrf: csrfToken,
                jti: jwtId,
            };

            // Create tokens using the consistent configuration
            const accessToken = this.jwtService.sign(payload, {
                algorithm: this.jwtConfigService.algorithm,
                expiresIn: this.jwtConfigService.accessTokenExpiration,
            });

            const refreshToken = this.jwtService.sign(payload, {
                algorithm: this.jwtConfigService.algorithm,
                expiresIn: this.jwtConfigService.refreshTokenExpiration,
            });

            return {
                user: {
                    id: userResult.id,
                    email: userResult.email,
                    username: userResult.username,
                    role: userResult.role,
                },
                tokens: {
                    accessToken,
                    refreshToken,
                    csrfToken,
                },
            };
        } catch (error: unknown) {
            const err = error as Error;
            this.logger.error(`login error: ${err.message}`, err.stack);
            throw error;
        }
    }

    async logout(userId: string, tokenId: string): Promise<void> {
        try {
            this.logger.debug(`Logging out user: ${userId} with token: ${tokenId}`);

            // Get existing blacklist or create new one
            const existingBlacklist = await this.redisService.get(`blacklist:${userId}`);
            let blacklist: string[] = [];

            try {
                blacklist = existingBlacklist ? JSON.parse(existingBlacklist) : [];
                if (!Array.isArray(blacklist)) {
                    blacklist = [];
                }
            } catch (e: unknown) {
                const error = e as Error;
                this.logger.error(`Error parsing blacklist: ${error.message}`);
                blacklist = [];
            } // Add token to blacklist
            blacklist.push(tokenId);

            // Import time constants
            const { SECONDS_PER_DAY, SECONDS_PER_HOUR } = await import(
                '../../../shared/constants/constants'
            );

            // Save updated blacklist with appropriate TTL
            const jwtExpiresIn =
                this.configService.get('JWT_EXPIRATION') ??
                this.configService.get('JWT_EXPIRES_IN') ??
                '1d';
            let ttlSeconds = SECONDS_PER_DAY; // Default 1 day in seconds

            if (typeof jwtExpiresIn === 'string') {
                if (jwtExpiresIn.endsWith('d')) {
                    ttlSeconds = parseInt(jwtExpiresIn) * SECONDS_PER_DAY;
                } else if (jwtExpiresIn.endsWith('h')) {
                    ttlSeconds = parseInt(jwtExpiresIn) * SECONDS_PER_HOUR;
                }
            }

            await this.redisService.set(
                `blacklist:${userId}`,
                JSON.stringify(blacklist), // Convert to string before storing
                ttlSeconds,
            );
            this.logger.debug(`User logged out successfully: ${userId}`);
        } catch (error: unknown) {
            const err = error as Error;
            this.logger.error(`logout error: ${err.message}`, err.stack);
            // Continue even if Redis fails - user experience shouldn't be affected
        }
    }

    async refreshToken(userId: string, oldTokenId: string): Promise<AuthResponse> {
        try {
            this.logger.debug(`Refreshing token for user: ${userId}`);

            // Invalidate old refresh token
            await this.logout(userId, oldTokenId);

            // Get user details for new token
            const user = await this.userService.findById(userId);

            if (!user) {
                this.logger.debug(`User not found for token refresh: ${userId}`);
                throw new UnauthorizedException(AUTH_CONSTANTS.MESSAGES.ERROR.INVALID_TOKEN);
            }

            if (!user.isActive) {
                this.logger.debug(`Inactive user attempting token refresh: ${userId}`);
                throw new UnauthorizedException(AUTH_CONSTANTS.MESSAGES.ERROR.USER_INACTIVE);
            }

            // Generate new tokens
            const csrfToken = uuidv4();
            const jti = uuidv4();

            const { accessToken, refreshToken } = await this.generateTokens(
                user.id,
                user.email,
                user.role,
                csrfToken,
                jti,
            );

            this.logger.debug(`Token refreshed successfully for user: ${userId}`);
            return {
                tokens: {
                    accessToken,
                    refreshToken,
                    csrfToken,
                },
                user: {
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    role: user.role,
                },
            };
        } catch (error: unknown) {
            const err = error as Error;
            this.logger.error(`refreshToken error: ${err.message}`, err.stack);
            throw new UnauthorizedException(AUTH_CONSTANTS.MESSAGES.ERROR.REFRESH_FAILED);
        }
    }

    private async generateTokens(
        userId: string,
        email: string,
        role: string,
        csrfToken: string,
        jti: string,
    ): Promise<{ accessToken: string; refreshToken: string }> {
        try {
            const payload: JwtPayload = {
                sub: userId,
                email,
                role,
                csrf: csrfToken,
                jti,
            };

            // Generate access token using consistent configuration
            const accessToken = this.jwtService.sign(payload, {
                algorithm: this.jwtConfigService.algorithm,
                expiresIn: this.jwtConfigService.accessTokenExpiration,
            });

            // Generate refresh token using consistent configuration
            const refreshToken = this.jwtService.sign(payload, {
                algorithm: this.jwtConfigService.algorithm,
                expiresIn: this.jwtConfigService.refreshTokenExpiration,
            });

            return {
                accessToken,
                refreshToken,
            };
        } catch (error: unknown) {
            const err = error as Error;
            this.logger.error(`generateTokens error: ${err.message}`, err.stack);
            throw new BadRequestException('Failed to generate tokens');
        }
    }

    async hashPassword(password: string): Promise<string> {
        const saltRounds = 12;
        return bcryptjs.hash(password, saltRounds);
    }

    async comparePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
        if (!plainPassword || !hashedPassword) {
            this.logger.error(
                `Invalid password comparison attempt - missing ${!plainPassword ? 'plainPassword' : 'hashedPassword'}`,
            );
            return false;
        }

        try {
            // Use bcryptjs to match what's used in the user service
            const result = await bcryptjs.compare(plainPassword, hashedPassword);
            return result;
        } catch (error: unknown) {
            const err = error as Error;
            this.logger.error(`Password comparison error: ${err.message}`);
            return false;
        }
    }

    /**
     * Decode a JWT token without verifying it
     * Use with caution as this doesn't validate the token signature
     */
    decodeToken(token: string): JwtPayload | null {
        try {
            return this.jwtService.decode(token);
        } catch (error: unknown) {
            const err = error as Error;
            this.logger.error(`Failed to decode token: ${err.message}`);
            return null;
        }
    }

    /**
     * Social login handler for Google/Facebook
     * @param socialUser { socialId, email, name, avatar, provider }
     */ async socialLogin(socialUser: SocialUserInput): Promise<AuthResponse> {
        try {
            this.logger.debug(
                `Social login attempt for: ${socialUser.email} via ${socialUser.provider}`,
            );

            // First check if there's an existing social account
            const existingSocialAccount = await this.userService.findBySocialId(
                socialUser.socialId,
                socialUser.provider,
            );

            let user: User;

            if (existingSocialAccount) {
                // User exists with this social account
                this.logger.debug(`Found existing social account for: ${socialUser.email}`);

                if (!existingSocialAccount.isActive) {
                    this.logger.warn(
                        `Social login failed - inactive account: ${existingSocialAccount.email}`,
                    );
                    throw new UnauthorizedException(AUTH_CONSTANTS.MESSAGES.ERROR.USER_INACTIVE);
                }

                user = existingSocialAccount;
            } else {
                // Check if user exists with the same email
                const existingUserByEmail = await this.userService.findByEmail(socialUser.email);

                if (existingUserByEmail) {
                    if (!existingUserByEmail.isActive) {
                        this.logger.warn(
                            `Social login failed - inactive account: ${existingUserByEmail.email}`,
                        );
                        throw new UnauthorizedException(
                            AUTH_CONSTANTS.MESSAGES.ERROR.USER_INACTIVE,
                        );
                    }

                    // Link social account to existing user
                    await this.userService.linkSocialAccount({
                        userId: existingUserByEmail.id,
                        socialId: socialUser.socialId,
                        provider: socialUser.provider,
                        avatar: socialUser.avatar,
                    });

                    user = existingUserByEmail;
                } else {
                    // Create new user
                    user = await this.userService.create({
                        email: socialUser.email,
                        username: socialUser.name,
                        password: null, // No password for social login
                        socialId: socialUser.socialId,
                        provider: socialUser.provider,
                        avatar: socialUser.avatar,
                    });
                }
            }

            // Update login metadata
            // Convert string provider to enum
            const provider =
                Object.values(AuthProvider).find(p => p === socialUser.provider) ||
                AuthProvider.LOCAL;
            await this.updateLoginMetadata(user, provider);

            // Generate auth response with tokens
            const csrfToken = uuidv4();
            const jwtId = uuidv4();

            const payload: JwtPayload = {
                sub: user.id,
                email: user.email,
                role: user.role,
                csrf: csrfToken,
                jti: jwtId,
            };

            const accessToken = this.jwtService.sign(payload, {
                algorithm: this.jwtConfigService.algorithm,
                expiresIn: this.jwtConfigService.accessTokenExpiration,
            });

            const refreshToken = this.jwtService.sign(payload, {
                algorithm: this.jwtConfigService.algorithm,
                expiresIn: this.jwtConfigService.refreshTokenExpiration,
            });

            return {
                user: {
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    role: user.role,
                },
                tokens: {
                    accessToken,
                    refreshToken,
                    csrfToken,
                },
            };
        } catch (error: unknown) {
            const err = error as Error;
            this.logger.error(`Social login error: ${err.message}`, err.stack);
            throw error;
        }
    }
}
