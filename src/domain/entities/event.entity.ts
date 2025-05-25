import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { GuestDevice } from './guest-device.entity';

export enum EventCategory {
    PERSONAL = 'personal',
    WORK = 'work',
    HOLIDAY = 'holiday',
    BIRTHDAY = 'birthday',
    ANNIVERSARY = 'anniversary',
    OTHER = 'other',
}

@Entity()
export class Event {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'timestamptz' })
    date: Date;

    @Column({
        type: 'enum',
        enum: EventCategory,
        default: EventCategory.OTHER,
    })
    category: EventCategory;

    @Column({ default: false })
    isRecurring: boolean;

    @Column({ type: 'json', nullable: true })
    notificationSettings: {
        reminders: number[]; // Days before event to send reminder
        enabled: boolean;
    };

    @Column({ nullable: true })
    userId: string;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column({ nullable: true })
    deviceId: string;

    @ManyToOne(() => GuestDevice, guestDevice => guestDevice.events, { nullable: true })
    @JoinColumn({ name: 'deviceId', referencedColumnName: 'deviceId' })
    guestDevice: GuestDevice;

    @Column({ nullable: true })
    timezone: string;

    @Column({ nullable: true })
    sourceDeviceId: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @Column({ default: true })
    isActive: boolean;

    // Helper method to determine if event belongs to authenticated user
    isAuthenticatedUserEvent(): boolean {
        return !!this.userId;
    }

    // Helper method to determine if event belongs to guest user
    isGuestUserEvent(): boolean {
        return !!this.deviceId;
    }
}
