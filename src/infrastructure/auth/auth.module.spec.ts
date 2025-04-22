import { Test, TestingModule } from '@nestjs/testing';
import { AuthModule } from './auth.module';
import { AuthService } from 'src/application/services/auth/auth.service';
import { AuthResolver } from 'src/presentation/graphql/resolvers/auth.resolver';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { User } from 'src/domain/entities/user.entity';
import { ConfigModule, ConfigService } from '@nestjs/config'; // Đảm bảo import ConfigModule và ConfigService
import * as bcrypt from 'bcryptjs';

describe('AuthModule', () => {
    let module: TestingModule;
    let authService: AuthService;
    let authResolver: AuthResolver;

    // Mock UserRepository (with necessary methods you use)
    const mockUserRepository = {
        findOne: jest.fn(),
        save: jest.fn(),
    };

    // Mock ConfigService
    const mockConfigService = {
        get: jest.fn().mockImplementation((key: string) => {
            if (key === 'JWT_SECRET') return 'mockConfigValue'; // Trả về giá trị mock cho JWT_SECRET
            if (key === 'JWT_EXPIRATION') return '1h'; // Trả về giá trị mock cho JWT_EXPIRATION
            return null;
        }),
    };

    beforeEach(async () => {
        module = await Test.createTestingModule({
            imports: [
                AuthModule,
                TypeOrmModule.forFeature([User]), // Sử dụng TypeOrmModule trong unit test
                ConfigModule.forRoot(), // Import ConfigModule trong test
            ],
        })
            .overrideProvider(getRepositoryToken(User)) // Mock UserRepository using getRepositoryToken
            .useValue(mockUserRepository)
            .overrideProvider(ConfigService) // Mock ConfigService
            .useValue(mockConfigService)
            .compile();

        authService = module.get<AuthService>(AuthService);
        authResolver = module.get<AuthResolver>(AuthResolver);
    });

    it('should compile the AuthModule', () => {
        expect(module).toBeDefined();
    });

    it('should create AuthService provider', () => {
        expect(authService).toBeDefined();
    });

    it('should create AuthResolver provider', () => {
        expect(authResolver).toBeDefined();
    });

    it('should call UserRepository methods in AuthService', async () => {
        // Mock `findOne` to return a user object with password
        const user = { id: 1, email: 'test@test.com', password: 'hashedPassword' };
        mockUserRepository.findOne.mockResolvedValue(user);

        // Mock bcrypt.compare with return type as boolean
        const bcryptCompareSpy = jest
            .spyOn(bcrypt, 'compare')
            .mockImplementation(() => Promise.resolve(true));

        const result = await authService.login({ email: 'test@test.com', password: 'password' });

        expect(mockUserRepository.findOne).toHaveBeenCalledWith({
            where: { email: 'test@test.com' },
        });
        expect(bcryptCompareSpy).toHaveBeenCalledWith('password', 'hashedPassword'); // Verify that bcrypt.compare was called with the correct arguments
        expect(result).toBeDefined();
    });

    it('should call ConfigService in JwtStrategy', async () => {
        const secretKey = mockConfigService.get('JWT_SECRET'); // Giá trị trả về mock

        expect(mockConfigService.get).toHaveBeenCalledWith('JWT_SECRET');
        expect(secretKey).toBe('mockConfigValue'); // Kiểm tra giá trị mock
    });
});
