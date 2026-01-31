import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CleanupCronService {
  private readonly logger = new Logger(CleanupCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Cron job que roda diariamente às 05:00 da manhã
  // Formato: '0 5 * * *' = às 05:00 todos os dias
  @Cron('0 5 * * *', {
    name: 'cleanupOldData',
    timeZone: 'America/Sao_Paulo',
  })
  async handleCleanup() {
    this.logger.log('Iniciando limpeza de dados antigos (mais de 15 dias)...');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 15);

    try {
      let totalDeleted = 0;

      // Limpar eventos antigos
      const deletedEvents = await this.prisma.event.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });
      totalDeleted += deletedEvents.count;
      this.logger.log(`Eventos deletados: ${deletedEvents.count}`);

      // Limpar StreamGiveaways antigos (cascade deleta participantes e vencedores)
      const deletedStreamGiveaways = await this.prisma.streamGiveaway.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });
      totalDeleted += deletedStreamGiveaways.count;
      this.logger.log(`StreamGiveaways deletados: ${deletedStreamGiveaways.count}`);

      // Limpar KickGiftSubsGiveaways antigos
      const deletedKickGiftSubs = await this.prisma.kickGiftSubsGiveaway.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });
      totalDeleted += deletedKickGiftSubs.count;
      this.logger.log(`KickGiftSubsGiveaways deletados: ${deletedKickGiftSubs.count}`);

      // Limpar KickCoinsGiveaways antigos
      const deletedKickCoins = await this.prisma.kickCoinsGiveaway.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });
      totalDeleted += deletedKickCoins.count;
      this.logger.log(`KickCoinsGiveaways deletados: ${deletedKickCoins.count}`);

      // Limpar TwitchBitsGiveaways antigos
      const deletedTwitchBits = await this.prisma.twitchBitsGiveaway.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });
      totalDeleted += deletedTwitchBits.count;
      this.logger.log(`TwitchBitsGiveaways deletados: ${deletedTwitchBits.count}`);

      // Limpar TwitchGiftSubsGiveaways antigos
      const deletedTwitchGiftSubs = await this.prisma.twitchGiftSubsGiveaway.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });
      totalDeleted += deletedTwitchGiftSubs.count;
      this.logger.log(`TwitchGiftSubsGiveaways deletados: ${deletedTwitchGiftSubs.count}`);

      // Limpar IntegratedBitsKickCoinsGiveaways antigos
      const deletedIntegratedBitsKick = await this.prisma.integratedBitsKickCoinsGiveaway.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });
      totalDeleted += deletedIntegratedBitsKick.count;
      this.logger.log(`IntegratedBitsKickCoinsGiveaways deletados: ${deletedIntegratedBitsKick.count}`);

      // Limpar IntegratedGiftSubsGiveaways antigos
      const deletedIntegratedGiftSubs = await this.prisma.integratedGiftSubsGiveaway.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });
      totalDeleted += deletedIntegratedGiftSubs.count;
      this.logger.log(`IntegratedGiftSubsGiveaways deletados: ${deletedIntegratedGiftSubs.count}`);

      this.logger.log(
        `Limpeza concluída com sucesso! Total de registros deletados: ${totalDeleted}`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Erro crítico no cron de limpeza: ${errorMessage}`, error instanceof Error ? error.stack : undefined);
    }
  }
}


