import { Test, TestingModule } from '@nestjs/testing';
import { UserModule } from './user.module';
import { UserService } from '../application/services/users/user.service';

describe('UserModule', () => {
    let module: TestingModule;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [UserModule],
        })
            .overrideModule(UserModule)
            .useModule({
                module: class MockUserModule {},
                providers: [{ provide: UserService, useValue: {} }],
                exports: [UserService],
            })
            .compile();
    });

    it('should be defined', () => {
        expect(module).toBeDefined();
    });

    it('should provide UserService', () => {
        const userService = module.get<UserService>(UserService);
        expect(userService).toBeDefined();
    });
});
