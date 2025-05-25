import { EventEnrichmentService } from './event-enrichment.service';
import { TimezoneService } from './timezone.service';
import { DeviceDetectionService } from './device-detection.service';
import { DeviceFingerprintingService } from './device-fingerprinting.service';
import { DeviceTokenService } from '../../application/services/device-token/device-token.service';
import { Logger } from '@nestjs/common';

jest.mock('./timezone.service');
jest.mock('./device-detection.service');
jest.mock('./device-fingerprinting.service');
jest.mock('../../application/services/device-token/device-token.service');

describe('EventEnrichmentService', () => {
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
    let service: EventEnrichmentService;
    let timezoneService: jest.Mocked<TimezoneService>;
    let deviceDetectionService: jest.Mocked<DeviceDetectionService>;
    let deviceFingerprintingService: jest.Mocked<DeviceFingerprintingService>;
    let deviceTokenService: jest.Mocked<DeviceTokenService>;

    beforeEach(() => {
        timezoneService = new TimezoneService() as any;
        deviceDetectionService = new DeviceDetectionService() as any;
        deviceFingerprintingService = new DeviceFingerprintingService() as any;
        const mockRepo = {} as any;
        const mockConfig = { get: jest.fn() } as any;
        deviceTokenService = new DeviceTokenService(mockRepo, mockConfig) as any;

        service = new EventEnrichmentService(
            timezoneService,
            deviceDetectionService,
            deviceFingerprintingService,
            deviceTokenService,
        );
    });

    describe('enrichGuestEventData', () => {
        it('should set deviceId and sourceDeviceId from header', async () => {
            const eventDto: any = { deviceId: 'wrong', sourceDeviceId: undefined };
            const deviceId = 'header-device-id';
            const headers = { 'user-agent': 'test' };
            timezoneService.ensureValidTimezone = jest.fn();

            await service.enrichGuestEventData(eventDto, deviceId, headers);

            expect(eventDto.deviceId).toBe(deviceId);
            expect(eventDto.sourceDeviceId).toBe(deviceId);
            expect(timezoneService.ensureValidTimezone).toHaveBeenCalledWith(eventDto, headers);
        });

        it('should not overwrite sourceDeviceId if already set', async () => {
            const eventDto: any = { deviceId: 'wrong', sourceDeviceId: 'existing' };
            const deviceId = 'header-device-id';
            const headers = {};
            timezoneService.ensureValidTimezone = jest.fn();

            await service.enrichGuestEventData(eventDto, deviceId, headers);

            expect(eventDto.sourceDeviceId).toBe('existing');
        });
    });

    describe('enrichAuthenticatedEventData', () => {
        it('should log a warning if deviceTokenService.saveToken throws, but continue', async () => {
            const eventDto: any = { deviceId: 'should-be-null', firebaseToken: 'token' };
            const user = { id: 1 };
            const headers = { 'user-agent': 'ua' };
            const error = new Error('saveToken failed');
            deviceTokenService.saveToken = jest.fn().mockRejectedValue(error);
            const loggerWarnSpy = jest
                .spyOn(service['logger'], 'warn')
                .mockImplementation(() => {});

            await service.enrichAuthenticatedEventData(eventDto, user, headers);

            expect(deviceDetectionService.detectDeviceType).toHaveBeenCalledWith('ua');
            expect(deviceTokenService.saveToken).toHaveBeenCalledWith(user, 'token', 'ANDROID');
            expect(loggerWarnSpy).toHaveBeenCalledWith(
                'Failed to register device token: saveToken failed',
            );
        });
        beforeEach(() => {
            deviceFingerprintingService.generateFingerprint = jest
                .fn()
                .mockReturnValue('fingerprint');
            deviceDetectionService.detectDeviceType = jest.fn().mockReturnValue('ANDROID');
            deviceTokenService.saveToken = jest.fn().mockResolvedValue({});
            timezoneService.ensureValidTimezone = jest.fn();
            timezoneService.isValidTimezone = jest.fn().mockReturnValue(true);
        });

        it('should set deviceId to null and use currentEvent.sourceDeviceId if present', async () => {
            const eventDto: any = { deviceId: 'should-be-null', sourceDeviceId: undefined };
            const user = { id: 1 };
            const headers = {};
            const currentEvent = { sourceDeviceId: 'current-source' };

            await service.enrichAuthenticatedEventData(eventDto, user, headers, currentEvent);

            expect(eventDto.deviceId).toBeNull();
            expect(eventDto.sourceDeviceId).toBe('current-source');
        });

        it('should generate new sourceDeviceId if not provided and no currentEvent', async () => {
            const eventDto: any = { deviceId: 'should-be-null', sourceDeviceId: undefined };
            const user = { id: 1 };
            const headers = { 'user-agent': 'ua', 'x-forwarded-for': 'ip' };

            await service.enrichAuthenticatedEventData(eventDto, user, headers);

            expect(eventDto.deviceId).toBeNull();
            expect(eventDto.sourceDeviceId).toBe('fingerprint');
            expect(deviceFingerprintingService.generateFingerprint).toHaveBeenCalledWith(
                'ua',
                'ip',
            );
        });

        it('should call deviceTokenService.saveToken if firebaseToken is present', async () => {
            const eventDto: any = { deviceId: 'should-be-null', firebaseToken: 'token' };
            const user = { id: 1 };
            const headers = { 'user-agent': 'ua' };

            await service.enrichAuthenticatedEventData(eventDto, user, headers);

            expect(deviceDetectionService.detectDeviceType).toHaveBeenCalledWith('ua');
            expect(deviceTokenService.saveToken).toHaveBeenCalledWith(user, 'token', 'ANDROID');
        });

        it('should call enrichEventTimezone if headers or currentEvent or eventDto.timezone present', async () => {
            const eventDto: any = { deviceId: 'should-be-null', timezone: 'Asia/Ho_Chi_Minh' };
            const user = { id: 1 };
            const headers = { 'user-agent': 'ua' };

            const spy = jest.spyOn<any, any>(service, 'enrichEventTimezone');
            await service.enrichAuthenticatedEventData(eventDto, user, headers);
            expect(spy).toHaveBeenCalledWith(eventDto, headers, undefined);
        });
    });

    describe('enrichEventTimezone', () => {
        it('should call timezoneService.ensureValidTimezone if headers provided', () => {
            const eventDto: any = { timezone: undefined };
            const headers = { 'x-timezone': 'Asia/Ho_Chi_Minh' };
            timezoneService.ensureValidTimezone = jest.fn();

            (service as any).enrichEventTimezone(eventDto, headers);
            expect(timezoneService.ensureValidTimezone).toHaveBeenCalledWith(eventDto, headers);
        });

        it('should log debug when timezone changes', () => {
            timezoneService.isValidTimezone = jest.fn().mockReturnValue(false);
            (timezoneService as any).DEFAULT_TIMEZONE = 'UTC';
            const eventDto: any = { timezone: 'invalid' };
            const loggerDebugSpy = jest
                .spyOn(service['logger'], 'debug')
                .mockImplementation(() => {});
            (service as any).enrichEventTimezone(eventDto);
            expect(eventDto.timezone).toBe('UTC');
            expect(loggerDebugSpy).toHaveBeenCalledWith('Timezone changed from invalid to UTC');
        });

        it('should set timezone from currentEvent if invalid and currentEvent has valid timezone', () => {
            timezoneService.isValidTimezone = jest
                .fn()
                .mockReturnValueOnce(false)
                .mockReturnValueOnce(true);
            const eventDto: any = { timezone: 'invalid' };
            const currentEvent = { timezone: 'Asia/Ho_Chi_Minh' };
            (service as any).enrichEventTimezone(eventDto, undefined, currentEvent);
            expect(eventDto.timezone).toBe('Asia/Ho_Chi_Minh');
        });

        it('should set timezone to Asia/Ho_Chi_Minh in development', () => {
            const oldEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';
            timezoneService.isValidTimezone = jest.fn().mockReturnValue(false);
            const eventDto: any = { timezone: 'invalid' };
            (service as any).enrichEventTimezone(eventDto);
            expect(eventDto.timezone).toBe('Asia/Ho_Chi_Minh');
            process.env.NODE_ENV = oldEnv;
        });

        it('should set timezone to DEFAULT_TIMEZONE as last resort', () => {
            timezoneService.isValidTimezone = jest.fn().mockReturnValue(false);
            (timezoneService as any).DEFAULT_TIMEZONE = 'UTC';
            const eventDto: any = { timezone: 'invalid' };
            (service as any).enrichEventTimezone(eventDto);
            expect(eventDto.timezone).toBe('UTC');
        });
    });
});
