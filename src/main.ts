// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import * as compression from 'compression';
import helmet from 'helmet';
import * as morgan from 'morgan';
import { HttpExceptionFilter } from './presentation/interceptors/http-exception.filter';
import { LoggingInterceptor } from './presentation/interceptors/logging.interceptor';

export async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    const configService = app.get(ConfigService);

    // Global prefix for all routes
    app.setGlobalPrefix('api/v1');

    // Set up security middlewares
    app.use(
        helmet({
            crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
            crossOriginResourcePolicy: { policy: 'cross-origin' },
            contentSecurityPolicy: false,
        }),
    );

    // Parse cookies
    app.use(cookieParser());

    // Compress responses
    app.use(compression());

    // Request logging in development
    if (configService.get('NODE_ENV') !== 'production') {
        app.use(morgan('dev'));
    }

    // Enable CORS
    app.enableCors({
        origin: true, // Allow all origins in development
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-CSRF-Token',
            'Accept',
            'X-Requested-With',
        ],
        exposedHeaders: ['Set-Cookie', 'Authorization'],
        preflightContinue: false,
        optionsSuccessStatus: 204,
    });

    // Global pipes for validation
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            forbidNonWhitelisted: true,
            transformOptions: {
                enableImplicitConversion: true,
            },
        }),
    );

    // Global interceptors
    app.useGlobalInterceptors(new LoggingInterceptor());

    // Global exception filter
    app.useGlobalFilters(new HttpExceptionFilter());

    // Set up Swagger API documentation
    if (configService.get('NODE_ENV') !== 'production') {
        const config = new DocumentBuilder()
            .setTitle('Momento API')
            .setDescription('Momento REST API Documentation')
            .setVersion('1.0')
            .addTag('auth', 'Authentication endpoints')
            .addTag('users', 'User management endpoints')
            .addTag('events', 'Event management endpoints')
            .addTag('notifications', 'Notification management endpoints')
            .addTag('health', 'Health check endpoints')
            .addBearerAuth()
            .build();

        const document = SwaggerModule.createDocument(app, config);
        SwaggerModule.setup('api/docs', app, document);
    }

    // Trust proxy for production environments (if behind proxy/load balancer)
    if (configService.get('NODE_ENV') === 'production') {
        app.enableShutdownHooks();
        app.getHttpAdapter().getInstance().set('trust proxy', 1);
    }

    const port = configService.get<number>('PORT', 8000);

    await app.listen(port);

    console.log(`Application is running on: ${await app.getUrl()}`);

    return app; // Return the app instance
}

bootstrap();
