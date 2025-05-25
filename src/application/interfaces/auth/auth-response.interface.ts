import { UserRole } from 'src/shared/constants/user-role.enum';

export interface UserResponse {
    id: string;
    email: string;
    username: string;
    role: UserRole;
}

export interface TokensResponse {
    accessToken: string;
    refreshToken: string;
    csrfToken: string;
}

export interface AuthResponse {
    user: UserResponse;
    tokens: TokensResponse;
}
