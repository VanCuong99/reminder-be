import { User } from '../../domain/entities/user.entity';
import { UserRole } from '../../shared/constants/user-role.enum';
import { Profile } from '../../domain/entities/profile.entity';
import { AuthProvider } from '../../shared/constants/auth.constants';

export const createMockUser = (overrides: Partial<User> = {}): User => ({
    id: '1',
    username: 'testuser',
    email: 'test@example.com',
    password: 'hashedpassword',
    role: UserRole.USER,
    isActive: true,
    timezone: 'UTC',
    notificationPrefs: {
        email: true,
        push: true,
        frequency: 'immediate',
    },
    profile: {
        id: '1',
        displayName: 'Test User',
        avatar: null,
        bio: null,
        timezone: 'UTC',
        preferences: {
            notifications: {
                email: true,
                push: true,
                frequency: 'immediate',
            },
            theme: 'light',
            language: 'en',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
    } as Profile,
    deviceTokens: [],
    socialAccounts: [],
    identities: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    // AuthenticatableModel fields
    lastLoginAt: new Date(),
    lastLoginProvider: AuthProvider.LOCAL,
    lastLoginIp: '127.0.0.1',
    lastUserAgent: 'Mozilla/5.0',
    loginCount: 0,
    failedAttempts: 0,
    ...overrides,
});
