import { Injectable, Logger, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConnectedPlatform, MonthlyWinExtraWinner, MonthlyWinLimitConfig } from '@prisma/client';
import { UpdateMonthlyWinLimitConfigDto } from './dto/update-monthly-win-limit-config.dto';
import { CreateMonthlyWinExtraWinnerDto } from './dto/create-monthly-win-extra-winner.dto';
import { UpdateMonthlyWinExtraWinnerDto } from './dto/update-monthly-win-extra-winner.dto';

export type DrawParticipantIdentity = {
  id: string;
  username: string;
  platform?: ConnectedPlatform | string | null;
};

@Injectable()
export class MonthlyWinLimitService {
  private readonly logger = new Logger(MonthlyWinLimitService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns config for admin, creating defaults (enabled=true, maxWins=2) if missing.
   */
  async getOrCreateConfig(userId: string): Promise<MonthlyWinLimitConfig> {
    const existing = await this.prisma.monthlyWinLimitConfig.findUnique({ where: { userId } });
    if (existing) return existing;

    return this.prisma.monthlyWinLimitConfig.create({
      data: {
        userId,
        enabled: true,
        maxWinsPerMonth: 2,
      },
    });
  }

  async updateConfig(userId: string, dto: UpdateMonthlyWinLimitConfigDto): Promise<MonthlyWinLimitConfig> {
    await this.getOrCreateConfig(userId);
    return this.prisma.monthlyWinLimitConfig.update({
      where: { userId },
      data: {
        enabled: dto.enabled,
        maxWinsPerMonth: dto.maxWinsPerMonth,
      },
    });
  }

  async findAllExtraWinners(userId: string): Promise<MonthlyWinExtraWinner[]> {
    return this.prisma.monthlyWinExtraWinner.findMany({
      where: { userId },
      orderBy: [{ platform: 'asc' }, { platformUsername: 'asc' }],
    });
  }

  async createExtraWinner(userId: string, dto: CreateMonthlyWinExtraWinnerDto): Promise<MonthlyWinExtraWinner> {
    const username = dto.platformUsername.trim();
    if (!username) {
      throw new ConflictException('Nick é obrigatório');
    }

    const duplicate = await this.prisma.monthlyWinExtraWinner.findFirst({
      where: {
        userId,
        platform: dto.platform,
        platformUsername: { equals: username, mode: 'insensitive' },
      },
    });
    if (duplicate) {
      throw new ConflictException('Este usuário já está na lista de vencedores extras');
    }

    return this.prisma.monthlyWinExtraWinner.create({
      data: {
        userId,
        platform: dto.platform,
        platformUsername: username,
        maxWins: dto.maxWins,
      },
    });
  }

  async updateExtraWinner(
    userId: string,
    id: string,
    dto: UpdateMonthlyWinExtraWinnerDto,
  ): Promise<MonthlyWinExtraWinner> {
    const extra = await this.prisma.monthlyWinExtraWinner.findUnique({ where: { id } });
    if (!extra) throw new NotFoundException('Vencedor extra não encontrado');
    if (extra.userId !== userId) throw new ForbiddenException('Sem permissão');

    const nextPlatform = dto.platform ?? extra.platform;
    const nextUsername = dto.platformUsername?.trim() ?? extra.platformUsername;

    if (dto.platform !== undefined || dto.platformUsername !== undefined) {
      const duplicate = await this.prisma.monthlyWinExtraWinner.findFirst({
        where: {
          userId,
          platform: nextPlatform,
          platformUsername: { equals: nextUsername, mode: 'insensitive' },
          NOT: { id },
        },
      });
      if (duplicate) {
        throw new ConflictException('Este usuário já está na lista de vencedores extras');
      }
    }

    return this.prisma.monthlyWinExtraWinner.update({
      where: { id },
      data: {
        ...(dto.platform !== undefined && { platform: dto.platform }),
        ...(dto.platformUsername !== undefined && { platformUsername: nextUsername }),
        ...(dto.maxWins !== undefined && { maxWins: dto.maxWins }),
      },
    });
  }

  async removeExtraWinner(userId: string, id: string): Promise<void> {
    const extra = await this.prisma.monthlyWinExtraWinner.findUnique({ where: { id } });
    if (!extra) throw new NotFoundException('Vencedor extra não encontrado');
    if (extra.userId !== userId) throw new ForbiddenException('Sem permissão');

    await this.prisma.monthlyWinExtraWinner.delete({ where: { id } });
  }

  /**
   * Filters participants that still can win this month out of the provably-fair ranges.
   * Participants remain in the giveaway list; they are only excluded from the draw ranges.
   */
  async filterEligibleForDraw<T extends DrawParticipantIdentity>(
    adminUserId: string,
    participants: T[],
  ): Promise<T[]> {
    const config = await this.getOrCreateConfig(adminUserId);
    if (!config.enabled) {
      return participants;
    }

    const [winCounts, extras] = await Promise.all([
      this.getMonthlyWinCountsByUsername(adminUserId),
      this.findAllExtraWinners(adminUserId),
    ]);

    const eligible = participants.filter((participant) => {
      const key = participant.username.toLowerCase();
      const wins = winCounts.get(key) ?? 0;
      const maxWins = this.resolveMaxWins(participant, extras, config.maxWinsPerMonth);
      return wins < maxWins;
    });

    const excluded = participants.length - eligible.length;
    if (excluded > 0) {
      this.logger.log(
        `Monthly win limit: excluded ${excluded}/${participants.length} participant(s) from draw for admin ${adminUserId}`,
      );
    }

    return eligible;
  }

  private resolveMaxWins(
    participant: DrawParticipantIdentity,
    extras: MonthlyWinExtraWinner[],
    defaultMax: number,
  ): number {
    const username = participant.username.toLowerCase();
    const platform = participant.platform ? String(participant.platform).toUpperCase() : null;

    if (platform) {
      const exact = extras.find(
        (e) =>
          e.platform === platform &&
          e.platformUsername.toLowerCase() === username,
      );
      if (exact) return exact.maxWins;
    }

    const byUsername = extras.filter((e) => e.platformUsername.toLowerCase() === username);
    if (byUsername.length === 0) return defaultMax;

    // Prefer platform match already handled; otherwise use the highest allowance for that nick
    return Math.max(...byUsername.map((e) => e.maxWins));
  }

  /**
   * Counts final wins (status WINNER) in the current calendar month (America/Sao_Paulo)
   * across all giveaway types for this admin, keyed by lowercase username.
   */
  private async getMonthlyWinCountsByUsername(adminUserId: string): Promise<Map<string, number>> {
    const monthStart = this.getCurrentMonthStartSaoPaulo();
    const counts = new Map<string, number>();

    const addUsername = (username: string | null | undefined) => {
      if (!username) return;
      const key = username.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    };

    const [
      streamWins,
      kickGiftWins,
      kickCoinsWins,
      twitchBitsWins,
      twitchGiftWins,
      integratedBitsWins,
      integratedGiftWins,
    ] = await Promise.all([
      this.prisma.streamGiveawayWinner.findMany({
        where: {
          status: 'WINNER',
          createdAt: { gte: monthStart },
          streamGiveaway: { userId: adminUserId },
        },
        select: { winnerParticipant: { select: { username: true } } },
      }),
      this.prisma.kickGiftSubsGiveawayWinner.findMany({
        where: {
          status: 'WINNER',
          createdAt: { gte: monthStart },
          kickGiftSubsGiveaway: { userId: adminUserId },
        },
        select: { winnerParticipant: { select: { username: true } } },
      }),
      this.prisma.kickCoinsGiveawayWinner.findMany({
        where: {
          status: 'WINNER',
          createdAt: { gte: monthStart },
          kickCoinsGiveaway: { userId: adminUserId },
        },
        select: { winnerParticipant: { select: { username: true } } },
      }),
      this.prisma.twitchBitsGiveawayWinner.findMany({
        where: {
          status: 'WINNER',
          createdAt: { gte: monthStart },
          twitchBitsGiveaway: { userId: adminUserId },
        },
        select: { winnerParticipant: { select: { username: true } } },
      }),
      this.prisma.twitchGiftSubsGiveawayWinner.findMany({
        where: {
          status: 'WINNER',
          createdAt: { gte: monthStart },
          twitchGiftSubsGiveaway: { userId: adminUserId },
        },
        select: { winnerParticipant: { select: { username: true } } },
      }),
      this.prisma.integratedBitsKickCoinsGiveawayWinner.findMany({
        where: {
          status: 'WINNER',
          createdAt: { gte: monthStart },
          integratedBitsKickCoinsGiveaway: { userId: adminUserId },
        },
        select: { winnerParticipant: { select: { username: true } } },
      }),
      this.prisma.integratedGiftSubsGiveawayWinner.findMany({
        where: {
          status: 'WINNER',
          createdAt: { gte: monthStart },
          integratedGiftSubsGiveaway: { userId: adminUserId },
        },
        select: { winnerParticipant: { select: { username: true } } },
      }),
    ]);

    for (const w of streamWins) addUsername(w.winnerParticipant?.username);
    for (const w of kickGiftWins) addUsername(w.winnerParticipant?.username);
    for (const w of kickCoinsWins) addUsername(w.winnerParticipant?.username);
    for (const w of twitchBitsWins) addUsername(w.winnerParticipant?.username);
    for (const w of twitchGiftWins) addUsername(w.winnerParticipant?.username);
    for (const w of integratedBitsWins) addUsername(w.winnerParticipant?.username);
    for (const w of integratedGiftWins) addUsername(w.winnerParticipant?.username);

    return counts;
  }

  /** Start of current month at 00:00 America/Sao_Paulo (UTC-3, no DST). */
  private getCurrentMonthStartSaoPaulo(): Date {
    const now = new Date();
    const saoPauloMs = now.getTime() - 3 * 60 * 60 * 1000;
    const local = new Date(saoPauloMs);
    const year = local.getUTCFullYear();
    const month = local.getUTCMonth();
    return new Date(Date.UTC(year, month, 1, 3, 0, 0, 0));
  }
}
