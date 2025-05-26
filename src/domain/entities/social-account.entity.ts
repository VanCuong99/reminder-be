import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseModel } from './base.entity';
import { User } from './user.entity';
import { AuthProvider } from '../../shared/constants/auth.constants';

@Entity('social_accounts')
export class SocialAccount extends BaseModel {
    @Column({ name: 'provider_id' })
    providerId: string;

    @Column({ type: 'enum', enum: AuthProvider })
    provider: AuthProvider;

    @Column({ name: 'user_id' })
    userId: string;

    @ManyToOne(() => User, user => user.socialAccounts, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'user_id' })
    user: User;
}
