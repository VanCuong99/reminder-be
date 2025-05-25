import {
    Controller,
    Post,
    Req,
    Res,
    UnauthorizedException,
    UseGuards,
    Get,
    Body,
    Logger,
    BadRequestException,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../../application/services/auth/auth.service';
import { AuthGuard } from '@nestjs/passport';
import { LocalAuthGuard } from '../../infrastructure/auth/guards/local-auth.guard';
import { DirectJwtAuthGuard } from '../../infrastructure/auth/guards/direct-jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { LoginDto } from '../dto/auth/login.dto';
import { AuthResponse } from '../../application/interfaces/auth/auth-response.interface';
import { RegisterDto } from '../dto/auth/register.dto';
import { UserService } from '../../application/services/users/user.service';
import { TimezoneService } from '../../shared/services/timezone.service';
import { TokenValidationService } from '../../shared/services/token-validation.service';
import { AuthenticatedRequest, AuthSuccessResponse } from '../interfaces/auth.interface';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    private readonly logger = new Logger(AuthController.name);

    constructor(
        private readonly authService: AuthService,
        private readonly configService: ConfigService,
        private readonly userService: UserService,
        private readonly timezoneService: TimezoneService,
        private readonly tokenValidationService: TokenValidationService,
    ) {}

    @ApiOperation({ summary: 'User registration' })
    @ApiResponse({ status: 201, description: 'User registered successfully' })
    @ApiResponse({
        status: 400,
        description: 'Bad request - validation error or email already exists',
    })
    @ApiBody({ type: RegisterDto, description: 'User registration data' })
    @Post('register')
    async register(
        @Body() registerDto: RegisterDto,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        this.logger.debug(`Registration attempt for email: ${registerDto.email}`);

        try {
            // Create user with UserService
            const user = await this.userService.create({
                username: registerDto.username,
                email: registerDto.email,
                password: registerDto.password,
                timezone: registerDto.timezone,
            });

            // Login automatically after registration
            const result: AuthResponse = await this.authService.login({
                email: user.email,
                password: registerDto.password, // Need to use the plain password here
            });

            this.logger.debug(`Registration successful for user: ${user.email}`);
            return this.handleAuthResponse(res, result, 'registration');
        } catch (error) {
            this.logger.error(`Registration failed: ${error.message}`);
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException(
                'Registration failed. Please check your input and try again.',
            );
        }
    }

    @ApiOperation({ summary: 'User login' })
    @ApiResponse({ status: 200, description: 'Login successful' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiBody({ type: LoginDto, description: 'User credentials' })
    @UseGuards(LocalAuthGuard)
    @HttpCode(HttpStatus.OK)
    @Post('login')
    async login(
        @Body() loginDto: LoginDto,
        @Req() req: AuthenticatedRequest,
        @Res({ passthrough: true }) res: Response,
    ) {
        this.logger.debug(`Login attempt for: ${loginDto.email}`);

        const result = await this.authService.login({
            email: loginDto.email,
            password: loginDto.password,
        });

        this.logger.debug(`Login successful for user: ${result.user.email}`);
        return this.handleAuthResponse(res, result);
    }

    @ApiOperation({ summary: 'User logout' })
    @ApiResponse({ status: 200, description: 'Logout successful' })
    @HttpCode(HttpStatus.OK)
    @Post('logout')
    async logout(@Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
        try {
            const accessToken = this.tokenValidationService.extractAccessToken(req);

            if (accessToken) {
                const tokenData = this.tokenValidationService.validateAndDecodeToken(accessToken);

                if (tokenData?.userId && tokenData?.tokenId) {
                    this.logger.debug(
                        `Logging out user ID: ${tokenData.userId}, token ID: ${tokenData.tokenId}`,
                    );
                    await this.authService.logout(tokenData.userId, tokenData.tokenId);
                }
            } else {
                this.logger.warn('No access token found in request for logout');
            }

            // Clear cookies regardless of token blacklisting
            this.tokenValidationService.clearAuthCookies(res);

            return {
                message: 'Logout successful',
            };
        } catch (error) {
            this.logger.error(`Logout error: ${error.message}`);
            // Still clear cookies and return success to client
            this.tokenValidationService.clearAuthCookies(res);
            return {
                message: 'Logout successful',
            };
        }
    }

    @ApiOperation({ summary: 'Refresh access token' })
    @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
    @ApiResponse({ status: 401, description: 'Invalid refresh token' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                refreshToken: {
                    type: 'string',
                    description: 'Refresh token for getting new access token',
                },
            },
            required: ['refreshToken'],
        },
    })
    @HttpCode(HttpStatus.OK)
    @Post('refresh')
    async refreshToken(
        @Req() req: AuthenticatedRequest,
        @Res({ passthrough: true }) res: Response,
        @Body() body: { refreshToken: string },
    ) {
        try {
            const refreshToken = this.tokenValidationService.extractRefreshToken(req, body);

            if (!refreshToken) {
                throw new UnauthorizedException('Refresh token not provided');
            }

            const tokenData = this.tokenValidationService.validateAndDecodeToken(refreshToken);
            if (!tokenData?.userId || !tokenData?.tokenId) {
                throw new UnauthorizedException('Failed to refresh token');
            }

            const result = await this.authService.refreshToken(tokenData.userId, tokenData.tokenId);

            this.logger.debug(`Token refreshed successfully for user: ${tokenData.userId}`);
            // Set message to 'Token refreshed successfully' for refreshToken endpoint
            return this.handleAuthResponse(res, result, 'TokenRefresh');
        } catch (error) {
            this.logger.error(`Token refresh error: ${error.message}`);
            // Clear any existing tokens on error
            this.tokenValidationService.clearAuthCookies(res);
            throw new UnauthorizedException('Failed to refresh token');
        }
    }

    @ApiOperation({ summary: 'Verify authentication' })
    @ApiResponse({ status: 200, description: 'User is authenticated' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiBearerAuth()
    @UseGuards(DirectJwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    @Get('me')
    async getProfile(@Req() req: AuthenticatedRequest) {
        this.logger.debug(
            `Auth/me endpoint accessed with headers: ${JSON.stringify({
                auth: req.headers.authorization ? 'present' : 'absent',
                csrf: req.headers['x-csrf-token'] ? 'present' : 'absent',
                cookie: req.cookies?.access_token ? 'present' : 'absent',
            })}`,
        );

        try {
            if (!req.user) {
                this.logger.warn('No user found in request after authentication');
                throw new UnauthorizedException('Authentication failed - no user found');
            }

            this.logger.debug(
                `User found in request: ${req.user.email || req.user.id || 'unknown'}`,
            );
            return this.tokenValidationService.transformProfileResponse(req.user);
        } catch (error) {
            this.logger.error(`Authentication error in /me endpoint: ${error.message}`);
            throw new UnauthorizedException('Authentication failed');
        }
    }

    @Get('google')
    @UseGuards(AuthGuard('google'))
    @ApiOperation({
        summary: 'Google OAuth2 login redirect',
        description: 'Redirects the user to Google for authentication',
    })
    @ApiResponse({
        status: 302,
        description: 'Redirects to Google authentication page',
    })
    async googleAuth() {
        // Guard redirects to Google
    }

    @Get('google/callback')
    @UseGuards(AuthGuard('google'))
    @ApiOperation({
        summary: 'Google OAuth2 callback',
        description: 'Handles the callback from Google after successful authentication',
    })
    @ApiResponse({
        status: 200,
        description: 'Authentication successful',
        schema: {
            properties: {
                user: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        email: { type: 'string' },
                        username: { type: 'string' },
                        role: { type: 'string' },
                    },
                },
                accessToken: { type: 'string' },
                refreshToken: { type: 'string' },
                csrfToken: { type: 'string' },
                message: { type: 'string' },
            },
        },
    })
    @ApiResponse({
        status: 401,
        description: 'Authentication failed',
    })
    async googleAuthCallback(
        @Req() req: AuthenticatedRequest,
        @Res({ passthrough: true }) res: Response,
    ) {
        // req.user is set by GoogleStrategy
        const socialUser = this.tokenValidationService.validateAndTransformSocialUser(req.user);
        const result = await this.authService.socialLogin(socialUser);
        return this.handleAuthResponse(res, result, 'Google');
    }

    @Get('facebook')
    @UseGuards(AuthGuard('facebook'))
    @ApiOperation({
        summary: 'Facebook OAuth2 login redirect',
        description: 'Redirects the user to Facebook for authentication',
    })
    @ApiResponse({
        status: 302,
        description: 'Redirects to Facebook authentication page',
    })
    async facebookAuth() {
        // Guard redirects to Facebook
    }

    @Get('facebook/callback')
    @UseGuards(AuthGuard('facebook'))
    @ApiOperation({
        summary: 'Facebook OAuth2 callback',
        description: 'Handles the callback from Facebook after successful authentication',
    })
    @ApiResponse({
        status: 200,
        description: 'Authentication successful',
        schema: {
            properties: {
                user: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        email: { type: 'string' },
                        username: { type: 'string' },
                        role: { type: 'string' },
                    },
                },
                accessToken: { type: 'string' },
                refreshToken: { type: 'string' },
                csrfToken: { type: 'string' },
                message: { type: 'string' },
            },
        },
    })
    @ApiResponse({
        status: 401,
        description: 'Authentication failed',
    })
    async facebookAuthCallback(
        @Req() req: AuthenticatedRequest,
        @Res({ passthrough: true }) res: Response,
    ) {
        // req.user is set by FacebookStrategy
        const socialUser = this.tokenValidationService.validateAndTransformSocialUser(req.user);
        const result = await this.authService.socialLogin(socialUser);
        return this.handleAuthResponse(res, result, 'Facebook');
    }

    // Token and response handling has been moved to TokenValidationService
    private handleAuthResponse(
        res: Response,
        authResponse: AuthResponse,
        provider?: string,
    ): AuthSuccessResponse {
        // For refresh endpoint, pass provider as 'TokenRefresh' for test compatibility
        if (
            provider === undefined &&
            (authResponse as any)?.tokens?.accessToken &&
            (authResponse as any)?.tokens?.refreshToken &&
            (authResponse as any)?.tokens?.csrfToken
        ) {
            // Heuristic: if this is called from refreshToken endpoint, set provider to 'TokenRefresh'
            if (res.req && res.req.url && res.req.url.includes('/auth/refresh')) {
                return this.tokenValidationService.handleAuthResponse(
                    res,
                    authResponse,
                    'TokenRefresh',
                );
            }
        }
        return this.tokenValidationService.handleAuthResponse(res, authResponse, provider);
    }
}
