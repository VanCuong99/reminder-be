import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateUsingBaseEntity1748255627697 implements MigrationInterface {
    name = 'UpdateUsingBaseEntity1748255627697';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "social_accounts" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "social_accounts" DROP COLUMN "updated_at"`);
        await queryRunner.query(
            `ALTER TABLE "social_accounts" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`,
        );
        await queryRunner.query(
            `ALTER TABLE "social_accounts" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
        );
        await queryRunner.query(
            `ALTER TABLE "social_accounts" ADD "isActive" boolean NOT NULL DEFAULT true`,
        );
        await queryRunner.query(`ALTER TABLE "user" ADD "timezone" character varying`);
        await queryRunner.query(`ALTER TABLE "user" ADD "notificationPrefs" jsonb`);
        await queryRunner.query(`ALTER TABLE "social_accounts" DROP COLUMN "provider"`);
        await queryRunner.query(
            `CREATE TYPE "public"."social_accounts_provider_enum" AS ENUM('local', 'google', 'facebook', 'github', 'registration', 'TokenRefresh')`,
        );
        await queryRunner.query(
            `ALTER TABLE "social_accounts" ADD "provider" "public"."social_accounts_provider_enum" NOT NULL DEFAULT 'local'`,
        );
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "lastLoginProvider"`);
        await queryRunner.query(
            `CREATE TYPE "public"."user_lastloginprovider_enum" AS ENUM('local', 'google', 'facebook', 'github', 'registration', 'TokenRefresh')`,
        );
        await queryRunner.query(
            `ALTER TABLE "user" ADD "lastLoginProvider" "public"."user_lastloginprovider_enum"`,
        );
        await queryRunner.query(`ALTER TABLE "identity" DROP COLUMN "provider"`);
        await queryRunner.query(
            `CREATE TYPE "public"."identity_provider_enum" AS ENUM('local', 'google', 'facebook', 'github', 'registration', 'TokenRefresh')`,
        );
        await queryRunner.query(
            `ALTER TABLE "identity" ADD "provider" "public"."identity_provider_enum"`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "identity" DROP COLUMN "provider"`);
        await queryRunner.query(`DROP TYPE "public"."identity_provider_enum"`);
        await queryRunner.query(`ALTER TABLE "identity" ADD "provider" character varying`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "lastLoginProvider"`);
        await queryRunner.query(`DROP TYPE "public"."user_lastloginprovider_enum"`);
        await queryRunner.query(`ALTER TABLE "user" ADD "lastLoginProvider" character varying`);
        await queryRunner.query(`ALTER TABLE "social_accounts" DROP COLUMN "provider"`);
        await queryRunner.query(`DROP TYPE "public"."social_accounts_provider_enum"`);
        await queryRunner.query(
            `ALTER TABLE "social_accounts" ADD "provider" character varying NOT NULL`,
        );
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "notificationPrefs"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "timezone"`);
        await queryRunner.query(`ALTER TABLE "social_accounts" DROP COLUMN "isActive"`);
        await queryRunner.query(`ALTER TABLE "social_accounts" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "social_accounts" DROP COLUMN "createdAt"`);
        await queryRunner.query(
            `ALTER TABLE "social_accounts" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
        );
        await queryRunner.query(
            `ALTER TABLE "social_accounts" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
        );
    }
}
