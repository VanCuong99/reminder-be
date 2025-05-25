import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { GuestDeviceTokenController } from './guest-device-token.controller';
import { GuestDeviceService } from '../../application/services/guest-device/guest-device.service';
import { RegisterGuestDeviceTokenDto } from '../dto/guest-device/register-guest-device-token.dto';

// Silence all logger output for all tests
let loggerErrorSpy: jest.SpyInstance;
let loggerDebugSpy: jest.SpyInstance;
let loggerWarnSpy: jest.SpyInstance;
let loggerLogSpy: jest.SpyInstance;
beforeAll(() => {
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    loggerDebugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    loggerLogSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
});
afterAll(() => {
    loggerErrorSpy.mockRestore();
    loggerDebugSpy.mockRestore();
    loggerWarnSpy.mockRestore();
    loggerLogSpy.mockRestore();
});

describe('GuestDeviceTokenController', () => {
    let controller: GuestDeviceTokenController;
    let guestDeviceService: any;

    const mockGuestDeviceService = {
        registerDeviceToken: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [GuestDeviceTokenController],
            providers: [{ provide: GuestDeviceService, useValue: mockGuestDeviceService }],
        }).compile();

        controller = module.get<GuestDeviceTokenController>(GuestDeviceTokenController);
        guestDeviceService = module.get<GuestDeviceService>(GuestDeviceService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('registerDeviceToken', () => {
        const deviceId = 'test-device-id';
        const validFirebaseToken = 'valid-firebase-token'.padEnd(100, '0');
        const timezone = 'Asia/Ho_Chi_Minh';
        const mockHeaders = { 'x-device-id': deviceId };

        const mockDto: RegisterGuestDeviceTokenDto = {
            firebaseToken: validFirebaseToken,
            timezone: timezone,
        };

        const mockGuestDevice = {
            deviceId,
            registeredAt: new Date(),
        };

        it('should successfully register a device token', async () => {
            const mockServiceResult = {
                guestDevice: mockGuestDevice,
                deviceId,
                needsDeviceId: false,
            };

            mockGuestDeviceService.registerDeviceToken.mockResolvedValue(mockServiceResult);
            const mockRes: any = { setHeader: jest.fn() };

            const result = await controller.registerDeviceToken(
                deviceId,
                mockHeaders,
                mockDto,
                mockRes,
            );

            expect(result.success).toBe(true);
            expect(result.message).toBe('Firebase token registered successfully');
            expect(result.data.deviceId).toBe(deviceId);
            expect(result.data.registeredAt).toBeDefined();
            expect(guestDeviceService.registerDeviceToken).toHaveBeenCalledWith(
                deviceId,
                mockHeaders,
                validFirebaseToken,
                timezone,
            );
            expect(mockRes.setHeader).not.toHaveBeenCalled();
        });

        it('should set header when deviceId was auto-generated', async () => {
            const generatedDeviceId = 'generated-device-id';
            const mockServiceResult = {
                guestDevice: { ...mockGuestDevice, deviceId: generatedDeviceId },
                deviceId: generatedDeviceId,
                needsDeviceId: true,
            };

            mockGuestDeviceService.registerDeviceToken.mockResolvedValue(mockServiceResult);
            const mockRes: any = { setHeader: jest.fn() };

            const result = await controller.registerDeviceToken(
                null,
                mockHeaders,
                mockDto,
                mockRes,
            );

            expect(result.success).toBe(true);
            expect(mockRes.setHeader).toHaveBeenCalledWith('X-Device-ID', generatedDeviceId);
            expect(result.data.deviceId).toBe(generatedDeviceId);
        });

        it('should handle errors properly', async () => {
            const errorMessage = 'Registration failed';
            mockGuestDeviceService.registerDeviceToken.mockRejectedValue(new Error(errorMessage));
            const mockRes: any = { setHeader: jest.fn() };

            await expect(
                controller.registerDeviceToken(deviceId, mockHeaders, mockDto, mockRes),
            ).rejects.toThrow(errorMessage);
        });
    });
});
