import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, Logger } from '@nestjs/common';
import { GuestMigrationController } from './guest-migration.controller';
import { GuestMigrationService } from '../../application/services/users/guest-migration.service';

describe('GuestMigrationController', () => {
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
    let controller: GuestMigrationController;
    let guestMigrationService: GuestMigrationService;

    const mockGuestMigrationService = {
        migrateGuestToUser: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [GuestMigrationController],
            providers: [
                {
                    provide: GuestMigrationService,
                    useValue: mockGuestMigrationService,
                },
            ],
        }).compile();

        controller = module.get<GuestMigrationController>(GuestMigrationController);
        guestMigrationService = module.get<GuestMigrationService>(GuestMigrationService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('migrateGuestToUser', () => {
        const mockRequest = {
            user: {
                id: 'test-user-id',
            },
        };
        const mockDeviceId = 'test-device-id';
        const mockMigrationResult = {
            migratedData: {
                events: 5,
                notifications: 3,
            },
        };

        it('should successfully migrate guest data to user account', async () => {
            mockGuestMigrationService.migrateGuestToUser.mockResolvedValue(mockMigrationResult);

            const result = await controller.migrateGuestToUser(mockRequest, mockDeviceId);

            expect(guestMigrationService.migrateGuestToUser).toHaveBeenCalledWith(
                mockRequest.user.id,
                mockDeviceId,
            );
            expect(result).toEqual({
                success: true,
                message: 'Guest data successfully migrated to authenticated user account',
                ...mockMigrationResult,
            });
        });

        it('should throw BadRequestException when device ID is not provided', async () => {
            await expect(controller.migrateGuestToUser(mockRequest, null)).rejects.toThrow(
                new BadRequestException('X-Device-ID header is required'),
            );

            expect(guestMigrationService.migrateGuestToUser).not.toHaveBeenCalled();
        });

        it('should throw BadRequestException when migration service fails', async () => {
            const errorMessage = 'Migration failed due to conflict';
            mockGuestMigrationService.migrateGuestToUser.mockRejectedValue(new Error(errorMessage));

            await expect(controller.migrateGuestToUser(mockRequest, mockDeviceId)).rejects.toThrow(
                new BadRequestException(`Failed to migrate guest data: ${errorMessage}`),
            );

            expect(guestMigrationService.migrateGuestToUser).toHaveBeenCalledWith(
                mockRequest.user.id,
                mockDeviceId,
            );
        });
    });
});
