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
import { CookieService } from '../../infrastructure/auth/services/cookie.service';
import { AuthProvider, AUTH_CONSTANTS } from '../../shared/constants/auth.constants';
import { AuthenticatedRequest, AuthSuccessResponse } from '../interfaces/auth.interface';
import { HTTP_HEADERS } from 'src/shared/constants/http-headers';

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
        private readonly cookieService: CookieService,
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
            const user = await this.userService.create({
                username: registerDto.username,
                email: registerDto.email,
                password: registerDto.password,
                timezone: registerDto.timezone,
            });

            const result: AuthResponse = await this.authService.login({
                email: user.email,
                password: registerDto.password, // Need to use the plain password here
            });

            this.logger.debug(`Registration successful for user: ${user.email}`);
            return this.handleAuthResponse(res, result, AuthProvider.REGISTRATION);
        } catch (error) {
            this.logger.error(`Registration failed: ${error.message}`);
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException(AUTH_CONSTANTS.MESSAGES.ERROR.REGISTRATION_FAILED);
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

        try {
            const result = await this.authService.login({
                email: loginDto.email,
                password: loginDto.password,
                userAgent: (() => {
                    const ua = req.headers?.[HTTP_HEADERS.USER_AGENT];
                    if (Array.isArray(ua)) return ua.join(', ');
                    return ua ?? '';
                })(),
                ip: req.ip || req.socket?.remoteAddress || '',
            });

            this.logger.debug(`Login successful for user: ${result.user.email}`);
            return this.handleAuthResponse(res, result, AuthProvider.LOCAL);
        } catch (error) {
            this.logger.error(`Login error: ${error.message}`);
            if (error instanceof UnauthorizedException) {
                throw error;
            }
            throw new UnauthorizedException(
                error.message ?? AUTH_CONSTANTS.MESSAGES.ERROR.LOGIN_FAILED,
            );
        }
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
                message: AUTH_CONSTANTS.MESSAGES.LOGOUT,
            };
        } catch (error) {
            this.logger.error(`Logout error: ${error.message}`);
            // Still clear cookies and return success to client
            this.tokenValidationService.clearAuthCookies(res);
            return {
                message: AUTH_CONSTANTS.MESSAGES.LOGOUT,
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
                throw new UnauthorizedException(AUTH_CONSTANTS.MESSAGES.ERROR.NO_AUTH_TOKEN);
            }

            const tokenData = this.tokenValidationService.validateAndDecodeToken(refreshToken);
            if (!tokenData?.userId || !tokenData?.tokenId) {
                throw new UnauthorizedException(AUTH_CONSTANTS.MESSAGES.ERROR.REFRESH_FAILED);
            }

            const result = await this.authService.refreshToken(tokenData.userId, tokenData.tokenId);

            this.logger.debug(`Token refreshed successfully for user: ${tokenData.userId}`);
            return this.handleAuthResponse(res, result, AuthProvider.TOKEN_REFRESH);
        } catch (error) {
            this.logger.error(`Token refresh error: ${error.message}`);
            this.tokenValidationService.clearAuthCookies(res);
            throw new UnauthorizedException(AUTH_CONSTANTS.MESSAGES.ERROR.REFRESH_FAILED);
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
        try {
            if (!req.user) {
                this.logger.warn('No user found in request after authentication');
                throw new UnauthorizedException(AUTH_CONSTANTS.MESSAGES.ERROR.NO_USER);
            }

            return this.tokenValidationService.transformProfileResponse(req.user);
        } catch (error) {
            this.logger.error(`Authentication error in /me endpoint: ${error.message}`);
            throw new UnauthorizedException(AUTH_CONSTANTS.MESSAGES.ERROR.AUTH_FAILED);
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
        try {
            const socialUser = this.tokenValidationService.validateAndTransformSocialUser(req.user);
            const result = await this.authService.socialLogin(socialUser);
            return this.handleAuthResponse(res, result, AuthProvider.GOOGLE);
        } catch (error) {
            this.logger.error(`Google auth callback error: ${error.message}`);
            throw new UnauthorizedException(
                AUTH_CONSTANTS.MESSAGES.ERROR.INCOMPLETE_SOCIAL_PROFILE,
            );
        }
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
        try {
            const socialUser = this.tokenValidationService.validateAndTransformSocialUser(req.user);
            const result = await this.authService.socialLogin(socialUser);
            return this.handleAuthResponse(res, result, AuthProvider.FACEBOOK);
        } catch (error) {
            this.logger.error(`Facebook auth callback error: ${error.message}`);
            throw new UnauthorizedException(
                AUTH_CONSTANTS.MESSAGES.ERROR.INCOMPLETE_SOCIAL_PROFILE,
            );
        }
    }

    private handleAuthResponse(
        res: Response,
        authResponse: AuthResponse,
        provider?: AuthProvider,
    ): AuthSuccessResponse {
        const isRefreshRequest = !provider && res.req?.url?.includes('/auth/refresh');
        return this.tokenValidationService.handleAuthResponse(
            res,
            authResponse,
            isRefreshRequest ? AuthProvider.TOKEN_REFRESH : provider,
        );
    }
}
