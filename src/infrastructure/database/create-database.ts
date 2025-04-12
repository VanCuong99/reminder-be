// create-database.ts
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';

config();

export async function createDatabase(configService: ConfigService = new ConfigService()) {
    const defaultDb = configService.get('DEFAULT_DB');
    if (!defaultDb) {
        console.error('DEFAULT_DB environment variable is not set');
        process.exit(1);
    }

    const defaultDataSource = new DataSource({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: defaultDb,
    });

    try {
        await defaultDataSource.initialize();
        const queryRunner = defaultDataSource.createQueryRunner();
        const databaseName = configService.get('DB_NAME');

        const databases = await queryRunner.query(
            `SELECT datname FROM pg_database WHERE LOWER(datname) = LOWER('${databaseName}')`,
        );

        if (databases.length === 0) {
            await queryRunner.query(`CREATE DATABASE "${databaseName}"`);
            console.log(`Database ${databaseName} created successfully`);
            await new Promise(resolve => setTimeout(resolve, 1000));

            const newDataSource = new DataSource({
                type: 'postgres',
                host: configService.get('DB_HOST'),
                port: configService.get('DB_PORT'),
                username: configService.get('DB_USERNAME'),
                password: configService.get('DB_PASSWORD'),
                database: databaseName,
            });

            await newDataSource.initialize();
            await newDataSource.destroy();
            console.log(`Database ${databaseName} is ready for use`);
        } else {
            const existingDataSource = new DataSource({
                type: 'postgres',
                host: configService.get('DB_HOST'),
                port: configService.get('DB_PORT'),
                username: configService.get('DB_USERNAME'),
                password: configService.get('DB_PASSWORD'),
                database: databaseName,
            });

            try {
                await existingDataSource.initialize();
                await existingDataSource.destroy();
                console.log(`Database ${databaseName} exists and is accessible`);
            } catch (error) {
                console.error(`Database ${databaseName} exists but is not accessible:`, error);
                process.exit(1);
            }
        }

        await queryRunner.release();
        await defaultDataSource.destroy();
    } catch (error) {
        console.error('Error creating database:', error);
        process.exit(1);
    }
}
