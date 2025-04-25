import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceToken } from '../../../domain/entities/device-token.entity';
import { User } from '../../../domain/entities/user.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DeviceTokenService {
    constructor(
        @InjectRepository(DeviceToken)
        private readonly deviceTokenRepository: Repository<DeviceToken>,
        private readonly configService: ConfigService,
    ) {}

    private validateFcmToken(token: string): boolean {
        const isTestMode = this.configService.get('NODE_ENV') !== 'production';

        if (isTestMode) {
            // In test mode, accept any token that starts with 'test_' or a valid FCM token
            if (token.startsWith('test_')) {
                return true;
            }
        }

        // Production validation: FCM tokens are base64 strings typically 140-200 characters
        const fcmTokenRegex = /^[A-Za-z0-9_-]{140,200}$/;
        return fcmTokenRegex.test(token);
    }

    async saveToken(user: User, token: string, deviceType: string): Promise<DeviceToken> {
        if (!this.validateFcmToken(token)) {
            throw new BadRequestException('Invalid FCM registration token format');
        }

        let deviceToken = await this.deviceTokenRepository.findOne({
            where: { token, userId: user.id },
        });

        if (!deviceToken) {
            deviceToken = this.deviceTokenRepository.create({
                user,
                token,
                deviceType,
                userId: user.id,
            });
        }

        deviceToken.isActive = true;
        return this.deviceTokenRepository.save(deviceToken);
    }

    async deactivateToken(token: string): Promise<void> {
        await this.deviceTokenRepository.update({ token }, { isActive: false });
    }

    async getUserActiveTokens(userId: string): Promise<DeviceToken[]> {
        return this.deviceTokenRepository.find({
            where: { userId, isActive: true },
            relations: ['user'],
        });
    }

    async getAllActiveTokens(): Promise<DeviceToken[]> {
        return this.deviceTokenRepository.find({
            where: { isActive: true },
            relations: ['user'],
        });
    }
}
