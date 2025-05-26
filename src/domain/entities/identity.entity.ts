import { Entity, Column, ManyToOne } from 'typeorm';
import { User } from './user.entity';
import { LoginMethod } from '../../shared/constants/login-method.enum';
import { BaseModel } from './base.entity';
import { AuthProvider } from '../../shared/constants/auth.constants';

@Entity()
export class Identity extends BaseModel {
    @ManyToOne(() => User, user => user.identities)
    user: User;

    @Column({ type: 'enum', enum: LoginMethod })
    method: LoginMethod;
    @Column({ type: 'enum', enum: AuthProvider, nullable: true })
    provider: AuthProvider;

    @Column({ nullable: true })
    providerId: string;

    @Column({ type: 'json', nullable: true })
    credentials: {
        accessToken?: string;
        refreshToken?: string;
        expiresAt?: Date;
    };

    @Column({ type: 'json', nullable: true })
    profile: {
        email?: string;
        name?: string;
        picture?: string;
    };

    @Column({ nullable: true })
    lastUsedAt: Date;
}
