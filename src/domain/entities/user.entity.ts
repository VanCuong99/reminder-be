// src/domain/entities/user.entity.ts
import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
} from 'typeorm';
import { DeviceToken } from './device-token.entity';
import { UserRole } from '../../shared/constants/user-role.enum';

@Entity()
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    username: string;

    @Column({ unique: true })
    email: string;

    @Column({ nullable: true })
    password: string;

    @Column({ nullable: true })
    socialId?: string;

    @Column({ nullable: true })
    provider?: string;

    @Column({
        type: 'enum',
        enum: UserRole,
        default: UserRole.USER,
    })
    role: UserRole;

    @Column({ default: 'UTC' })
    timezone: string;

    @Column({ type: 'json', nullable: true })
    notificationPrefs: {
        email: boolean;
        push: boolean;
        frequency: 'daily' | 'weekly' | 'immediate';
    };

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @Column({ default: true })
    isActive: boolean;

    @OneToMany(() => DeviceToken, deviceToken => deviceToken.user)
    deviceTokens: DeviceToken[];
}
