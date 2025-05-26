import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseModel } from './base.entity';
import { User } from './user.entity';
import { Event } from './event.entity';

export enum NotificationStatus {
    UNREAD = 'unread',
    READ = 'read',
}

export enum NotificationType {
    EVENT_CREATED = 'event_created',
    EVENT_UPDATED = 'event_updated',
    REMINDER = 'reminder',
    SYSTEM = 'system',
}

@Entity()
export class Notification extends BaseModel {
    @Column()
    title: string;

    @Column({ type: 'text' })
    content: string;

    @Column({
        type: 'enum',
        enum: NotificationStatus,
        default: NotificationStatus.UNREAD,
    })
    status: NotificationStatus;

    @Column({
        type: 'enum',
        enum: NotificationType,
        default: NotificationType.SYSTEM,
    })
    type: NotificationType;

    @Column()
    userId: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column({ nullable: true })
    eventId: string;

    @ManyToOne(() => Event, { nullable: true })
    @JoinColumn({ name: 'eventId' })
    event: Event;

    @Column({ type: 'timestamptz', nullable: true })
    expiresAt: Date;
}
