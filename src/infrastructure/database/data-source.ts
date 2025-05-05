import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

// Đảm bảo load file .env
config();

const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [join(__dirname, '../../**/*.entity{.ts,.js}')],
    migrations: [join(__dirname, './migrations/*{.ts,.js}')],
    synchronize: false,
    logging: ['error', 'query', 'schema'],
    logger: 'advanced-console',
});

export default dataSource;
