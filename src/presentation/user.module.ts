import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../domain/entities/user.entity';
import { SocialAccount } from '../domain/entities/social-account.entity';
import { UserService } from '../application/services/users/user.service';
import { NotificationModule } from '../infrastructure/messaging/notification.module';
import { FirebaseModule } from '../infrastructure/firestore/firebase.module';

@Module({
    imports: [TypeOrmModule.forFeature([User, SocialAccount]), NotificationModule, FirebaseModule],
    providers: [UserService],
    exports: [UserService],
})
export class UserModule {}
