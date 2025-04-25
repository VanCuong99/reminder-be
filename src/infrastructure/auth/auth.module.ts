// src/infrastructure/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserModule } from '../../presentation/user.module';
import { AuthResolver } from '../../presentation/graphql/resolvers/auth.resolver';
import { JwtStrategy } from './strategies/jwt.srategies';
import { AuthService } from 'src/application/services/auth/auth.service';
@Module({
    imports: [
        UserModule,
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET'),
                signOptions: {
                    expiresIn: configService.get<string>('JWT_EXPIRATION', '1h'),
                },
            }),
            inject: [ConfigService],
        }),
        ConfigModule,
    ],
    providers: [AuthService, JwtStrategy, AuthResolver],
    exports: [AuthService],
})
export class AuthModule {}
