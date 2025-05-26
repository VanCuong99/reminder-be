import { AuthProvider } from '../../../shared/constants/auth.constants';

export interface LinkSocialAccountInput {
    userId: string;
    socialId: string;
    provider: AuthProvider;
    avatar?: string;
}

export interface SocialUserInput {
    socialId: string;
    email: string;
    name: string;
    avatar?: string;
    provider: AuthProvider;
}
