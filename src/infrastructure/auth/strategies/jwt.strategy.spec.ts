import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.srategies';
import { UserService } from '../../../application/services/users/user.service';

describe('JwtStrategy', () => {
    let strategy: JwtStrategy;
    let configService: ConfigService;
    let userService: UserService;

    beforeEach(() => {
        configService = {
            get: jest.fn().mockReturnValue('test-secret'),
        } as any;

        userService = {
            findOne: jest.fn(),
        } as any;

        strategy = new JwtStrategy(configService, userService);
    });

    it('should be defined', () => {
        expect(strategy).toBeDefined();
    });

    it('should validate and return user if active', async () => {
        const mockUser = {
            id: '123',
            isActive: true,
        };

        (userService.findOne as jest.Mock).mockResolvedValue(mockUser);

        const result = await strategy.validate({ sub: '123' });

        expect(userService.findOne).toHaveBeenCalledWith('123');
        expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException if user is not active', async () => {
        const mockUser = {
            id: '123',
            isActive: false,
        };

        (userService.findOne as jest.Mock).mockResolvedValue(mockUser);

        await expect(strategy.validate({ sub: '123' })).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user is not found', async () => {
        (userService.findOne as jest.Mock).mockResolvedValue(null);

        await expect(strategy.validate({ sub: '123' })).rejects.toThrow(UnauthorizedException);
    });
});
