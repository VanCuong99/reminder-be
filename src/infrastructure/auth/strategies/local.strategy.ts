import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../../../application/services/auth/auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
    private readonly logger = new Logger(LocalStrategy.name);

    constructor(private readonly authService: AuthService) {
        super({
            usernameField: 'email',
        });
        this.logger.log('LocalStrategy initialized with email as username field');
    }

    async validate(email: string, password: string): Promise<any> {
        this.logger.log(`LocalStrategy.validate called for email: ${email}`);

        if (!email || !password) {
            this.logger.error(
                `Missing credentials: email or password is ${!email ? 'missing email' : 'missing password'}`,
            );
            throw new UnauthorizedException('Email and password are required');
        }

        try {
            const user = await this.authService.validateUser(email, password);

            if (!user) {
                this.logger.warn(`Authentication failed for user: ${email}`);
                throw new UnauthorizedException('Invalid credentials');
            }

            this.logger.log(`User authenticated successfully: ${email} with ID: ${user.id}`);
            return user;
        } catch (error) {
            this.logger.error(`LocalStrategy validation error: ${error.message}`, error.stack);
            throw error;
        }
    }
}
