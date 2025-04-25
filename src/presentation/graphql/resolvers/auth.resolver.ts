// src/presentation/graphql/resolvers/auth.resolver.ts
import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { LoginInput } from '../types/auth/inputs/login.input';
import { AuthResponse } from '../types/auth/outputs/auth.response';
import { AuthService } from 'src/application/services/auth/auth.service';

@Resolver()
export class AuthResolver {
    constructor(private readonly authService: AuthService) {}

    @Mutation(() => AuthResponse)
    async login(@Args('input') loginInput: LoginInput) {
        return this.authService.login(loginInput);
    }
}
