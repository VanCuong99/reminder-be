import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
} from 'typeorm';
import { Event } from './event.entity';

@Entity()
export class GuestDevice {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    deviceId: string;

    @Column({ nullable: true })
    firebaseToken: string;

    @Column({ nullable: true })
    timezone: string;

    @OneToMany(() => Event, event => event.guestDevice)
    events: Event[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @Column({ default: true })
    isActive: boolean;
}
