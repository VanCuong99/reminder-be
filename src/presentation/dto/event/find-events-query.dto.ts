import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString } from 'class-validator';
import { EventCategory } from '../../../domain/entities/event.entity';

export class FindEventsQueryDto {
    @ApiProperty({ description: 'Start date for filtering events (ISO string)', required: false })
    @IsOptional()
    @IsString()
    startDate?: string;

    @ApiProperty({ description: 'End date for filtering events (ISO string)', required: false })
    @IsOptional()
    @IsString()
    endDate?: string;

    @ApiProperty({ description: 'Event category', enum: EventCategory, required: false })
    @IsOptional()
    @IsEnum(EventCategory)
    category?: EventCategory;

    @ApiProperty({ description: 'Timezone for date calculations', required: false })
    @IsOptional()
    @IsString()
    timezone?: string;
}
