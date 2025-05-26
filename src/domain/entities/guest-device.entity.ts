import { Entity, Column, OneToMany } from 'typeorm';
import { BaseModel } from './base.entity';
import { Event } from './event.entity';

@Entity()
export class GuestDevice extends BaseModel {
    @Column({ unique: true })
    deviceId: string;

    @Column({ nullable: true })
    firebaseToken: string;

    @Column({ nullable: true })
    timezone: string;

    @OneToMany(() => Event, event => event.guestDevice)
    events: Event[];
}
