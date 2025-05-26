// src/domain/entities/user.entity.ts

import { Entity, Column, OneToMany, OneToOne, JoinColumn } from 'typeorm';
import { DeviceToken } from './device-token.entity';
import { UserRole } from '../../shared/constants/user-role.enum';
import { AuthenticatableModel } from './base.entity';
import { Profile } from './profile.entity';
import { Identity } from './identity.entity';
import { SocialAccount } from './social-account.entity';

@Entity()
export class User extends AuthenticatableModel {
    // Core account info
    @Column({ unique: true, nullable: true })
    username: string;

    @Column({ unique: true, nullable: true })
    email: string;

    @Column({ nullable: true })
    password: string;

    @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
    role: UserRole;

    // User settings & metadata
    @Column({ nullable: true })
    timezone: string;

    @Column({ type: 'jsonb', nullable: true })
    notificationPrefs: Record<string, any>;

    // Relationships
    @OneToOne(() => Profile, { cascade: true })
    @JoinColumn()
    profile: Profile;

    @OneToMany(() => Identity, identity => identity.user, { cascade: true })
    identities: Identity[];

    // Example: user can have multiple device tokens
    @OneToMany(() => DeviceToken, deviceToken => deviceToken.user)
    deviceTokens: DeviceToken[];

    @OneToMany(() => SocialAccount, socialAccount => socialAccount.user, { cascade: true })
    socialAccounts: SocialAccount[];
}
