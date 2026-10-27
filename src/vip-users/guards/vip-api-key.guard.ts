import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User, UserRole } from '@prisma/client';
import { createHash, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class VipApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(VipApiKeyGuard.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const provided = this.readApiKey(request);
    const expected = this.configService.get<string>('VIP_INTEGRATION_API_KEY')?.trim();

    if (!provided || !expected || !this.matches(provided, expected)) {
      if (!expected) {
        this.logger.error('VIP_INTEGRATION_API_KEY não configurada');
      }
      throw new UnauthorizedException('API key inválida');
    }

    request.user = await this.resolveOwner();
    return true;
  }

  private async resolveOwner(): Promise<User> {
    const configuredId = this.configService.get<string>('VIP_INTEGRATION_USER_ID')?.trim();
    if (configuredId) {
      const user = await this.prisma.user.findUnique({ where: { id: configuredId } });
      if (!user) {
        this.logger.error('VIP_INTEGRATION_USER_ID não corresponde a um usuário');
        throw new ServiceUnavailableException('Integração VIP sem admin configurado');
      }
      return user;
    }

    const admins = await this.prisma.user.findMany({
      where: { role: UserRole.ADMIN },
      take: 2,
    });
    if (admins.length === 1) return admins[0];

    this.logger.error('Há zero ou mais de um ADMIN. Defina VIP_INTEGRATION_USER_ID');
    throw new ServiceUnavailableException('Integração VIP sem admin configurado');
  }

  private matches(provided: string, expected: string): boolean {
    const left = createHash('sha256').update(provided).digest();
    const right = createHash('sha256').update(expected).digest();
    return timingSafeEqual(left, right);
  }

  private readApiKey(request: { headers: Record<string, string | string[] | undefined> }): string | null {
    const header = request.headers['x-api-key'];
    if (typeof header === 'string' && header.trim()) {
      return this.bounded(header);
    }

    const authorization = request.headers.authorization;
    if (typeof authorization === 'string' && authorization.toLowerCase().startsWith('bearer ')) {
      return this.bounded(authorization.slice(7));
    }

    return null;
  }

  private bounded(value: string): string | null {
    const token = value.trim();
    if (!token || token.length > 200) return null;
    return token;
  }
}
