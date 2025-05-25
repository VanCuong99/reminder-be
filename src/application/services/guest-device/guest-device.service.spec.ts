import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GuestDeviceService } from './guest-device.service';
import { GuestDevice } from '../../../domain/entities/guest-device.entity';
import { Logger, NotFoundException } from '@nestjs/common';
import { TokenValidationService } from '../../../shared/services/token-validation.service';
import { TimezoneService } from '../../../shared/services/timezone.service';
import { DeviceFingerprintingService } from '../../../shared/services/device-fingerprinting.service';

describe('GuestDeviceService', () => {
    let service: GuestDeviceService;
    let repository: Repository<GuestDevice>;
    let tokenValidationService: TokenValidationService;
    let timezoneService: TimezoneService;
    let deviceFingerprintingService: DeviceFingerprintingService;

    // Mock guest device
    const mockGuestDevice = {
        id: 'device-uuid-1',
        deviceId: 'test-device-123',
        firebaseToken: 'firebase-token-123',
        timezone: 'Asia/Ho_Chi_Minh',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    } as GuestDevice;

    // Spy on Logger to prevent console output in tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GuestDeviceService,
                {
                    provide: getRepositoryToken(GuestDevice),
                    useValue: {
                        findOne: jest.fn().mockResolvedValue(mockGuestDevice),
                        create: jest.fn().mockReturnValue(mockGuestDevice),
                        save: jest.fn().mockResolvedValue(mockGuestDevice),
                    },
                },
                {
                    provide: TokenValidationService,
                    useValue: {
                        validateFirebaseToken: jest.fn(),
                    },
                },
                {
                    provide: TimezoneService,
                    useValue: {
                        getClientTimezone: jest.fn().mockReturnValue('Asia/Ho_Chi_Minh'),
                    },
                },
                {
                    provide: DeviceFingerprintingService,
                    useValue: {
                        generateFingerprint: jest.fn().mockReturnValue('generated-device-id'),
                    },
                },
            ],
        }).compile();

        service = module.get<GuestDeviceService>(GuestDeviceService);
        repository = module.get<Repository<GuestDevice>>(getRepositoryToken(GuestDevice));
        tokenValidationService = module.get<TokenValidationService>(TokenValidationService);
        timezoneService = module.get<TimezoneService>(TimezoneService);
        deviceFingerprintingService = module.get<DeviceFingerprintingService>(
            DeviceFingerprintingService,
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('findOrCreate', () => {
        it('should return existing guest device if one exists', async () => {
            const deviceId = 'test-device-123';

            // Mock findOne to return the mock device
            jest.spyOn(repository, 'findOne').mockResolvedValueOnce(mockGuestDevice);

            const result = await service.findOrCreate(deviceId);

            expect(result).toEqual(mockGuestDevice);
            expect(repository.findOne).toHaveBeenCalledWith({
                where: { deviceId },
            });
            expect(repository.create).not.toHaveBeenCalled();
            expect(repository.save).not.toHaveBeenCalled();
        });

        it('should create new guest device if none exists', async () => {
            const deviceId = 'new-device-456';
            const firebaseToken = 'firebase-token-456';
            const timezone = 'America/New_York';

            const newMockDevice = {
                ...mockGuestDevice,
                deviceId,
                firebaseToken,
                timezone,
            };

            // Mock findOne to return null (no device found)
            jest.spyOn(repository, 'findOne').mockResolvedValueOnce(null);

            // Mock create and save to return the new device
            jest.spyOn(repository, 'create').mockReturnValueOnce(newMockDevice as GuestDevice);
            jest.spyOn(repository, 'save').mockResolvedValueOnce(newMockDevice as GuestDevice);

            const result = await service.findOrCreate(deviceId, firebaseToken, timezone);

            expect(result).toEqual(newMockDevice);
            expect(repository.findOne).toHaveBeenCalledWith({
                where: { deviceId },
            });
            expect(repository.create).toHaveBeenCalledWith({
                deviceId,
                firebaseToken,
                timezone,
                isActive: true,
            });
            expect(repository.save).toHaveBeenCalled();
            expect(Logger.prototype.log).toHaveBeenCalledWith(
                expect.stringContaining('Created new guest device'),
            );
        });

        it('should update existing guest device if token or timezone has changed', async () => {
            const deviceId = 'test-device-123';
            const updatedToken = 'new-firebase-token';
            const updatedTimezone = 'Europe/London';

            const existingDevice = { ...mockGuestDevice };
            const updatedDevice = {
                ...mockGuestDevice,
                firebaseToken: updatedToken,
                timezone: updatedTimezone,
            };

            // Mock findOne to return the existing device
            jest.spyOn(repository, 'findOne').mockResolvedValueOnce(existingDevice as GuestDevice);

            // Mock save to return the updated device
            jest.spyOn(repository, 'save').mockResolvedValueOnce(updatedDevice as GuestDevice);

            const result = await service.findOrCreate(deviceId, updatedToken, updatedTimezone);

            expect(result).toEqual(updatedDevice);
            expect(repository.findOne).toHaveBeenCalledWith({
                where: { deviceId },
            });
            expect(repository.create).not.toHaveBeenCalled();
            expect(repository.save).toHaveBeenCalled();
            expect(Logger.prototype.log).toHaveBeenCalledWith(
                expect.stringContaining('Updated guest device'),
            );
        });

        it('should not update or save if no changes are detected', async () => {
            const deviceId = 'test-device-123';
            const firebaseToken = 'firebase-token-123'; // Same as mockGuestDevice
            const timezone = 'Asia/Ho_Chi_Minh'; // Same as mockGuestDevice

            // Mock findOne to return the existing device
            jest.spyOn(repository, 'findOne').mockResolvedValueOnce(mockGuestDevice);

            const result = await service.findOrCreate(deviceId, firebaseToken, timezone);

            expect(result).toEqual(mockGuestDevice);
            expect(repository.findOne).toHaveBeenCalledWith({
                where: { deviceId },
            });
            expect(repository.create).not.toHaveBeenCalled();
            expect(repository.save).not.toHaveBeenCalled();
        });

        it('should handle errors during findOrCreate process', async () => {
            const deviceId = 'error-device';
            const error = new Error('Database connection error');

            // Mock findOne to throw an error
            jest.spyOn(repository, 'findOne').mockRejectedValueOnce(error);

            await expect(service.findOrCreate(deviceId)).rejects.toThrow(error);
            expect(Logger.prototype.error).toHaveBeenCalled();
        });
    });

    describe('update', () => {
        it('should update an existing guest device', async () => {
            const deviceId = 'test-device-123';
            const updateData = {
                firebaseToken: 'updated-token',
                timezone: 'Europe/Paris',
                isActive: false,
            };

            const updatedDevice = {
                ...mockGuestDevice,
                ...updateData,
            };

            // Mock findOne to return the existing device
            jest.spyOn(repository, 'findOne').mockResolvedValueOnce(mockGuestDevice);

            // Mock save to return the updated device
            jest.spyOn(repository, 'save').mockResolvedValueOnce(updatedDevice as GuestDevice);

            const result = await service.update(deviceId, updateData);

            expect(result).toEqual(updatedDevice);
            expect(repository.findOne).toHaveBeenCalledWith({
                where: { deviceId },
            });
            expect(repository.save).toHaveBeenCalledWith(expect.objectContaining(updateData));
        });

        it('should throw NotFoundException if device does not exist', async () => {
            const deviceId = 'non-existent-device';
            const updateData = { firebaseToken: 'new-token' };

            // Mock findOne to return null (no device found)
            jest.spyOn(repository, 'findOne').mockResolvedValueOnce(null);

            await expect(service.update(deviceId, updateData)).rejects.toThrow(NotFoundException);

            expect(repository.findOne).toHaveBeenCalledWith({
                where: { deviceId },
            });
            expect(repository.save).not.toHaveBeenCalled();
        });
    });

    describe('findByDeviceId', () => {
        it('should return a guest device if it exists', async () => {
            const deviceId = 'test-device-123';

            // Mock findOne to return the mock device
            jest.spyOn(repository, 'findOne').mockResolvedValueOnce(mockGuestDevice);

            const result = await service.findByDeviceId(deviceId);

            expect(result).toEqual(mockGuestDevice);
            expect(repository.findOne).toHaveBeenCalledWith({
                where: { deviceId },
            });
        });

        it('should throw NotFoundException if device does not exist', async () => {
            const deviceId = 'non-existent-device';

            // Mock findOne to return null (no device found)
            jest.spyOn(repository, 'findOne').mockResolvedValueOnce(null);

            await expect(service.findByDeviceId(deviceId)).rejects.toThrow(NotFoundException);

            expect(repository.findOne).toHaveBeenCalledWith({
                where: { deviceId },
            });
        });
    });
    describe('registerDeviceToken', () => {
        const mockHeaders = {
            'user-agent': 'Mozilla/5.0 Test UserAgent',
            'x-forwarded-for': '192.168.1.1',
        };
        const firebaseToken =
            'test-firebase-token-12345678901234567890123456789012345678901234567890';

        it('should register a device token with existing deviceId', async () => {
            const deviceId = 'test-device-123';

            // Create a spy for the findOrCreate method
            const findOrCreateSpy = jest
                .spyOn(service, 'findOrCreate')
                .mockResolvedValueOnce(mockGuestDevice);

            const result = await service.registerDeviceToken(
                deviceId,
                mockHeaders,
                firebaseToken,
                'Asia/Tokyo',
            );

            expect(result).toEqual({
                guestDevice: mockGuestDevice,
                deviceId,
                needsDeviceId: false,
            });
            expect(tokenValidationService.validateFirebaseToken).toHaveBeenCalledWith(
                firebaseToken,
            );
            expect(findOrCreateSpy).toHaveBeenCalledWith(deviceId, firebaseToken, 'Asia/Tokyo');
            expect(Logger.prototype.log).toHaveBeenCalledWith(
                expect.stringContaining('Registered Firebase token for guest device'),
            );
        });
        it('should auto-generate deviceId when not provided', async () => {
            const generatedDeviceId = 'generated-device-id';

            // Setup mocks
            jest.spyOn(deviceFingerprintingService, 'generateFingerprint').mockReturnValueOnce(
                generatedDeviceId,
            );
            jest.spyOn(service, 'findOrCreate').mockResolvedValueOnce({
                ...mockGuestDevice,
                deviceId: generatedDeviceId,
            });

            const result = await service.registerDeviceToken(null, mockHeaders, firebaseToken);

            expect(result).toEqual({
                guestDevice: expect.objectContaining({
                    deviceId: generatedDeviceId,
                }),
                deviceId: generatedDeviceId,
                needsDeviceId: true,
            });
            expect(deviceFingerprintingService.generateFingerprint).toHaveBeenCalledWith(
                mockHeaders['user-agent'],
                mockHeaders['x-forwarded-for'],
            );
            expect(tokenValidationService.validateFirebaseToken).toHaveBeenCalledWith(
                firebaseToken,
            );
            expect(timezoneService.getClientTimezone).toHaveBeenCalled();
        });

        it('should use timezone from headers when not explicitly provided', async () => {
            const deviceId = 'test-device-123';
            const detectedTimezone = 'Europe/Paris';

            // Setup mocks
            jest.spyOn(timezoneService, 'getClientTimezone').mockReturnValueOnce(detectedTimezone);
            const findOrCreateSpy = jest
                .spyOn(service, 'findOrCreate')
                .mockResolvedValueOnce(mockGuestDevice);

            await service.registerDeviceToken(deviceId, mockHeaders, firebaseToken);

            expect(timezoneService.getClientTimezone).toHaveBeenCalled();
            expect(findOrCreateSpy).toHaveBeenCalledWith(deviceId, firebaseToken, detectedTimezone);
        });

        it('should validate firebase token format', async () => {
            const deviceId = 'test-device-123';
            const invalidToken = 'invalid-token';

            // Setup mock to throw error
            jest.spyOn(tokenValidationService, 'validateFirebaseToken').mockImplementationOnce(
                () => {
                    throw new Error('Invalid Firebase token format');
                },
            );

            // Create spy but don't use it since validation should fail before it's called
            const findOrCreateSpy = jest.spyOn(service, 'findOrCreate');

            await expect(
                service.registerDeviceToken(deviceId, mockHeaders, invalidToken),
            ).rejects.toThrow();

            expect(tokenValidationService.validateFirebaseToken).toHaveBeenCalledWith(invalidToken);
            expect(findOrCreateSpy).not.toHaveBeenCalled();
        });
        it('should handle errors during the device registration process', async () => {
            const deviceId = 'test-device-123';
            const error = new Error('Database error');

            // Setup mocks
            const findOrCreateSpy = jest
                .spyOn(service, 'findOrCreate')
                .mockRejectedValueOnce(error);

            await expect(
                service.registerDeviceToken(deviceId, mockHeaders, firebaseToken),
            ).rejects.toThrow(error);

            expect(tokenValidationService.validateFirebaseToken).toHaveBeenCalledWith(
                firebaseToken,
            );
            expect(findOrCreateSpy).toHaveBeenCalled();
        });
    });
});
