import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateUserEntity1748192515784 implements MigrationInterface {
    name = 'UpdateUserEntity1748192515784';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE "profile" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean NOT NULL DEFAULT true, "displayName" character varying, "avatar" character varying, "bio" text, "timezone" character varying, "preferences" json, CONSTRAINT "PK_3dd8bfc97e4a77c70971591bdcb" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE TYPE "public"."identity_method_enum" AS ENUM('local', 'social', 'guest')`,
        );
        await queryRunner.query(
            `CREATE TABLE "identity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean NOT NULL DEFAULT true, "method" "public"."identity_method_enum" NOT NULL, "provider" character varying, "providerId" character varying, "credentials" json, "profile" json, "lastUsedAt" TIMESTAMP, "userId" uuid, CONSTRAINT "PK_ff16a44186b286d5e626178f726" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "timezone"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "notificationPrefs"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "avatar"`);
        await queryRunner.query(`ALTER TABLE "user" ADD "lastLoginAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "user" ADD "lastLoginProvider" character varying`);
        await queryRunner.query(`ALTER TABLE "user" ADD "lastLoginIp" character varying`);
        await queryRunner.query(`ALTER TABLE "user" ADD "lastUserAgent" character varying`);
        await queryRunner.query(`ALTER TABLE "user" ADD "loginCount" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(
            `ALTER TABLE "user" ADD "failedAttempts" integer NOT NULL DEFAULT '0'`,
        );
        await queryRunner.query(`ALTER TABLE "user" ADD "profileId" uuid`);
        await queryRunner.query(
            `ALTER TABLE "user" ADD CONSTRAINT "UQ_9466682df91534dd95e4dbaa616" UNIQUE ("profileId")`,
        );
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "username" DROP NOT NULL`);
        await queryRunner.query(
            `ALTER TABLE "user" ADD CONSTRAINT "UQ_78a916df40e02a9deb1c4b75edb" UNIQUE ("username")`,
        );
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "email" DROP NOT NULL`);
        await queryRunner.query(
            `ALTER TABLE "identity" ADD CONSTRAINT "FK_12915039d2868ab654567bf5181" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "user" ADD CONSTRAINT "FK_9466682df91534dd95e4dbaa616" FOREIGN KEY ("profileId") REFERENCES "profile"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "user" DROP CONSTRAINT "FK_9466682df91534dd95e4dbaa616"`,
        );
        await queryRunner.query(
            `ALTER TABLE "identity" DROP CONSTRAINT "FK_12915039d2868ab654567bf5181"`,
        );
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "email" SET NOT NULL`);
        await queryRunner.query(
            `ALTER TABLE "user" DROP CONSTRAINT "UQ_78a916df40e02a9deb1c4b75edb"`,
        );
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "username" SET NOT NULL`);
        await queryRunner.query(
            `ALTER TABLE "user" DROP CONSTRAINT "UQ_9466682df91534dd95e4dbaa616"`,
        );
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "profileId"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "failedAttempts"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "loginCount"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "lastUserAgent"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "lastLoginIp"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "lastLoginProvider"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "lastLoginAt"`);
        await queryRunner.query(`ALTER TABLE "user" ADD "avatar" character varying`);
        await queryRunner.query(`ALTER TABLE "user" ADD "notificationPrefs" json`);
        await queryRunner.query(
            `ALTER TABLE "user" ADD "timezone" character varying NOT NULL DEFAULT 'UTC'`,
        );
        await queryRunner.query(`DROP TABLE "identity"`);
        await queryRunner.query(`DROP TYPE "public"."identity_method_enum"`);
        await queryRunner.query(`DROP TABLE "profile"`);
    }
}
