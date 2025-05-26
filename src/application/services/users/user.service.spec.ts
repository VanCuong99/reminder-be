import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { UserService } from './user.service';
import { User } from '../../../domain/entities/user.entity';
import { Profile } from '../../../domain/entities/profile.entity';
import { Identity } from '../../../domain/entities/identity.entity';
import { UserRole } from '../../../shared/constants/user-role.enum';
import { AuthProvider } from '../../../shared/constants/auth.constants';
import { FirebaseService } from '../../../infrastructure/firestore/firebase.service';
import { NotificationService } from '../../../infrastructure/messaging/notification.service';
import { SocialAccount } from '../../../domain/entities/social-account.entity';
import { Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

// Types and Interfaces
type NotificationFrequency = 'immediate' | 'daily' | 'weekly';

interface NotificationPreferences {
    email: boolean;
    push: boolean;
    frequency: NotificationFrequency;
}

interface NotificationResult {
    success: boolean;
    message?: string;
}

interface UpdateUserDto {
    username?: string;
    email?: string;
    password?: string;
    role?: UserRole;
    avatar?: string;
    timezone?: string;
    notificationPrefs?: {
        email: boolean;
        push: boolean;
        frequency: NotificationFrequency;
    };
}

interface CreateUserDto {
    username: string;
    email: string;
    password: string;
    role?: UserRole;
}

interface LinkSocialAccountInput {
    socialId: string;
    provider: AuthProvider;
    email: string;
    userId: string;
}

// Mock Data
const mockProfile: DeepPartial<Profile> = {
    id: '1',
    displayName: 'Test User',
    avatar: 'avatar.jpg',
    bio: 'Test bio',
};

const mockIdentity: DeepPartial<Identity> = {
    id: '1',
    provider: AuthProvider.GOOGLE,
    providerId: 'external123',
    user: undefined, // Will be set after user creation
};

const mockUser: DeepPartial<User> = {
    id: '1',
    username: 'testuser',
    email: 'test@example.com',
    password: 'hashedpassword',
    role: UserRole.USER,
    timezone: 'UTC',
    notificationPrefs: {
        email: true,
        push: true,
        frequency: 'daily' as NotificationFrequency,
    },
    profile: mockProfile as Profile,
    identities: [mockIdentity as Identity],
    deviceTokens: [],
    socialAccounts: [],
    isActive: true,
};

const mockSocialAccount: DeepPartial<SocialAccount> = {
    id: '1',
    provider: AuthProvider.GOOGLE,
    providerId: 'googleId123',
    user: mockUser as User,
};

const mockNotificationResult: NotificationResult = {
    success: true,
    message: 'Notification sent successfully',
};

jest.mock('bcryptjs', () => ({
    hash: jest.fn().mockImplementation(() => Promise.resolve('hashedpassword')),
    compare: jest.fn().mockImplementation(() => Promise.resolve(true)),
}));

describe('UserService', () => {
    it('should call paginate in findAll', async () => {
        const paginateSpy = jest
            .spyOn(service as any, 'paginate')
            .mockResolvedValue({ items: [], meta: {} });
        const result = await service.findAll();
        expect(paginateSpy).toHaveBeenCalled();
        expect(result).toEqual({ items: [], meta: {} });
    });

    it('should return user in findOne if found', async () => {
        jest.spyOn(service, 'findById').mockResolvedValue(mockUser as any);
        const result = await service.findOne('1');
        expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException in findOne if not found', async () => {
        jest.spyOn(service, 'findById').mockResolvedValue(null);
        await expect(service.findOne('notfound')).rejects.toThrow(NotFoundException);
    });

    it('should call findOne with includeInactive true in findById', async () => {
        mockRepository.findOne.mockResolvedValue(mockUser as any);
        const result = await service.findById('1', true);
        expect(result).toEqual(mockUser);
        expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
    });

    it('should throw NotFoundException if user not found in linkSocialAccount', async () => {
        jest.spyOn(service, 'findById').mockResolvedValue(null);
        await expect(
            service.linkSocialAccount({
                userId: 'notfound',
                socialId: 'sid',
                provider: AuthProvider.GOOGLE,
                email: 'e',
            } as any),
        ).rejects.toThrow(NotFoundException);
    });

    it('should create profile if user has no profile in linkSocialAccount', async () => {
        const userNoProfile = { ...mockUser, profile: undefined };
        mockRepository.findOne.mockResolvedValue(userNoProfile as any);
        mockSocialAccountRepository.findOne.mockResolvedValue(null);
        mockSocialAccountRepository.save.mockResolvedValue({} as any);
        await expect(
            service.linkSocialAccount({
                userId: '1',
                socialId: 'sid',
                provider: AuthProvider.GOOGLE,
                email: 'e',
            } as any),
        ).resolves.not.toThrow();
    });

    it('should throw BadRequestException if email exists in create', async () => {
        mockRepository.findOne.mockResolvedValueOnce(mockUser as any);
        await expect(
            service.create({
                username: 'u',
                email: mockUser.email,
                password: 'p',
            } as any),
        ).rejects.toThrow(BadRequestException);
    });

    it('should call linkSocialAccount if socialId and provider are provided in create', async () => {
        mockRepository.findOne.mockResolvedValue(null);
        const linkSpy = jest.spyOn(service, 'linkSocialAccount').mockResolvedValue();
        await service.create({
            username: 'u',
            email: 'e@e.com',
            password: 'p',
            socialId: 'sid',
            provider: AuthProvider.GOOGLE,
        } as any);
        expect(linkSpy).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found in update', async () => {
        jest.spyOn(service, 'findById').mockResolvedValue(null);
        await expect(service.update('notfound', {})).rejects.toThrow(NotFoundException);
    });

    it('should create profile if user has no profile in update', async () => {
        const userNoProfile = { ...mockUser, profile: undefined };
        mockRepository.findOne.mockResolvedValueOnce(userNoProfile as any);
        jest.spyOn(service, 'findById').mockResolvedValue(userNoProfile as any);
        mockRepository.save.mockResolvedValue({ ...userNoProfile, profile: {} } as any);
        await expect(service.update('1', {})).resolves.not.toThrow();
    });

    it('should update avatar, timezone, notificationPrefs, and password in update', async () => {
        const userWithProfile = { ...mockUser, profile: { ...mockProfile } };
        mockRepository.findOne.mockResolvedValueOnce(userWithProfile as any);
        jest.spyOn(service, 'findById').mockResolvedValue(userWithProfile as any);
        mockRepository.save.mockResolvedValue({ ...userWithProfile } as any);
        await expect(
            service.update('1', {
                avatar: 'newavatar',
                timezone: 'Asia/Ho_Chi_Minh',
                notificationPrefs: { email: false, push: false, frequency: 'weekly' },
                password: 'newpass',
            }),
        ).resolves.not.toThrow();
    });

    it('should throw NotFoundException if user not found in updatePassword', async () => {
        mockRepository.findOne.mockResolvedValue(null);
        await expect(service.updatePassword('notfound', 'old', 'new')).rejects.toThrow(
            NotFoundException,
        );
    });
    let service: UserService;
    let mockRepository: jest.Mocked<Partial<Repository<User>>>;
    let mockSocialAccountRepository: jest.Mocked<Partial<Repository<SocialAccount>>>;
    let mockNotificationService: jest.Mocked<Partial<NotificationService>>;
    let mockFirebaseService: jest.Mocked<Partial<FirebaseService>>;
    let loggerErrorSpy: jest.SpyInstance;

    beforeAll(() => {
        loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    });

    afterAll(() => {
        loggerErrorSpy.mockRestore();
    });

    beforeEach(async () => {
        mockRepository = {
            create: jest.fn().mockImplementation(dto => ({ ...mockUser, ...dto }) as User),
            save: jest
                .fn()
                .mockImplementation(user => Promise.resolve({ ...mockUser, ...user } as User)),
            findOne: jest.fn().mockResolvedValue(mockUser as User),
            findAndCount: jest.fn().mockResolvedValue([[mockUser] as User[], 1]),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
            delete: jest.fn().mockResolvedValue({ affected: 1 }),
        } as jest.Mocked<Partial<Repository<User>>>;

        mockSocialAccountRepository = {
            find: jest.fn().mockResolvedValue([mockSocialAccount] as SocialAccount[]),
            findOne: jest.fn().mockResolvedValue(mockSocialAccount as SocialAccount),
            save: jest
                .fn()
                .mockImplementation(account =>
                    Promise.resolve({ ...mockSocialAccount, ...account } as SocialAccount),
                ),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
            delete: jest.fn().mockResolvedValue({ affected: 1 }),
        } as jest.Mocked<Partial<Repository<SocialAccount>>>;

        mockNotificationService = {
            sendNotification: jest.fn().mockResolvedValue(mockNotificationResult),
            sendNotificationToUser: jest.fn().mockResolvedValue(mockNotificationResult),
            broadcastNotification: jest.fn().mockResolvedValue(mockNotificationResult),
        } as jest.Mocked<Partial<NotificationService>>;

        mockFirebaseService = {
            getDocumentById: jest.fn().mockResolvedValue(mockUser),
            updateDocument: jest.fn().mockResolvedValue(undefined),
            addDocument: jest.fn().mockResolvedValue({ id: '1' }),
        } as jest.Mocked<Partial<FirebaseService>>;

        const module = await Test.createTestingModule({
            providers: [
                UserService,
                {
                    provide: getRepositoryToken(User),
                    useValue: mockRepository,
                },
                {
                    provide: getRepositoryToken(SocialAccount),
                    useValue: mockSocialAccountRepository,
                },
                {
                    provide: NotificationService,
                    useValue: mockNotificationService,
                },
                {
                    provide: FirebaseService,
                    useValue: mockFirebaseService,
                },
            ],
        }).compile();

        service = module.get<UserService>(UserService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('findById', () => {
        it('should find a user by id', async () => {
            mockRepository.findOne.mockResolvedValue(mockUser as User);
            const result = await service.findById('1');
            expect(result).toEqual(mockUser);
            expect(mockRepository.findOne).toHaveBeenCalledWith({
                where: { id: '1', isActive: true },
            });
        });

        it('should return null when user not found', async () => {
            mockRepository.findOne.mockResolvedValue(null);
            mockFirebaseService.getDocumentById.mockResolvedValue(null);
            const result = await service.findById('1');
            expect(result).toBeNull();
        });
        it('should handle Firebase error gracefully', async () => {
            mockRepository.findOne.mockResolvedValue(null);
            const firebaseError = new Error('Firebase error');
            mockFirebaseService.getDocumentById.mockRejectedValueOnce(firebaseError);

            const result = await service.findById('1');
            await new Promise(process.nextTick); // Allow async operations to complete

            expect(result).toBeNull();
            expect(loggerErrorSpy).toHaveBeenCalledWith(
                'Failed to fetch user from Firebase: Firebase error',
            );
        });
    });

    describe('findBySocialId', () => {
        it('should find a user by social provider and ID', async () => {
            const result = await service.findBySocialId('googleId123', AuthProvider.GOOGLE);
            expect(result).toBeDefined();
            expect(mockSocialAccountRepository.findOne).toHaveBeenCalledWith({
                where: {
                    providerId: 'googleId123',
                    provider: AuthProvider.GOOGLE,
                },
                relations: ['user'],
            });
        });

        it('should return null when social account not found', async () => {
            mockSocialAccountRepository.findOne.mockResolvedValue(null);
            const result = await service.findBySocialId('invalidId', AuthProvider.GOOGLE);
            expect(result).toBeNull();
        });
    });
    describe('linkSocialAccount', () => {
        const socialData: LinkSocialAccountInput = {
            socialId: 'newGoogleId',
            provider: AuthProvider.GOOGLE,
            email: 'test@example.com',
            userId: '1',
        };
        it('should link social account to user', async () => {
            mockSocialAccountRepository.findOne.mockResolvedValue(null);
            mockRepository.findOne.mockResolvedValue(mockUser as User);

            const newSocialAccount = {
                providerId: socialData.socialId,
                provider: socialData.provider,
                userId: socialData.userId,
            };
            mockSocialAccountRepository.create = jest.fn().mockReturnValue(newSocialAccount);
            mockSocialAccountRepository.save.mockResolvedValue({
                ...newSocialAccount,
                user: mockUser,
            } as SocialAccount);

            await service.linkSocialAccount(socialData);
            expect(mockSocialAccountRepository.save).toHaveBeenCalledWith(newSocialAccount);
        });

        it('should handle existing social account', async () => {
            mockSocialAccountRepository.findOne.mockResolvedValue(
                mockSocialAccount as SocialAccount,
            );
            await expect(service.linkSocialAccount(socialData)).rejects.toThrow(
                BadRequestException,
            );
        });
    });

    describe('create', () => {
        const createUserDto: CreateUserDto = {
            username: 'newuser',
            email: 'newuser@example.com',
            password: 'password123',
            role: UserRole.USER,
        };

        beforeEach(() => {
            mockRepository.findOne.mockResolvedValue(null); // No existing user
        });

        it('should create a new user', async () => {
            const result = await service.create(createUserDto);
            expect(result).toBeDefined();
            expect(mockRepository.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    username: createUserDto.username,
                    email: createUserDto.email,
                    password: 'hashedpassword',
                }),
            );
        });

        it('should create Firebase document for new user', async () => {
            const result = await service.create(createUserDto);
            expect(result).toBeDefined();
            expect(mockFirebaseService.addDocument).toHaveBeenCalledWith(
                'users',
                expect.any(Object),
                '1',
            );
        });

        it('should send notifications for new user', async () => {
            const result = await service.create(createUserDto);
            expect(result).toBeDefined();
            expect(mockNotificationService.sendNotificationToUser).toHaveBeenCalled();
        });
    });

    describe('update', () => {
        const updateUserDto: UpdateUserDto = {
            username: 'updateduser',
            email: 'updated@example.com',
            notificationPrefs: {
                email: false,
                push: true,
                frequency: 'daily',
            },
        };

        beforeEach(() => {
            mockRepository.findOne.mockResolvedValue({ ...mockUser, ...updateUserDto } as User);
        });

        it('should update user successfully', async () => {
            const updatedUser = {
                ...mockUser,
                username: updateUserDto.username,
                email: updateUserDto.email,
                notificationPrefs: updateUserDto.notificationPrefs,
            };
            mockRepository.save.mockResolvedValue(updatedUser as User);

            const result = await service.update('1', updateUserDto);
            expect(result).toBeDefined();
            expect(mockRepository.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: '1',
                    username: updateUserDto.username,
                    email: updateUserDto.email,
                    notificationPrefs: updateUserDto.notificationPrefs,
                }),
            );
        });

        it('should update user in Firebase', async () => {
            await service.update('1', updateUserDto);
            expect(mockFirebaseService.updateDocument).toHaveBeenCalledWith(
                'users',
                '1',
                expect.any(Object),
            );
        });
        it('should handle Firebase update error gracefully', async () => {
            const updatedUser = {
                ...mockUser,
                ...updateUserDto,
            };
            mockRepository.findOne.mockResolvedValue(mockUser as User);
            mockRepository.save.mockResolvedValue(updatedUser as User);
            const firebaseError = new Error('Firebase error');
            mockFirebaseService.updateDocument.mockRejectedValueOnce(firebaseError);

            await service.update('1', updateUserDto);
            await new Promise(process.nextTick); // Allow async operations to complete

            expect(mockFirebaseService.updateDocument).toHaveBeenCalled();
            expect(loggerErrorSpy).toHaveBeenCalledWith(
                'Failed to update user in Firebase: Firebase error',
            );
        });
    });

    describe('softDelete', () => {
        beforeEach(() => {
            mockRepository.findOne.mockResolvedValue(mockUser as User);
        });

        it('should soft delete user', async () => {
            const result = await service.softDelete('1');
            expect(result).toBeDefined();
            expect(mockRepository.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: '1',
                    isActive: false,
                }),
            );
            expect(mockFirebaseService.updateDocument).toHaveBeenCalledWith('users', '1', {
                isActive: false,
            });
        });
        it('should throw NotFoundException when user not found', async () => {
            mockRepository.findOne.mockResolvedValue(null);
            mockFirebaseService.getDocumentById.mockResolvedValue(null);
            await expect(service.softDelete('1')).rejects.toThrow(NotFoundException);
        });
        it('should handle Firebase update error gracefully', async () => {
            mockRepository.findOne.mockResolvedValue(mockUser as User);
            const firebaseError = new Error('Firebase error');
            mockFirebaseService.updateDocument.mockRejectedValueOnce(firebaseError);

            await service.softDelete('1');
            await new Promise(process.nextTick); // Allow async operations to complete

            expect(mockFirebaseService.updateDocument).toHaveBeenCalled();
            expect(loggerErrorSpy).toHaveBeenCalledWith(
                'Failed to update user active status in Firebase: Firebase error',
            );
        });
    });

    describe('updatePassword', () => {
        const oldPassword = 'oldpass';
        const newPassword = 'newpass';

        beforeEach(() => {
            (bcrypt.compare as jest.Mock).mockImplementation(() => Promise.resolve(true));
            (bcrypt.hash as jest.Mock).mockImplementation(() => Promise.resolve('newhashed'));
        });

        it('should throw BadRequestException for wrong old password', async () => {
            (bcrypt.compare as jest.Mock).mockImplementation(() => Promise.resolve(false));
            await expect(service.updatePassword('1', 'wrongpassword', newPassword)).rejects.toThrow(
                BadRequestException,
            );
        });

        it('should update the password successfully', async () => {
            const result = await service.updatePassword('1', oldPassword, newPassword);
            expect(result).toBeDefined();
            expect(mockRepository.save).toHaveBeenCalled();
        });
    });
});
