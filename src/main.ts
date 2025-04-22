// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

export async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    app.enableCors();
    app.useGlobalPipes(new ValidationPipe());
    await app.listen(3001);

    console.log(`Application is running on: ${await app.getUrl()}`);
    console.log(`GraphQL Playground is available at: ${await app.getUrl()}/graphql`);

    return app;
}

// ✅ Chỉ gọi khi file chạy trực tiếp, không gọi khi test
if (require.main === module) {
    bootstrap();
}
