import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConnectedAccount, ConnectedPlatform } from '@prisma/client';
import { CreateConnectedAccountDto } from './dto/create-connected-account.dto';
import { TwitchOAuthService } from './services/twitch-oauth.service';

@Injectable()
export class ConnectedAccountsService {
  private readonly logger = new Logger(ConnectedAccountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly twitchOAuthService: TwitchOAuthService,
  ) {}

  async findAll(userId: string): Promise<ConnectedAccount[]> {
    return this.prisma.connectedAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createOrUpdate(
    userId: string,
    data: CreateConnectedAccountDto,
  ): Promise<ConnectedAccount> {
    const { platform, externalChannelId, expiresAt, ...accountData } = data;
    const expiresAtDate = expiresAt ? new Date(expiresAt) : undefined;

    return this.prisma.connectedAccount.upsert({
      where: {
        userId_platform_externalChannelId: {
          userId,
          platform,
          externalChannelId,
        },
      },
      update: {
        ...accountData,
        expiresAt: expiresAtDate,
        updatedAt: new Date(),
      },
      create: {
        ...accountData,
        expiresAt: expiresAtDate,
        userId,
        platform,
        externalChannelId,
      },
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    const account = await this.prisma.connectedAccount.findFirst({
      where: { id, userId },
    });

    if (!account) {
      throw new NotFoundException(`Connected account with ID ${id} not found`);
    }

    // Se for conta Twitch, remover todas as subscriptions do EventSub associadas
    if (account.platform === ConnectedPlatform.TWITCH) {
      try {
        this.logger.log(`🗑️ Removing Twitch EventSub subscriptions for broadcaster: ${account.externalChannelId}`);
        await this.removeTwitchEventSubSubscriptions(account.externalChannelId);
      } catch (error) {
        this.logger.error(`❌ Failed to remove Twitch EventSub subscriptions:`, error);
        // Não bloquear a remoção da conta mesmo se falhar ao remover subscriptions
      }
    }

    await this.prisma.connectedAccount.delete({
      where: { id },
    });

    this.logger.log(`✅ Connected account removed: ${account.platform} - ${account.externalChannelId}`);
  }

  /**
   * Remove todas as subscriptions do EventSub associadas a um broadcaster da Twitch
   */
  private async removeTwitchEventSubSubscriptions(broadcasterUserId: string): Promise<void> {
    try {
      // Get App Access Token
      const appAccessToken = await this.twitchOAuthService.getAppAccessToken();

      // Buscar todas as subscriptions
      const response = await this.twitchOAuthService.getEventSubSubscriptions(appAccessToken);
      const subscriptions = response.data || [];

      this.logger.log(`📋 Found ${subscriptions.length} total EventSub subscriptions`);

      // Filtrar subscriptions deste broadcaster
      const broadcasterSubs = subscriptions.filter(
        (sub: any) => sub.condition?.broadcaster_user_id === broadcasterUserId
      );

      this.logger.log(`🎯 Found ${broadcasterSubs.length} subscriptions for broadcaster ${broadcasterUserId}`);

      // Deletar cada subscription
      if (broadcasterSubs.length > 0) {
        await Promise.all(
          broadcasterSubs.map(async (sub: any) => {
            try {
              this.logger.log(`🗑️ Deleting subscription: ${sub.id} (type: ${sub.type})`);
              await this.twitchOAuthService.deleteEventSubSubscription(appAccessToken, sub.id);
              this.logger.log(`✅ Deleted subscription: ${sub.id}`);
            } catch (error) {
              this.logger.warn(`⚠️ Failed to delete subscription ${sub.id}:`, error);
            }
          })
        );
      }

      this.logger.log(`✅ Successfully removed all EventSub subscriptions for broadcaster ${broadcasterUserId}`);
    } catch (error) {
      this.logger.error(`❌ Error removing Twitch EventSub subscriptions:`, error);
      throw error;
    }
  }
}

