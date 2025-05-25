import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

// Define interface for Redis error with code property
interface RedisError extends Error {
    code?: string;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
    private redisClient: Redis | null = null;
    private isMockMode: boolean = false;
    private readonly mockCache: Map<string, { value: string; expiry: number | null }> = new Map();
    private readonly logger = new Logger(RedisService.name);

    constructor(private readonly configService: ConfigService) {}

    async onModuleInit() {
        const redisEnabled = this.configService.get<string>('REDIS_ENABLED') !== 'false';
        if (!redisEnabled) {
            this.enableMockMode('Redis is disabled via configuration');
            return;
        }

        try {
            this.redisClient = new Redis({
                host: this.configService.get<string>('REDIS_HOST', 'localhost'),
                port: this.configService.get<number>('REDIS_PORT', 6379),
                password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
                db: this.configService.get<number>('REDIS_DB', 0),
                keyPrefix: this.configService.get<string>('REDIS_PREFIX', 'momento:'),
                connectTimeout: 5000, // 5 seconds timeout
                maxRetriesPerRequest: 3,
                retryStrategy: times => {
                    if (times > 3) {
                        this.enableMockMode(
                            'Redis connection failed after multiple retry attempts',
                        );
                        return null; // Stop retrying
                    }
                    return Math.min(times * 100, 3000); // Backoff strategy
                },
            });

            this.redisClient.on('error', (error: RedisError) => {
                this.logger.error(`Redis connection error: ${error.message}`, error.stack);
                // Don't fail the application if Redis connection fails
                if (!this.isMockMode && error.code === 'ECONNREFUSED') {
                    this.enableMockMode('Redis connection refused');
                }
            });

            this.redisClient.on('connect', () => {
                this.logger.log('Successfully connected to Redis server');
                this.isMockMode = false;
            });

            // Test connection
            await this.redisClient.ping().catch(error => {
                this.enableMockMode(`Redis ping failed: ${error.message}`);
            });
        } catch (error) {
            this.enableMockMode(`Redis initialization error: ${error.message}`);
        }
    }

    async onModuleDestroy() {
        if (this.redisClient && !this.isMockMode) {
            await this.redisClient.quit();
        }
    }

    private enableMockMode(reason: string) {
        this.logger.warn(`Enabling Redis mock mode: ${reason}`);
        this.isMockMode = true;
        if (this.redisClient) {
            this.redisClient.disconnect();
            this.redisClient = null;
        }
        this.logger.log('Redis mock mode enabled - using in-memory storage');
    }

    async get(key: string): Promise<string | null> {
        try {
            if (this.isMockMode) {
                const item = this.mockCache.get(key);
                if (!item) return null;

                // Check if expired
                if (item.expiry !== null && item.expiry < Date.now()) {
                    this.mockCache.delete(key);
                    return null;
                }

                return item.value;
            }

            return (await this.redisClient?.get(key)) || null;
        } catch (error) {
            this.logger.error(`Redis get error for key ${key}: ${error.message}`);
            return null;
        }
    }

    async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
        try {
            if (this.isMockMode) {
                const expiry = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
                this.mockCache.set(key, { value, expiry });
                return;
            }

            if (this.redisClient) {
                if (ttlSeconds) {
                    await this.redisClient.set(key, value, 'EX', ttlSeconds);
                } else {
                    await this.redisClient.set(key, value);
                }
            }
        } catch (error) {
            this.logger.error(`Redis set error for key ${key}: ${error.message}`);
        }
    }

    async delete(key: string): Promise<void> {
        try {
            if (this.isMockMode) {
                this.mockCache.delete(key);
                return;
            }

            await this.redisClient?.del(key);
        } catch (error) {
            this.logger.error(`Redis delete error for key ${key}: ${error.message}`);
        }
    }

    async addToBlacklist(token: string, expiresAt: number): Promise<void> {
        const now = Math.floor(Date.now() / 1000);
        const ttl = expiresAt - now;

        if (ttl <= 0) return; // Token already expired

        const blacklistPrefix = this.configService.get<string>(
            'REDIS_TOKEN_BLACKLIST_PREFIX',
            'blacklist:',
        );

        await this.set(`${blacklistPrefix}${token}`, '1', ttl);
    }

    async isBlacklisted(token: string): Promise<boolean> {
        const blacklistPrefix = this.configService.get<string>(
            'REDIS_TOKEN_BLACKLIST_PREFIX',
            'blacklist:',
        );
        const result = await this.get(`${blacklistPrefix}${token}`);
        return result !== null;
    }

    // Helper method for atomic operations using MULTI
    async executeTransaction(commands: [string, ...any[]][]): Promise<any[]> {
        try {
            if (this.isMockMode) {
                // Simple non-atomic implementation for mock mode
                const results = [];
                for (const [command, ...args] of commands) {
                    if (command === 'set') {
                        const [key, value, expType, expValue] = args;
                        if (expType === 'EX') {
                            await this.set(key, value, expValue);
                        } else {
                            await this.set(key, value);
                        }
                        results.push('OK');
                    } else if (command === 'del') {
                        await this.delete(args[0]);
                        results.push(1);
                    }
                    // Add other commands as needed
                }
                return results;
            }

            if (!this.redisClient) {
                return [];
            }

            const pipeline = this.redisClient.multi();

            for (const [command, ...args] of commands) {
                pipeline[command](...args);
            }

            return pipeline.exec();
        } catch (error) {
            this.logger.error(`Redis transaction error: ${error.message}`);
            return [];
        }
    }

    // Check if Redis is available or in mock mode
    isAvailable(): boolean {
        return this.redisClient !== null || this.isMockMode;
    }

    // Get current mode for debugging
    getMode(): string {
        return this.isMockMode ? 'mock' : 'connected';
    }
}
