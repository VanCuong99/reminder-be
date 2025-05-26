import { Entity, Column } from 'typeorm';
import { BaseModel } from './base.entity';

@Entity()
export class Profile extends BaseModel {
    @Column({ nullable: true })
    displayName: string;

    @Column({ nullable: true })
    avatar: string;

    @Column({ type: 'text', nullable: true })
    bio: string;

    @Column({ nullable: true })
    timezone: string;

    @Column({ type: 'json', nullable: true })
    preferences: {
        notifications: {
            email: boolean;
            push: boolean;
            frequency: 'immediate' | 'daily' | 'weekly';
        };
        theme: string;
        language: string;
    };
}
