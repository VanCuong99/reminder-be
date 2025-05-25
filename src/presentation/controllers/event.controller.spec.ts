import { Test, TestingModule } from '@nestjs/testing';
import { EventController } from './event.controller';
import { EventService } from '../../application/services/events/event.service';
import { EventEnrichmentService } from '../../shared/services/event-enrichment.service';
import { CreateEventDto } from '../dto/event/create-event.dto';
import { UpdateEventDto } from '../dto/event/update-event.dto';
import { FindEventsQueryDto } from '../dto/event/find-events-query.dto';
import { Event, EventCategory } from '../../domain/entities/event.entity';
import { Logger } from '@nestjs/common';

describe('EventController', () => {
    let controller: EventController;
    let eventService: any;
    let eventEnrichmentService: any;
    const mockEvent = {
        id: 'event123',
        name: 'Test Event',
        description: 'Test event description',
        date: new Date('2025-12-25T12:00:00Z'),
        userId: 'user123',
        deviceId: null,
        notificationSettings: {
            enabled: true,
            reminders: [0, 1, 3, 7],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        category: EventCategory.PERSONAL,
        isRecurring: false,
        timezone: 'America/New_York',
        sourceDeviceId: 'device123',
        isActive: true,
        user: null,
        guestDevice: null,
        isAuthenticatedUserEvent: jest.fn().mockReturnValue(true),
        isGuestUserEvent: jest.fn().mockReturnValue(false),
    } as unknown as Event;

    const mockCreateEventDto: CreateEventDto = {
        name: 'Test Event',
        description: 'Test event description',
        date: new Date('2025-12-25T12:00:00Z').toDateString(),
        timezone: 'America/New_York',
        sourceDeviceId: 'device123',
        deviceId: null,
        firebaseToken: 'firebase-token-123',
        notificationSettings: {
            enabled: true,
            reminders: [0, 1, 3, 7],
        },
    };

    const mockUpdateEventDto: UpdateEventDto = {
        name: 'Updated Event',
        description: 'Updated description',
    };

    const mockReq = {
        user: { id: 'user123', email: 'test@example.com' },
        headers: {
            'user-agent': 'test-user-agent',
            'x-forwarded-for': '127.0.0.1',
            'x-timezone': 'America/New_York',
        },
        connection: { remoteAddress: '127.0.0.1' },
    };

    // Spy on Logger to prevent console output in tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

    beforeEach(async () => {
        eventService = {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
        };
        eventEnrichmentService = {
            enrichAuthenticatedEventData: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [EventController],
            providers: [
                { provide: EventService, useValue: eventService },
                { provide: EventEnrichmentService, useValue: eventEnrichmentService },
            ],
        }).compile();

        controller = module.get<EventController>(EventController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('create', () => {
        it('should create an event successfully', async () => {
            eventService.create.mockResolvedValue(mockEvent);
            eventEnrichmentService.enrichAuthenticatedEventData.mockResolvedValue(undefined);

            const result = await controller.create(mockReq, mockCreateEventDto);

            expect(eventEnrichmentService.enrichAuthenticatedEventData).toHaveBeenCalledWith(
                mockCreateEventDto,
                mockReq.user,
                mockReq.headers,
            );
            expect(eventService.create).toHaveBeenCalledWith(
                { userId: 'user123' },
                mockCreateEventDto,
            );
            expect(result).toEqual(mockEvent);
        });

        it('should detect device type as ANDROID', async () => {
            const req = { ...mockReq, headers: { ...mockReq.headers, 'user-agent': 'android' } };
            eventService.create.mockResolvedValue(mockEvent);
            eventEnrichmentService.enrichAuthenticatedEventData.mockResolvedValue(undefined);
            await controller.create(req, mockCreateEventDto);
            expect(eventEnrichmentService.enrichAuthenticatedEventData).toHaveBeenCalledWith(
                mockCreateEventDto,
                req.user,
                req.headers,
            );
        });

        it('should detect device type as IOS', async () => {
            const req = { ...mockReq, headers: { ...mockReq.headers, 'user-agent': 'iPhone' } };
            eventService.create.mockResolvedValue(mockEvent);
            eventEnrichmentService.enrichAuthenticatedEventData.mockResolvedValue(undefined);
            await controller.create(req, mockCreateEventDto);
            expect(eventEnrichmentService.enrichAuthenticatedEventData).toHaveBeenCalledWith(
                mockCreateEventDto,
                req.user,
                req.headers,
            );
        });

        it('should detect device type as WEB', async () => {
            const req = {
                ...mockReq,
                headers: { ...mockReq.headers, 'user-agent': 'Mozilla/5.0 Chrome Safari' },
            };
            eventService.create.mockResolvedValue(mockEvent);
            eventEnrichmentService.enrichAuthenticatedEventData.mockResolvedValue(undefined);
            await controller.create(req, mockCreateEventDto);
            expect(eventEnrichmentService.enrichAuthenticatedEventData).toHaveBeenCalledWith(
                mockCreateEventDto,
                req.user,
                req.headers,
            );
        });

        it('should log a warning if deviceTokenService.saveToken throws', async () => {
            eventService.create.mockResolvedValue(mockEvent);
            eventEnrichmentService.enrichAuthenticatedEventData.mockImplementation(() => {
                throw new Error('Token error');
            });
            await expect(controller.create(mockReq, mockCreateEventDto)).rejects.toThrow();
        });

        it('should call deviceTokenService.saveToken with null if firebaseToken is missing', async () => {
            const dto = { ...mockCreateEventDto, firebaseToken: undefined };
            eventService.create.mockResolvedValue(mockEvent);
            eventEnrichmentService.enrichAuthenticatedEventData.mockResolvedValue(undefined);
            await controller.create(mockReq, dto);
            expect(eventEnrichmentService.enrichAuthenticatedEventData).toHaveBeenCalledWith(
                dto,
                mockReq.user,
                mockReq.headers,
            );
        });

        it('should call eventService.create with guest identity if user is missing', async () => {
            const req = { ...mockReq, user: undefined };
            eventService.create.mockResolvedValue(mockEvent);
            eventEnrichmentService.enrichAuthenticatedEventData.mockResolvedValue(undefined);
            await controller.create(req, mockCreateEventDto);
            expect(eventService.create).toHaveBeenCalledWith({}, mockCreateEventDto);
        });

        it('should generate sourceDeviceId if not provided', async () => {
            const dto = { ...mockCreateEventDto };
            delete dto.sourceDeviceId;
            eventService.create.mockResolvedValue(mockEvent);
            eventEnrichmentService.enrichAuthenticatedEventData.mockResolvedValue(undefined);
            await controller.create(mockReq, dto);
            expect(eventEnrichmentService.enrichAuthenticatedEventData).toHaveBeenCalledWith(
                dto,
                mockReq.user,
                mockReq.headers,
            );
        });

        it('should handle errors during event creation', async () => {
            eventService.create.mockImplementation(() => {
                throw new Error('Create error');
            });
            eventEnrichmentService.enrichAuthenticatedEventData.mockResolvedValue(undefined);
            await expect(controller.create(mockReq, mockCreateEventDto)).rejects.toThrow();
        });
    });
    describe('findAll', () => {
        it('should handle empty result from eventService.findAll', async () => {
            eventService.findAll.mockResolvedValue([]);
            const queryDto: FindEventsQueryDto = {
                startDate: '2025-01-01T00:00:00Z',
                endDate: '2025-12-31T23:59:59Z',
            };
            const result = await controller.findAll(mockReq, queryDto);
            expect(result).toEqual([]);
        });
    });

    describe('update', () => {
        it('should throw BadRequestException if eventService.update returns null', async () => {
            eventService.findOne = jest.fn().mockResolvedValue(mockEvent);
            eventService.update.mockResolvedValue(null);
            eventEnrichmentService.enrichAuthenticatedEventData.mockResolvedValue(undefined);
            await expect(
                controller.update(mockReq, 'event123', mockUpdateEventDto),
            ).rejects.toThrow();
        });
        it('should update an event successfully', async () => {
            eventService.findOne = jest.fn().mockResolvedValue(mockEvent);
            const updatedEvent = {
                ...mockEvent,
                name: 'Updated Event',
                description: 'Updated description',
            };
            eventService.update.mockResolvedValue(updatedEvent);
            eventEnrichmentService.enrichAuthenticatedEventData.mockResolvedValue(undefined);
            const result = await controller.update(mockReq, 'event123', mockUpdateEventDto);
            expect(eventService.update).toHaveBeenCalledWith(
                { userId: mockReq.user.id },
                'event123',
                mockUpdateEventDto,
            );
            expect(result).toEqual(updatedEvent);
        });
        it('should call enrichAuthenticatedEventData if timezone is provided', async () => {
            eventService.findOne = jest.fn().mockResolvedValue(mockEvent);
            eventService.update.mockResolvedValue(mockEvent);
            eventEnrichmentService.enrichAuthenticatedEventData.mockResolvedValue(undefined);
            const dto = { ...mockUpdateEventDto, timezone: 'Asia/Ho_Chi_Minh' };
            await controller.update(mockReq, 'event123', dto);
            expect(eventEnrichmentService.enrichAuthenticatedEventData).toHaveBeenCalledWith(
                dto,
                mockReq.user,
                mockReq.headers,
                mockEvent,
            );
        });
        it('should register firebase token if provided in update', async () => {
            eventService.findOne = jest.fn().mockResolvedValue(mockEvent);
            eventService.update.mockResolvedValue(mockEvent);
            eventEnrichmentService.enrichAuthenticatedEventData.mockResolvedValue(undefined);
            const dto = { ...mockUpdateEventDto, firebaseToken: 'firebase-token-123' };
            await controller.update(mockReq, 'event123', dto);
            expect(eventEnrichmentService.enrichAuthenticatedEventData).toHaveBeenCalledWith(
                dto,
                mockReq.user,
                mockReq.headers,
                mockEvent,
            );
        });
        it('should handle error in enrichAuthenticatedEventData in update', async () => {
            eventService.findOne = jest.fn().mockResolvedValue(mockEvent);
            eventEnrichmentService.enrichAuthenticatedEventData.mockImplementation(() => {
                throw new Error('Token error');
            });
            await expect(
                controller.update(mockReq, 'event123', mockUpdateEventDto),
            ).rejects.toThrow();
        });
        it('should not call enrichAuthenticatedEventData if timezone is undefined', async () => {
            eventService.findOne = jest.fn().mockResolvedValue(mockEvent);
            eventService.update.mockResolvedValue(mockEvent);
            eventEnrichmentService.enrichAuthenticatedEventData.mockResolvedValue(undefined);
            const dto = { ...mockUpdateEventDto };
            await controller.update(mockReq, 'event123', dto);
            expect(eventEnrichmentService.enrichAuthenticatedEventData).toHaveBeenCalledWith(
                dto,
                mockReq.user,
                mockReq.headers,
                mockEvent,
            );
        });
    });

    // Removed empty duplicate describe block for 'findAll (again)'.

    describe('findOne', () => {
        it('should return a single event by id', async () => {
            eventService.findOne.mockResolvedValue(mockEvent);
            const result = await controller.findOne(mockReq, 'event123');
            expect(result).toEqual(mockEvent);
        });

        it('should throw an error if event is not found', async () => {
            eventService.findOne.mockResolvedValue(null);
            await expect(controller.findOne(mockReq, 'event123')).rejects.toThrow();
        });
    });

    describe('remove', () => {
        it('should throw BadRequestException if eventService.remove throws', async () => {
            eventService.remove.mockImplementation(() => {
                throw new Error('Remove error');
            });
            await expect(controller.remove(mockReq, 'event123')).rejects.toThrow();
        });

        it('should delete an event successfully', async () => {
            eventService.remove.mockResolvedValue(undefined);
            await expect(controller.remove(mockReq, 'event123')).resolves.toBeUndefined();
            expect(eventService.remove).toHaveBeenCalledWith({ userId: 'user123' }, 'event123');
        });
    });
});
