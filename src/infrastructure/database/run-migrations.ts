'use strict';

// This file is used to run migrations in production environment
const { DataSource } = require('typeorm');
const path = require('path');
require('dotenv').config();

async function runMigrations() {
    try {
        const dataSource = new DataSource({
            type: 'postgres',
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            username: process.env.DB_USERNAME || 'postgres',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'momentodb',
            entities: [path.join(__dirname, '../**/*.entity.js')],
            migrations: [path.join(__dirname, 'migrations/*.js')],
            synchronize: false,
            migrationsRun: false,
            logging: true,
        });

        await dataSource.initialize();
        console.log('Database connection initialized.');

        await dataSource.runMigrations();
        console.log('Migrations successfully ran.');

        await dataSource.destroy();
        console.log('Database connection closed.');
    } catch (error) {
        console.error('Error running migrations:', error);
        process.exit(1);
    }
}

runMigrations();
