// src/infrastructure/auth/auth.module.ts
import {
    Module,
    DynamicModule,
    Global,
    MiddlewareConsumer,
    RequestMethod,
    Logger,
} from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { FacebookStrategy } from './strategies/facebook.strategy';
import { AuthService } from '../../application/services/auth/auth.service';
import { UserModule } from '../../presentation/user.module';
import { JwtConfigService } from './services/jwt-config.service';
import { DirectJwtAuthGuard } from './guards/direct-jwt-auth.guard';

import { JwtAuthMiddleware } from './middleware/jwt-auth.middleware';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Global()
@Module({})
export class AuthModule {
    private static readonly logger = new Logger(AuthModule.name);

    static forRoot(): DynamicModule {
        return {
            module: AuthModule,
            imports: [
                PassportModule,
                UserModule,
                JwtModule.registerAsync({
                    imports: [ConfigModule],
                    useFactory: async (jwtConfigService: JwtConfigService) => {
                        return jwtConfigService.jwtModuleOptions;
                    },
                    inject: [JwtConfigService],
                }),
            ],
            providers: [
                JwtConfigService,
                AuthService,
                LocalStrategy,
                JwtStrategy,
                JwtAuthMiddleware,
                JwtAuthGuard,
                DirectJwtAuthGuard,
                RolesGuard,
                GoogleStrategy,
                FacebookStrategy,
            ],
            exports: [
                JwtModule,
                AuthService,
                JwtAuthGuard,
                DirectJwtAuthGuard,
                RolesGuard,
                JwtConfigService,
            ],
        };
    }

    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(JwtAuthMiddleware)
            .exclude(
                // Public API routes                { path: '/api/v1/auth/login', method: RequestMethod.POST },
                { path: '/api/v1/auth/register', method: RequestMethod.POST },
                { path: '/api/v1/auth/refresh', method: RequestMethod.POST },
                { path: '/api/v1/auth/google', method: RequestMethod.GET },
                { path: '/api/v1/auth/google/callback', method: RequestMethod.GET },
                { path: '/api/v1/auth/facebook', method: RequestMethod.GET },
                { path: '/api/v1/auth/facebook/callback', method: RequestMethod.GET },
                // Health checks
                { path: '/api/v1/health', method: RequestMethod.GET },
                { path: '/health', method: RequestMethod.GET },

                // Root path and API documentation
                { path: '/', method: RequestMethod.GET },
                { path: '/api/docs', method: RequestMethod.GET },
                { path: '/api/docs/(.*)', method: RequestMethod.GET },
            )
            .forRoutes('*');
    }
}
