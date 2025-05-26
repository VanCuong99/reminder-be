import { Request } from 'express';
import { User } from '../../domain/entities/user.entity';
import { AuthProvider } from '../../shared/constants/auth.constants';

export interface AuthUser extends User {
    // JWT claims
    sub?: string;
    jti?: string;
    csrf?: string;
    // Social auth fields required by socialLogin
    socialId: string;
    name: string;
    provider: AuthProvider;
    // Optional social fields
    avatar?: string;
    accessToken?: string;
    refreshToken?: string;
}

export interface AuthenticatedRequest extends Request {
    user: AuthUser;
}

export interface UserResponse {
    id: string;
    email: string;
    username: string;
    role: string;
    isActive?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface BaseResponse {
    user: UserResponse;
    message: string;
}

export interface AuthSuccessResponse extends BaseResponse {
    accessToken?: string;
    refreshToken?: string;
    csrfToken?: string;
}
