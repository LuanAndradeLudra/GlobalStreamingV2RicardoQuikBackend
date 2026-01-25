import {
  Controller,
  Get,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { User } from '@prisma/client';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}



  // ⚠️ ROTA TEMPORÁRIA APENAS PARA DESENVOLVIMENTO ⚠️
  // Remove antes de ir para produção!
  @Get('bypass')
  @Public()
  @ApiOperation({
    summary: '⚠️ DEV ONLY - Bypass login with userId',
    description:
      'TEMPORARY ROUTE FOR DEVELOPMENT: Generate a JWT token for any user by userId. Access in browser: /auth/bypass?userId={userId}',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns JWT token and redirects to frontend with token',
    schema: {
      type: 'object',
      properties: {
        token: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            displayName: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Missing userId query parameter',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async bypassLogin(@Query('userId') userId: string, @Res() res: Response) {
    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    const user = await this.authService.bypassLogin(userId);
    
    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }

    const token = await this.authService.generateJwt(user);
    
    // Get frontend URL from config
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    
    // Redirect to frontend with token in URL
    return res.redirect(`${frontendUrl}/oauth/callback?token=${token}`);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Returns authenticated user data',
    description:
      'Returns the logged in user data. Requires JWT token in the Authorization header: Bearer <token>',
  })
  @ApiResponse({
    status: 200,
    description: 'Authenticated user data',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        email: { type: 'string' },
        displayName: { type: 'string' },
        avatarUrl: { type: 'string', nullable: true },
        role: { type: 'string', enum: ['ADMIN', 'USER'] },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthenticated - invalid or missing token',
  })
  async getMe(@CurrentUser() user: User) {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

