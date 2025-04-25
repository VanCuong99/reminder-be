import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import * as bcrypt from 'bcryptjs';
import { UserRole } from 'src/shared/constants/user-role.enum';
import { UserService } from '../users/user.service';

jest.mock('bcryptjs');

describe('AuthService', () => {
    let service: AuthService;
    let userService: UserService;
    let jwtService: JwtService;

    const mockUser = {
        id: '1',
        email: 'test@example.com',
        password: 'hashedPassword',
        role: UserRole.USER,
        username: 'testuser',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: UserService,
                    useValue: {
                        findOneByEmail: jest.fn(),
                    },
                },
                {
                    provide: JwtService,
                    useValue: {
                        sign: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
        userService = module.get<UserService>(UserService);
        jwtService = module.get<JwtService>(JwtService);
    });

    describe('validateUser', () => {
        it('should return user without password if validation is successful', async () => {
            const { password, ...userWithoutPassword } = mockUser;

            jest.spyOn(userService, 'findOneByEmail').mockResolvedValue(mockUser);
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);

            const result = await service.validateUser('test@example.com', 'password123');

            expect(result).toEqual(userWithoutPassword);
            expect(userService.findOneByEmail).toHaveBeenCalledWith('test@example.com');
            expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashedPassword');
        });

        it('should return null if user is not found', async () => {
            jest.spyOn(userService, 'findOneByEmail').mockResolvedValue(null);

            const result = await service.validateUser('nonexistent@example.com', 'password123');

            expect(result).toBeNull();
            expect(userService.findOneByEmail).toHaveBeenCalledWith('nonexistent@example.com');
        });

        it('should return null if password is invalid', async () => {
            jest.spyOn(userService, 'findOneByEmail').mockResolvedValue(mockUser);
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);

            const result = await service.validateUser('test@example.com', 'wrongpassword');

            expect(result).toBeNull();
            expect(bcrypt.compare).toHaveBeenCalledWith('wrongpassword', 'hashedPassword');
        });
    });

    describe('login', () => {
        it('should return access token and user data if login is successful', async () => {
            const loginInput = {
                email: 'test@example.com',
                password: 'password123',
            };

            const { password, ...userWithoutPassword } = mockUser;

            jest.spyOn(service, 'validateUser').mockResolvedValue(userWithoutPassword);
            jest.spyOn(jwtService, 'sign').mockReturnValue('jwt_token');

            const result = await service.login(loginInput);

            expect(result).toEqual({
                access_token: 'jwt_token',
                user: userWithoutPassword,
            });
            expect(jwtService.sign).toHaveBeenCalledWith({
                email: mockUser.email,
                sub: mockUser.id,
                role: mockUser.role,
            });
        });

        it('should throw UnauthorizedException if login fails', async () => {
            const loginInput = {
                email: 'test@example.com',
                password: 'wrongpassword',
            };

            jest.spyOn(service, 'validateUser').mockResolvedValue(null);

            await expect(service.login(loginInput)).rejects.toThrow(
                new UnauthorizedException('Invalid credentials'),
            );
        });
    });
});
