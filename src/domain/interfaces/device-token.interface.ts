import { User } from '../entities/user.entity';

export enum DeviceType {
    IOS = 'ios',
    ANDROID = 'android',
    WEB = 'web',
}

export interface IDeviceToken {
    id: string;
    token: string;
    deviceType: DeviceType;
    user: User;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
}
