import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

export async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // Enable CORS
    app.enableCors();

    // Enable validation pipes
    app.useGlobalPipes(new ValidationPipe());

    await app.listen(3001);
    console.log(`Application is running on: ${await app.getUrl()}`);
    console.log(`GraphQL Playground is available at: ${await app.getUrl()}/graphql`);
    return app;
}

bootstrap();
