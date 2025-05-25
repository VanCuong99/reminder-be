import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FacebookStrategy } from './facebook.strategy';

describe('FacebookStrategy', () => {
    let strategy: FacebookStrategy;
    let configService: ConfigService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                FacebookStrategy,
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn((key: string) => {
                            switch (key) {
                                case 'FACEBOOK_CLIENT_ID':
                                    return 'test-client-id';
                                case 'FACEBOOK_CLIENT_SECRET':
                                    return 'test-client-secret';
                                case 'FACEBOOK_CALLBACK_URL':
                                    return 'http://localhost:8000/api/v1/auth/facebook/callback';
                                default:
                                    return null;
                            }
                        }),
                    },
                },
            ],
        }).compile();

        strategy = module.get<FacebookStrategy>(FacebookStrategy);
        configService = module.get<ConfigService>(ConfigService);
    });

    it('should be defined', () => {
        expect(strategy).toBeDefined();
    });

    describe('validate', () => {
        it('should validate and return user data from Facebook profile', async () => {
            const mockProfile: any = {
                id: 'test-facebook-id',
                emails: [{ value: 'test@example.com' }],
                displayName: 'Test User',
                photos: [{ value: 'http://example.com/photo.jpg' }],
            };
            const mockAccessToken = 'test-access-token';
            const mockRefreshToken = 'test-refresh-token';
            const done = jest.fn();

            await strategy.validate(mockAccessToken, mockRefreshToken, mockProfile, done);

            expect(done).toHaveBeenCalledWith(null, {
                socialId: mockProfile.id,
                email: mockProfile.emails[0].value,
                name: mockProfile.displayName,
                avatar: mockProfile.photos[0].value,
                provider: 'facebook',
                accessToken: mockAccessToken,
                refreshToken: mockRefreshToken,
            });
        });

        it('should handle missing profile data gracefully', async () => {
            const mockProfile: any = {
                id: 'test-facebook-id',
                emails: [{ value: 'test@example.com' }],
                displayName: 'Test User',
                // photos missing
            };
            const mockAccessToken = 'test-access-token';
            const mockRefreshToken = 'test-refresh-token';
            const done = jest.fn();

            await strategy.validate(mockAccessToken, mockRefreshToken, mockProfile, done);

            expect(done).toHaveBeenCalledWith(null, {
                socialId: mockProfile.id,
                email: mockProfile.emails[0].value,
                name: mockProfile.displayName,
                avatar: undefined,
                provider: 'facebook',
                accessToken: mockAccessToken,
                refreshToken: mockRefreshToken,
            });
        });
    });
});
