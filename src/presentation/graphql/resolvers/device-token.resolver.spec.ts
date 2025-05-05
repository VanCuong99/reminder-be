import { Test, TestingModule } from '@nestjs/testing';
import { DeviceTokenResolver } from './device-token.resolver';
import { DeviceTokenService } from '../../../application/services/device-token/device-token.service';
import { RegisterDeviceTokenInput } from '../types/device-token/inputs/register-device-token.input';
import { DeviceTokenType } from '../types/device-token/outputs/device-token.type';
import { User } from '../../../domain/entities/user.entity';

// Mock data
const mockUser: Partial<User> = {
    id: 'user-id-1',
    email: 'test@example.com',
};

const mockDeviceToken: Partial<DeviceTokenType> = {
    id: 'device-token-id-1',
    token: 'test_fcm_token_123',
    deviceType: 'android',
    userId: 'user-id-1',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
};

const mockDeviceTokens: Partial<DeviceTokenType>[] = [
    mockDeviceToken,
    {
        id: 'device-token-id-2',
        token: 'test_fcm_token_456',
        deviceType: 'ios',
        userId: 'user-id-1',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    },
];

// Mock service
const mockDeviceTokenService = {
    saveToken: jest.fn(),
    deactivateToken: jest.fn(),
    getUserActiveTokens: jest.fn(),
};

describe('DeviceTokenResolver', () => {
    let resolver: DeviceTokenResolver;
    let service: DeviceTokenService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DeviceTokenResolver,
                {
                    provide: DeviceTokenService,
                    useValue: mockDeviceTokenService,
                },
            ],
        }).compile();

        resolver = module.get<DeviceTokenResolver>(DeviceTokenResolver);
        service = module.get<DeviceTokenService>(DeviceTokenService);

        // Reset mocks between tests
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(resolver).toBeDefined();
    });

    describe('registerDeviceToken', () => {
        it('should register a new device token', async () => {
            const input: RegisterDeviceTokenInput = {
                token: 'test_fcm_token_123',
                deviceType: 'android',
            };

            mockDeviceTokenService.saveToken.mockResolvedValue(mockDeviceToken);

            const result = await resolver.registerDeviceToken(input, mockUser as User);

            expect(result).toEqual(mockDeviceToken);
            expect(service.saveToken).toHaveBeenCalledWith(mockUser, input.token, input.deviceType);
        });
    });

    describe('deactivateDeviceToken', () => {
        it('should deactivate a device token', async () => {
            const token = 'test_fcm_token_123';

            mockDeviceTokenService.deactivateToken.mockResolvedValue(undefined);

            const result = await resolver.deactivateDeviceToken(token, mockUser as User);

            expect(result).toBe(true);
            expect(service.deactivateToken).toHaveBeenCalledWith(token);
        });
    });

    describe('myDeviceTokens', () => {
        it('should return current user device tokens', async () => {
            mockDeviceTokenService.getUserActiveTokens.mockResolvedValue(mockDeviceTokens);

            const result = await resolver.myDeviceTokens(mockUser as User);

            expect(result).toEqual(mockDeviceTokens);
            expect(service.getUserActiveTokens).toHaveBeenCalledWith(mockUser.id);
        });
    });

    describe('userDeviceTokens', () => {
        it('should return device tokens for a specific user', async () => {
            const userId = 'user-id-1';

            mockDeviceTokenService.getUserActiveTokens.mockResolvedValue(mockDeviceTokens);

            const result = await resolver.userDeviceTokens(userId);

            expect(result).toEqual(mockDeviceTokens);
            expect(service.getUserActiveTokens).toHaveBeenCalledWith(userId);
        });
    });
});
