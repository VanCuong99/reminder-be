import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDeviceTokenTable1745575204873 implements MigrationInterface {
    name = 'CreateDeviceTokenTable1745575204873';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE "device_token" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "token" character varying NOT NULL, "deviceType" character varying NOT NULL, "userId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_592ce89b9ea1a268d6140f60422" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `ALTER TABLE "device_token" ADD CONSTRAINT "FK_ba0cbbc3097f061e197e71c112e" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "device_token" DROP CONSTRAINT "FK_ba0cbbc3097f061e197e71c112e"`,
        );
        await queryRunner.query(`DROP TABLE "device_token"`);
    }
}
