import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FirebaseModule } from './firebase.module';
import { FirebaseService } from './firebase.service';

describe('FirebaseModule', () => {
    let module: TestingModule;
    const mockConfigService = {
        get: jest.fn().mockImplementation((key: string) => {
            switch (key) {
                case 'FIREBASE_PROJECT_ID':
                    return 'test-project';
                case 'FIREBASE_PRIVATE_KEY':
                    return 'test-private-key';
                case 'FIREBASE_CLIENT_EMAIL':
                    return 'test@test.com';
                default:
                    return undefined;
            }
        }),
    };

    beforeEach(async () => {
        module = await Test.createTestingModule({
            imports: [FirebaseModule],
        })
            .overrideProvider(ConfigService)
            .useValue(mockConfigService)
            .compile();
    });

    it('should be defined', () => {
        expect(module).toBeDefined();
    });

    it('should provide FirebaseService', () => {
        const firebaseService = module.get<FirebaseService>(FirebaseService);
        expect(firebaseService).toBeDefined();
    });

    it('should export FirebaseService', () => {
        const exports = Reflect.getMetadata('exports', FirebaseModule);
        expect(exports).toContain(FirebaseService);
    });

    it('should be marked as global module', () => {
        const isGlobal = Reflect.getMetadata('__module:global__', FirebaseModule);
        expect(isGlobal).toBe(true);
    });
});
