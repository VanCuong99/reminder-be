import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from '../../domain/entities/user.entity';
import { DeviceToken } from '../../domain/entities/device-token.entity';

@Module({
    imports: [
        ConfigModule,
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                type: 'postgres',
                host: configService.get('DB_HOST'),
                port: parseInt(configService.get('DB_PORT') ?? '5432', 10),
                username: configService.get('DB_USERNAME'),
                password: configService.get('DB_PASSWORD'),
                database: configService.get('DB_NAME'),
                entities: [User, DeviceToken],
                migrations: ['dist/infrastructure/database/migrations/*{.ts,.js}'],
                synchronize: false,
                logging: true,
            }),
            inject: [ConfigService],
        }),
    ],
})
export class DatabaseModule {}
