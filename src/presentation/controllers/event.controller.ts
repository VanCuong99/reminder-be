import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    Query,
    UseGuards,
    Request,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../infrastructure/auth/guards/jwt-auth.guard';
import { EventService } from '../../application/services/events/event.service';
import { Event } from '../../domain/entities/event.entity';
import { EventEnrichmentService } from '../../shared/services/event-enrichment.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { CreateEventDto } from '../dto/event/create-event.dto';
import { UpdateEventDto } from '../dto/event/update-event.dto';
import { FindEventsQueryDto } from '../dto/event/find-events-query.dto';

@ApiTags('events')
@Controller('events')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiHeader({ name: 'X-CSRF-Token', description: 'CSRF Token received during login' })
export class EventController {
    private readonly logger = new Logger(EventController.name);

    constructor(
        private readonly eventService: EventService,
        private readonly eventEnrichmentService: EventEnrichmentService,
    ) {}

    @Post()
    @ApiOperation({ summary: 'Create a new event for authenticated user' })
    @ApiResponse({ status: 201, description: 'Event created successfully', type: Event })
    @ApiResponse({ status: 400, description: 'Bad request' })
    async create(@Request() req, @Body() createEventDto: CreateEventDto): Promise<Event> {
        try {
            // Enrich event data with device info, timezone, and handle token registration
            await this.eventEnrichmentService.enrichAuthenticatedEventData(
                createEventDto,
                req.user,
                req.headers,
            );

            const userOrEmpty = req.user ? { userId: req.user.id } : {};

            return await this.eventService.create(userOrEmpty, createEventDto);
        } catch (error) {
            this.logger.error(`Error creating event for user: ${error.message}`, error.stack);
            throw new BadRequestException(error.message);
        }
    }

    @Get()
    @ApiOperation({ summary: 'Get all events for the authenticated user' })
    @ApiResponse({ status: 200, description: 'Return all events', type: [Event] })
    async findAll(@Request() req, @Query() query: FindEventsQueryDto): Promise<Event[]> {
        return this.eventService.findAll({ userId: req.user.id }, query);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a specific event by ID for authenticated user' })
    @ApiResponse({ status: 200, description: 'Return the event', type: Event })
    @ApiResponse({ status: 404, description: 'Event not found' })
    async findOne(
        @Request() req,
        @Param('id') id: string,
        @Query('timezone') timezone?: string,
    ): Promise<Event> {
        const result = await this.eventService.findOne({ userId: req.user.id }, id);
        if (!result) {
            throw new BadRequestException('Event not found');
        }
        return result;
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update an event (authenticated users only)' })
    @ApiResponse({ status: 200, description: 'Event updated successfully' })
    @ApiResponse({ status: 404, description: 'Event not found' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    async update(
        @Request() req,
        @Param('id') id: string,
        @Body() updateEventDto: UpdateEventDto,
    ): Promise<Event> {
        try {
            // Enrich event data with device info, timezone, and handle token registration
            const currentEvent = await this.eventService.findOne({ userId: req.user.id }, id);
            await this.eventEnrichmentService.enrichAuthenticatedEventData(
                updateEventDto,
                req.user,
                req.headers,
                currentEvent,
            );

            const updated = await this.eventService.update(
                { userId: req.user.id },
                id,
                updateEventDto,
            );
            if (!updated) {
                throw new BadRequestException('Event not found or update failed');
            }
            return updated;
        } catch (error) {
            if (error.name === 'NotFoundException') {
                throw error;
            }
            throw new BadRequestException(error.message);
        }
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete an event (authenticated users only)' })
    @ApiResponse({ status: 200, description: 'Event deleted successfully' })
    @ApiResponse({ status: 404, description: 'Event not found' })
    async remove(@Request() req, @Param('id') id: string): Promise<void> {
        return this.eventService.remove({ userId: req.user.id }, id);
    }
}
