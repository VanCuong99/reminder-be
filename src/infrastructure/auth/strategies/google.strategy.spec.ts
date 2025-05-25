import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GoogleStrategy } from './google.strategy';

describe('GoogleStrategy', () => {
    let strategy: GoogleStrategy;
    let configService: ConfigService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GoogleStrategy,
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn((key: string) => {
                            switch (key) {
                                case 'GOOGLE_CLIENT_ID':
                                    return 'test-client-id';
                                case 'GOOGLE_CLIENT_SECRET':
                                    return 'test-client-secret';
                                case 'GOOGLE_CALLBACK_URL':
                                    return 'http://localhost:8000/api/v1/auth/google/callback';
                                default:
                                    return null;
                            }
                        }),
                    },
                },
            ],
        }).compile();

        strategy = module.get<GoogleStrategy>(GoogleStrategy);
        configService = module.get<ConfigService>(ConfigService);
    });

    it('should be defined', () => {
        expect(strategy).toBeDefined();
    });

    describe('validate', () => {
        it('should validate and return user data from Google profile', async () => {
            const mockProfile = {
                id: 'test-google-id',
                emails: [{ value: 'test@example.com' }],
                displayName: 'Test User',
                photos: [{ value: 'http://example.com/photo.jpg' }],
            };

            const mockAccessToken = 'test-access-token';
            const mockRefreshToken = 'test-refresh-token';

            const result = await strategy.validate(
                mockAccessToken,
                mockRefreshToken,
                mockProfile,
                (error: any, user: any) => {
                    expect(error).toBeNull();
                    expect(user).toEqual({
                        socialId: mockProfile.id,
                        email: mockProfile.emails[0].value,
                        name: mockProfile.displayName,
                        avatar: mockProfile.photos[0].value,
                        provider: 'google',
                        accessToken: mockAccessToken,
                        refreshToken: mockRefreshToken,
                    });
                },
            );
        });

        it('should handle missing profile data gracefully', async () => {
            const mockProfile = {
                id: 'test-google-id',
                emails: [{ value: 'test@example.com' }],
                displayName: 'Test User',
                // Missing photos array
            };

            const mockAccessToken = 'test-access-token';
            const mockRefreshToken = 'test-refresh-token';

            const result = await strategy.validate(
                mockAccessToken,
                mockRefreshToken,
                mockProfile,
                (error: any, user: any) => {
                    expect(error).toBeNull();
                    expect(user).toEqual({
                        socialId: mockProfile.id,
                        email: mockProfile.emails[0].value,
                        name: mockProfile.displayName,
                        avatar: undefined,
                        provider: 'google',
                        accessToken: mockAccessToken,
                        refreshToken: mockRefreshToken,
                    });
                },
            );
        });
    });
});
