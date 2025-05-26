import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey } from 'typeorm';

export class AddSocialAccountsAndUserAvatar1621509200000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add avatar column to user table
        await queryRunner.addColumn(
            'user',
            new TableColumn({
                name: 'avatar',
                type: 'varchar',
                isNullable: true,
            }),
        );

        // Create social_accounts table
        await queryRunner.createTable(
            new Table({
                name: 'social_accounts',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'uuid',
                    },
                    {
                        name: 'provider_id',
                        type: 'varchar',
                    },
                    {
                        name: 'provider',
                        type: 'varchar',
                    },
                    {
                        name: 'user_id',
                        type: 'uuid',
                    },
                    {
                        name: 'created_at',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                    },
                    {
                        name: 'updated_at',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                    },
                ],
            }),
            true,
        );

        // Add foreign key
        await queryRunner.createForeignKey(
            'social_accounts',
            new TableForeignKey({
                columnNames: ['user_id'],
                referencedColumnNames: ['id'],
                referencedTableName: 'user',
                onDelete: 'CASCADE',
            }),
        );

        // Add unique constraint
        await queryRunner.query(
            'CREATE UNIQUE INDEX idx_provider_id_provider ON social_accounts (provider_id, provider)',
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop social_accounts table (this will automatically drop the foreign key)
        await queryRunner.dropTable('social_accounts');

        // Drop avatar column from user table
        await queryRunner.dropColumn('user', 'avatar');
    }
}
