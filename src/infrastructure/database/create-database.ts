import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';

config();

const configService = new ConfigService();

async function createDatabase() {
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

        // Kiểm tra database có tồn tại không (không phân biệt chữ hoa/thường)
        const databases = await queryRunner.query(
            `SELECT datname FROM pg_database WHERE LOWER(datname) = LOWER('${databaseName}')`,
        );

        if (databases.length === 0) {
            // Tạo database mới với tên chính xác
            await queryRunner.query(`CREATE DATABASE "${databaseName}"`);
            console.log(`Database ${databaseName} created successfully`);

            // Đợi một chút để đảm bảo database được tạo hoàn toàn
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Kiểm tra kết nối đến database mới
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
            // Kiểm tra kết nối đến database hiện có
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

createDatabase();
