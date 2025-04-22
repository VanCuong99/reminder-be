import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { bootstrap } from './main';

jest.mock('@nestjs/core', () => ({
    NestFactory: {
        create: jest.fn(),
    },
}));

describe('main.ts bootstrap', () => {
    let mockApp: any;

    beforeEach(() => {
        mockApp = {
            enableCors: jest.fn(),
            useGlobalPipes: jest.fn(),
            listen: jest.fn().mockResolvedValue(undefined),
            getUrl: jest.fn().mockResolvedValue('http://localhost:3001'),
        };

        (NestFactory.create as jest.Mock).mockResolvedValue(mockApp);
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    it('should bootstrap the app without crashing', async () => {
        const app = await bootstrap();

        expect(NestFactory.create).toHaveBeenCalledWith(AppModule);
        expect(mockApp.enableCors).toHaveBeenCalled();
        expect(mockApp.useGlobalPipes).toHaveBeenCalledWith(expect.any(ValidationPipe));
        expect(mockApp.listen).toHaveBeenCalledWith(3001);
        expect(mockApp.getUrl).toHaveBeenCalledTimes(2);
        expect(app).toBe(mockApp);
    });

    it('should throw if NestFactory.create fails', async () => {
        (NestFactory.create as jest.Mock).mockRejectedValue(new Error('Factory failed'));

        await expect(bootstrap()).rejects.toThrow('Factory failed');
    });

    it('should throw if app.listen fails', async () => {
        mockApp.listen.mockRejectedValue(new Error('Listen error'));

        await expect(bootstrap()).rejects.toThrow('Listen error');
    });

    it('should throw if app.getUrl fails', async () => {
        mockApp.getUrl.mockRejectedValue(new Error('Get URL error'));

        await expect(bootstrap()).rejects.toThrow('Get URL error');
    });

    it('should log correct URLs', async () => {
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        mockApp.getUrl.mockResolvedValue('http://localhost:3001');

        await bootstrap();

        expect(logSpy).toHaveBeenCalledWith('Application is running on: http://localhost:3001');
        expect(logSpy).toHaveBeenCalledWith(
            'GraphQL Playground is available at: http://localhost:3001/graphql',
        );

        logSpy.mockRestore();
    });
});
