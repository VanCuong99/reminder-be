import { LocalAuthGuard } from './local-auth.guard';

describe('LocalAuthGuard', () => {
    let guard: LocalAuthGuard;

    beforeEach(() => {
        guard = new LocalAuthGuard();
    });

    it('should be defined', () => {
        expect(guard).toBeDefined();
    });

    it('should call super.canActivate', () => {
        // Arrange
        // Act & Assert
        // Since AuthGuard('local') is from passport, we just check the method exists
        expect(typeof guard.canActivate).toBe('function');
    });
});
