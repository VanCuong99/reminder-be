import { Request } from 'express';
import { User } from '../../domain/entities/user.entity';

export interface AuthUser extends User {
    // JWT claims
    sub?: string;
    jti?: string;
    csrf?: string;
    // Social auth fields required by socialLogin
    socialId: string;
    name: string;
    provider: string;
    // Optional social fields
    avatar?: string;
    accessToken?: string;
    refreshToken?: string;
}

export interface AuthenticatedRequest extends Request {
    user: AuthUser;
}

export interface AuthSuccessResponse {
    user: any;
    accessToken: string;
    refreshToken: string;
    csrfToken: string;
    message: string;
}
