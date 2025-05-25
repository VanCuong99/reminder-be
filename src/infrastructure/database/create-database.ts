// create-database.ts
import { Client } from 'pg';
import { config } from 'dotenv';
import * as path from 'path';

// Ensure .env file is loaded with absolute path
const envPath = path.resolve(process.cwd(), '.env');
config({ path: envPath });

async function createDatabase() {
    // Create a client to connect to the default postgres database
    const client = new Client({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432', 10),
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: 'postgres', // Connect to default postgres database
    });

    const dbName = process.env.DB_NAME || 'momentobe';

    try {
        await client.connect();
        console.log('Connected to PostgreSQL');

        // Check if database already exists
        const checkResult = await client.query(
            `
      SELECT 1 FROM pg_database WHERE datname = $1
    `,
            [dbName],
        );

        if (checkResult.rows.length === 0) {
            // Create database if it doesn't exist
            await client.query(`CREATE DATABASE ${dbName}`);
            console.log(`Database "${dbName}" created successfully`);
        } else {
            console.log(`Database "${dbName}" already exists`);
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.end();
        console.log('Connection closed');
    }
}

// Execute the function
createDatabase().catch(console.error);
