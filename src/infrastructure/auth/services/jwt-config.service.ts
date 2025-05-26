import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Algorithm } from 'jsonwebtoken';
import { AUTH_CONSTANTS } from '../../../shared/constants/auth.constants';

/**
 * Service to provide consistent JWT configuration across the application
 * This ensures tokens are signed and verified with the same keys/algorithm
 */
@Injectable()
export class JwtConfigService {
    private readonly logger = new Logger(JwtConfigService.name);
    private readonly _algorithm: Algorithm;
    private readonly _publicKey: string;
    private readonly _privateKey: string;
    private readonly _secret: string;
    private readonly _accessTokenExpiration: string;
    private readonly _refreshTokenExpiration: string;

    constructor(private readonly configService: ConfigService) {
        // Get all JWT configuration at once to ensure consistency
        this._publicKey = this.configService.get<string>('JWT_PUBLIC_KEY');
        this._privateKey = this.configService.get<string>('JWT_PRIVATE_KEY');
        this._secret = this.configService.get<string>('JWT_SECRET');

        // Prefer explicitly configured algorithm, fall back to detection
        const configuredAlgorithm = this.configService.get<string>('JWT_ALGORITHM');

        if (configuredAlgorithm === 'RS256' && this._publicKey && this._privateKey) {
            this._algorithm = 'RS256';
            this.logger.log('Using RS256 algorithm with public/private key pair');
        } else if (this._secret) {
            this._algorithm = 'HS256';
            this.logger.log('Using HS256 algorithm with secret key');
        } else {
            this._algorithm = 'HS256';
            this._secret = 'development_secret_do_not_use_in_production';
            this.logger.warn('No valid JWT configuration found! Using development secret');
        }

        this._accessTokenExpiration =
            this.configService.get<string>('JWT_EXPIRATION') ||
            AUTH_CONSTANTS.TOKEN_SETTINGS.ACCESS_TOKEN_EXPIRY;
        this._refreshTokenExpiration =
            this.configService.get<string>('JWT_REFRESH_EXPIRATION') ||
            AUTH_CONSTANTS.TOKEN_SETTINGS.REFRESH_TOKEN_EXPIRY;

        this.logger.log(`JWT configuration initialized with algorithm: ${this._algorithm}`);
    }

    get algorithm(): Algorithm {
        return this._algorithm;
    }

    get secretOrPrivateKey(): string {
        return this._algorithm === 'RS256' ? this._privateKey : this._secret;
    }

    get secretOrPublicKey(): string {
        return this._algorithm === 'RS256' ? this._publicKey : this._secret;
    }

    get accessTokenExpiration(): string {
        return this._accessTokenExpiration;
    }

    get refreshTokenExpiration(): string {
        return this._refreshTokenExpiration;
    }

    get jwtModuleOptions() {
        if (this._algorithm === 'RS256') {
            return {
                privateKey: this._privateKey,
                publicKey: this._publicKey,
                signOptions: {
                    algorithm: 'RS256' as Algorithm,
                    expiresIn: this._accessTokenExpiration,
                },
                verifyOptions: {
                    algorithms: ['RS256'] as Algorithm[],
                },
            };
        } else {
            return {
                secret: this._secret,
                signOptions: {
                    algorithm: 'HS256' as Algorithm,
                    expiresIn: this._accessTokenExpiration,
                },
                verifyOptions: {
                    algorithms: ['HS256'] as Algorithm[],
                },
            };
        }
    }

    /**
     * Decode and inspect a token for debugging purposes
     * Provides detailed information about the token without verifying the signature
     */
    inspectToken(token: string): { parsed: any; header: any; isRS256: boolean } {
        try {
            const jwt = require('jsonwebtoken');
            // Decode without verification
            const decoded = jwt.decode(token, { complete: true });

            if (!decoded) {
                this.logger.error('Failed to decode token - invalid format');
                return {
                    parsed: null,
                    header: null,
                    isRS256: false,
                };
            }

            this.logger.debug(
                `Token inspection - Algorithm: ${decoded.header?.alg}, Type: ${decoded.header?.typ}`,
            );
            return {
                parsed: decoded.payload,
                header: decoded.header,
                isRS256: decoded.header?.alg === 'RS256',
            };
        } catch (error) {
            this.logger.error(`Token inspection error: ${error.message}`);
            return {
                parsed: null,
                header: null,
                isRS256: false,
            };
        }
    }

    /**
     * Verify a JWT token using the appropriate configuration
     * This ensures tokens are verified with the same algorithm/key used to sign them
     */
    async verifyToken(token: string): Promise<any> {
        const jwt = require('jsonwebtoken');

        // First inspect the token to understand what we're dealing with
        const inspection = this.inspectToken(token);

        // Log essential information for debugging
        this.logger.debug(
            `Verifying token - Header algorithm: ${inspection.header?.alg}, Service configured algorithm: ${this._algorithm}`,
        );

        // Verify based on the token header algorithm, not just config
        if (inspection.isRS256) {
            this.logger.debug('Using RS256 public key for token verification');
            if (!this._publicKey) {
                throw new Error('RS256 token requires a public key, but none is configured');
            }
            return jwt.verify(token, this._publicKey, { algorithms: ['RS256'] });
        } else {
            this.logger.debug('Using HS256 secret for token verification');
            if (!this._secret) {
                throw new Error('HS256 token requires a secret, but none is configured');
            }
            return jwt.verify(token, this._secret, { algorithms: ['HS256'] });
        }
    }
}
