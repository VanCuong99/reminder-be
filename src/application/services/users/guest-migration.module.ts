import { Module } from '@nestjs/common';
import { GuestMigrationService } from './guest-migration.service';
import { EventModule } from '../events/event.module';

@Module({
    imports: [EventModule],
    providers: [GuestMigrationService],
    exports: [GuestMigrationService],
})
export class GuestMigrationModule {}
