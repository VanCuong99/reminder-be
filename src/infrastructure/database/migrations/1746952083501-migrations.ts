import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1746952083501 implements MigrationInterface {
    name = 'Migrations1746952083501';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE "guest_device" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "deviceId" character varying NOT NULL, "firebaseToken" character varying, "timezone" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_05adb73ee8ecc9b8f84026d4ba4" UNIQUE ("deviceId"), CONSTRAINT "PK_1baae05a5dd0c97afd0f8967802" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(`ALTER TABLE "event" ADD "deviceId" character varying`);
        await queryRunner.query(
            `ALTER TABLE "event" DROP CONSTRAINT "FK_01cd2b829e0263917bf570cb672"`,
        );
        await queryRunner.query(`ALTER TABLE "event" ALTER COLUMN "userId" DROP NOT NULL`);
        await queryRunner.query(
            `ALTER TABLE "event" ADD CONSTRAINT "FK_01cd2b829e0263917bf570cb672" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "event" ADD CONSTRAINT "FK_ff644ffdb3cdf2880ce8ef0356c" FOREIGN KEY ("deviceId") REFERENCES "guest_device"("deviceId") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "event" DROP CONSTRAINT "FK_ff644ffdb3cdf2880ce8ef0356c"`,
        );
        await queryRunner.query(
            `ALTER TABLE "event" DROP CONSTRAINT "FK_01cd2b829e0263917bf570cb672"`,
        );
        await queryRunner.query(`ALTER TABLE "event" ALTER COLUMN "userId" SET NOT NULL`);
        await queryRunner.query(
            `ALTER TABLE "event" ADD CONSTRAINT "FK_01cd2b829e0263917bf570cb672" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(`ALTER TABLE "event" DROP COLUMN "deviceId"`);
        await queryRunner.query(`DROP TABLE "guest_device"`);
    }
}
