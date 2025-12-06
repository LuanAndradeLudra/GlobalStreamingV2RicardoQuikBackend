import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from './decorators/public.decorator';
import { AuthService } from './auth.service';
import { User } from '@prisma/client';

@ApiTags('auth')
@Controller() // No prefix - this will be accessible at root level
export class AuthPublicController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Get('auth/google')
  @Public()
  @UseGuards(AuthGuard('google'))
  @ApiOperation({
    summary: 'Starts Google OAuth login',
    description:
      'Redirects the user to the Google authentication page. After authentication, Google redirects to /auth/google/callback',
  })
  async googleAuth() {
    // Passport handles the redirect
  }

  @Get('auth/google/callback')
  @Public()
  @UseGuards(AuthGuard('google'))
  @ApiOperation({
    summary: 'Google OAuth callback',
    description:
      'Endpoint called by Google after authentication. Generates JWT and redirects to the frontend with the token.',
  })
  @ApiResponse({
    status: 302,
    description: 'Redirects to the frontend with JWT token in the query string',
  })
  async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as User;
    const token = await this.authService.generateJwt(user);

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const redirectUrl = `${frontendUrl}/auth/callback?token=${token}`;

    res.redirect(redirectUrl);
  }
}

