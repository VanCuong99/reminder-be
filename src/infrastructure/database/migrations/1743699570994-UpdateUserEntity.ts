import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateUserEntity1743699570994 implements MigrationInterface {
    name = 'UpdateUserEntity1743699570994';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."user_role_enum" AS ENUM('admin', 'user')`);
        await queryRunner.query(
            `ALTER TABLE "user" ADD "role" "public"."user_role_enum" NOT NULL DEFAULT 'user'`,
        );
        await queryRunner.query(
            `ALTER TABLE "user" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
        );
        await queryRunner.query(`ALTER TABLE "user" ADD "isActive" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(
            `ALTER TABLE "user" ADD CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email")`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "user" DROP CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22"`,
        );
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isActive"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "role"`);
        await queryRunner.query(`DROP TYPE "public"."user_role_enum"`);
    }
}
