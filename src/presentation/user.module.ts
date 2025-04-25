import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../domain/entities/user.entity';
import { UserService } from '../application/services/users/user.service';
import { UserResolver } from './graphql/resolvers/user.resolver';
import { NotificationModule } from '../infrastructure/messaging/notification.module';

@Module({
    imports: [TypeOrmModule.forFeature([User]), NotificationModule],
    providers: [UserService, UserResolver],
    exports: [UserService],
})
export class UserModule {}
