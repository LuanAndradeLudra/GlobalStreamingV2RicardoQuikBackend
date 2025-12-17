import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ConnectedAccountsService } from '../connected-accounts/connected-accounts.service';
import { KickOAuthService } from '../connected-accounts/services/kick-oauth.service';
import { TwitchOAuthService } from '../connected-accounts/services/twitch-oauth.service';
import { CreateConnectedAccountDto } from '../connected-accounts/dto/create-connected-account.dto';
import { ConnectedPlatform, UserRole, ConnectedAccount } from '@prisma/client';

@Injectable()
export class TokenRefreshCronService {
  private readonly logger = new Logger(TokenRefreshCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connectedAccountsService: ConnectedAccountsService,
    private readonly kickOAuthService: KickOAuthService,
    private readonly twitchOAuthService: TwitchOAuthService,
  ) {}

  // Cron job que roda a cada 2 horas para atualizar os tokens de refresh
  // Formato: '0 */2 * * *' = a cada 2 horas
  @Cron('0 */2 * * *', {
    name: 'refreshTokens',
    timeZone: 'America/Sao_Paulo',
  })
  async handleTokenRefresh() {
    this.logger.log('Iniciando refresh de tokens para usuarios ADMIN...');

    try {
      const adminUsers = await this.prisma.user.findMany({
        where: { role: UserRole.ADMIN },
        include: {
          accounts: {
            where: {
              refreshToken: { not: null },
            },
          },
        },
      });

      let successCount = 0;
      let errorCount = 0;

      for (const user of adminUsers) {
        for (const account of user.accounts) {
          try {
            await this.refreshAccountToken(user.id, account);
            successCount++;
            this.logger.log(
              `Token atualizado com sucesso: ${account.platform} - ${account.displayName}`,
            );
          } catch (error) {
            errorCount++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(
              `Erro ao atualizar token ${account.platform} - ${account.displayName}: ${errorMessage}`,
            );
          }
        }
      }

      this.logger.log(
        `Refresh de tokens concluido. Sucessos: ${successCount}, Erros: ${errorCount}`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Erro critico no cron de refresh de tokens: ${errorMessage}`);
    }
  }

  private async refreshAccountToken(userId: string, account: ConnectedAccount): Promise<void> {
    if (!account.refreshToken) {
      this.logger.warn(
        `Conta ${account.platform} - ${account.displayName} nao possui refreshToken, pulando...`,
      );
      return;
    }

    let tokenResponse: any;

    if (account.platform === ConnectedPlatform.KICK) {
      tokenResponse = await this.kickOAuthService.refreshAccessToken(account.refreshToken);
    } else if (account.platform === ConnectedPlatform.TWITCH) {
      tokenResponse = await this.twitchOAuthService.refreshAccessToken(account.refreshToken);
    } else {
      this.logger.warn(
        `Plataforma ${account.platform} nao suporta refresh automatico, pulando...`,
      );
      return;
    }

    const expiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : undefined;

    const createDto: CreateConnectedAccountDto = {
      platform: account.platform as ConnectedPlatform,
      externalChannelId: account.externalChannelId,
      displayName: account.displayName,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token ?? account.refreshToken ?? undefined,
      scopes:
        account.platform === ConnectedPlatform.TWITCH
          ? Array.isArray(tokenResponse.scope)
            ? tokenResponse.scope.join(' ')
            : tokenResponse.scope ?? account.scopes ?? undefined
          : tokenResponse.scope ?? account.scopes ?? undefined,
      expiresAt: expiresAt?.toISOString(),
    };

    await this.connectedAccountsService.createOrUpdate(userId, createDto);
  }
}
