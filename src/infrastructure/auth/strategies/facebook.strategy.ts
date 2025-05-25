import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-facebook';
import { ConfigService } from '@nestjs/config';

type FacebookVerifyFunction = (error: any, user: any, info?: any) => void;

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
    constructor(configService: ConfigService) {
        super({
            clientID: configService.get<string>('FACEBOOK_CLIENT_ID'),
            clientSecret: configService.get<string>('FACEBOOK_CLIENT_SECRET'),
            callbackURL: configService.get<string>('FACEBOOK_CALLBACK_URL'),
            profileFields: ['id', 'emails', 'name', 'displayName', 'photos'],
            scope: ['email'],
        });
    }
    async validate(
        accessToken: string,
        refreshToken: string,
        profile: Profile,
        done: FacebookVerifyFunction,
    ): Promise<any> {
        const { id, emails, displayName, photos } = profile;
        const user = {
            socialId: id,
            email: emails?.[0]?.value,
            name: displayName,
            avatar: Array.isArray(photos) && photos[0] ? photos[0].value : undefined,
            provider: 'facebook',
            accessToken,
            refreshToken,
        };
        done(null, user);
        return user;
    }
}
