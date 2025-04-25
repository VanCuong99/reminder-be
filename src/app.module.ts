// src/app.module.ts
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './infrastructure/database/database.module';
import { UserModule } from './presentation/user.module';
import { AuthModule } from './infrastructure/auth/auth.module';
import { NotificationModule } from './infrastructure/messaging/notification.module';
import { DeviceTokenModule } from './application/services/device-token/device-token.module';
import * as depthLimit from 'graphql-depth-limit';
import { createComplexityLimitRule } from 'graphql-validation-complexity';
import * as Joi from 'joi';
import { join } from 'path';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            validationSchema: Joi.object({
                NODE_ENV: Joi.string()
                    .valid('development', 'production', 'test', 'provision')
                    .default('development'),
                JWT_SECRET: Joi.string().required(),
                JWT_EXPIRATION: Joi.string().default('1h'),
                ALLOWED_ORIGINS: Joi.string().required(),
                // Chỉ yêu cầu các biến Firebase trong môi trường production
                FIREBASE_PROJECT_ID: Joi.string().when('NODE_ENV', {
                    is: 'production',
                    then: Joi.required(),
                    otherwise: Joi.optional().default('mock-project-id'),
                }),
                FIREBASE_CLIENT_EMAIL: Joi.string().when('NODE_ENV', {
                    is: 'production',
                    then: Joi.required(),
                    otherwise: Joi.optional().default('mock-client-email@example.com'),
                }),
                FIREBASE_PRIVATE_KEY: Joi.string().when('NODE_ENV', {
                    is: 'production',
                    then: Joi.required(),
                    otherwise: Joi.optional().default('mock-private-key'),
                }),
                // ... other env validations
            }),
        }),
        GraphQLModule.forRoot<ApolloDriverConfig>({
            driver: ApolloDriver,
            autoSchemaFile: join(process.cwd(), 'schema.gql'),
            sortSchema: true,
            playground: {
                settings: {
                    'request.credentials': 'include',
                    'editor.theme': 'dark',
                    'editor.reuseHeaders': true,
                    'tracing.hideTracingResponse': false,
                    'queryPlan.hideQueryPlanResponse': false,
                    'editor.fontSize': 14,
                    'editor.fontFamily':
                        "'Source Code Pro', 'Consolas', 'Inconsolata', 'Droid Sans Mono', 'Monaco', monospace",
                },
            },
            debug: true,
            introspection: true,
            context: ({ req }) => ({ req }),
            validationRules: [depthLimit(5), createComplexityLimitRule(1000)],
        }),
        ThrottlerModule.forRoot([
            {
                ttl: 60,
                limit: 10,
            },
        ]),
        DatabaseModule,
        UserModule,
        AuthModule,
        NotificationModule,
        DeviceTokenModule,
    ],
})
export class AppModule {}
