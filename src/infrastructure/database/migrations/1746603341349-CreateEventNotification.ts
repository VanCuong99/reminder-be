import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEventNotification1746603341349 implements MigrationInterface {
    name = 'CreateEventNotification1746603341349';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create event category enum
        await queryRunner.query(
            `CREATE TYPE "public"."event_category_enum" AS ENUM('personal', 'work', 'holiday', 'birthday', 'anniversary', 'other')`,
        );

        // Create event table
        await queryRunner.query(`CREATE TABLE "event" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(), 
            "name" character varying NOT NULL, 
            "description" text, 
            "date" TIMESTAMP WITH TIME ZONE NOT NULL, 
            "category" "public"."event_category_enum" NOT NULL DEFAULT 'other', 
            "isRecurring" boolean NOT NULL DEFAULT false, 
            "notificationSettings" json, 
            "userId" uuid NOT NULL, 
            "timezone" character varying, 
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(), 
            "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), 
            "isActive" boolean NOT NULL DEFAULT true, 
            CONSTRAINT "PK_30c2f3bbaf6d34a55f8ae6e4614" PRIMARY KEY ("id")
        )`);

        // Create notification enums
        await queryRunner.query(
            `CREATE TYPE "public"."notification_status_enum" AS ENUM('unread', 'read')`,
        );
        await queryRunner.query(
            `CREATE TYPE "public"."notification_type_enum" AS ENUM('event_created', 'event_updated', 'reminder', 'system')`,
        );

        // Create notification table
        await queryRunner.query(`CREATE TABLE "notification" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(), 
            "title" character varying NOT NULL, 
            "content" text NOT NULL, 
            "status" "public"."notification_status_enum" NOT NULL DEFAULT 'unread', 
            "type" "public"."notification_type_enum" NOT NULL DEFAULT 'system', 
            "userId" uuid NOT NULL, 
            "eventId" uuid, 
            "expiresAt" TIMESTAMP WITH TIME ZONE, 
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(), 
            "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), 
            "isActive" boolean NOT NULL DEFAULT true, 
            CONSTRAINT "PK_705b6c7cdf9b2c2ff7ac7872cb7" PRIMARY KEY ("id")
        )`);

        // Add foreign key constraints
        await queryRunner.query(
            `ALTER TABLE "event" ADD CONSTRAINT "FK_01cd2b829e0263917bf570cb672" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "notification" ADD CONSTRAINT "FK_1ced25315eb974b73391fb1c81b" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "notification" ADD CONSTRAINT "FK_4d8dd208e427731306a6be66add" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove foreign keys
        await queryRunner.query(
            `ALTER TABLE "notification" DROP CONSTRAINT "FK_4d8dd208e427731306a6be66add"`,
        );
        await queryRunner.query(
            `ALTER TABLE "notification" DROP CONSTRAINT "FK_1ced25315eb974b73391fb1c81b"`,
        );
        await queryRunner.query(
            `ALTER TABLE "event" DROP CONSTRAINT "FK_01cd2b829e0263917bf570cb672"`,
        );

        // Drop notification table and types
        await queryRunner.query(`DROP TABLE "notification"`);
        await queryRunner.query(`DROP TYPE "public"."notification_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notification_status_enum"`);

        // Drop event table and types
        await queryRunner.query(`DROP TABLE "event"`);
        await queryRunner.query(`DROP TYPE "public"."event_category_enum"`);
    }
}
