import { PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Column } from 'typeorm';
import { AuthProvider } from '../../shared/constants/auth.constants';

export abstract class BaseModel {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @Column({ default: true })
    isActive: boolean;
}

export abstract class AuthenticatableModel extends BaseModel {
    @Column({ nullable: true })
    lastLoginAt: Date;

    @Column({ type: 'enum', enum: AuthProvider, nullable: true })
    lastLoginProvider: AuthProvider;

    @Column({ nullable: true })
    lastLoginIp: string;

    @Column({ nullable: true })
    lastUserAgent: string;

    @Column({ default: 0 })
    loginCount: number;

    @Column({ default: 0 })
    failedAttempts: number;
}
