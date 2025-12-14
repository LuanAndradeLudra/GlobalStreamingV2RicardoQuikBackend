import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { ConnectedPlatform } from '@prisma/client';
import { CreateIntegratedGiftSubsGiveawayDto } from './dto/create-integrated-gift-subs-giveaway.dto';
import { UpdateIntegratedGiftSubsGiveawayDto } from './dto/update-integrated-gift-subs-giveaway.dto';
import { TwitchService } from '../twitch/twitch.service';
import { KickService } from '../kick/kick.service';
import * as crypto from 'crypto';

interface TwitchGiftSubsLeaderboardResponse {
  data: Array<{
    broadcaster_id: string;
    broadcaster_login: string;
    broadcaster_name: string;
    gifter_id: string;
    gifter_login: string;
    gifter_name: string;
    is_gift: boolean;
    plan_name: string;
    tier: string;
    user_id: string;
    user_name: string;
    user_login: string;
  }>;
}

interface KickGiftSubsLeaderboardResponse {
  gifters: Array<{
    user_id: number;
    username: string;
    quantity: number;
    rank: number;
  }>;
}

@Injectable()
export class IntegratedGiftSubsGiveawayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly twitchService: TwitchService,
    private readonly kickService: KickService,
  ) {}

  /**
   * Get all Integrated Gift Subs giveaways for a user
   */
  async findAll(userId: string) {
    const giveaways = await (this.prisma as any).integratedGiftSubsGiveaway.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        name: true,
        category: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            participants: true,
            winners: true,
          },
        },
      },
    });

    return giveaways.map((g: any) => ({
      id: g.id,
      userId: g.userId,
      name: g.name,
      category: g.category,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
      participants: [] as any[],
      participantsCount: g._count.participants,
      winnersCount: g._count.winners,
    }));
  }

  /**
   * Get a single giveaway by ID
   */
  async findOne(userId: string, id: string) {
    const giveaway = await (this.prisma as any).integratedGiftSubsGiveaway.findFirst({
      where: { id, userId },
      include: {
        participants: {
          orderBy: { createdAt: 'asc' },
        },
        winners: {
          orderBy: { createdAt: 'desc' },
          include: {
            winnerParticipant: true,
          },
        },
      },
    });

    if (!giveaway) {
      throw new NotFoundException(`Integrated Gift Subs Giveaway with ID ${id} not found`);
    }

    return giveaway;
  }

  /**
   * Generate name for giveaway
   */
  private generateGiveawayName(): string {
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear();
    return `Sorteio Integrado Gift Subs - ${day}/${month}/${year}`;
  }

  /**
   * Create a new giveaway
   */
  async create(userId: string, dto: CreateIntegratedGiftSubsGiveawayDto) {
    const name = this.generateGiveawayName();

    const giveaway = await (this.prisma as any).integratedGiftSubsGiveaway.create({
      data: {
        userId,
        name,
        category: dto.category,
      },
    });

    return this.findOne(userId, giveaway.id);
  }

  /**
   * Update a giveaway
   */
  async update(userId: string, id: string, dto: UpdateIntegratedGiftSubsGiveawayDto) {
    await this.findOne(userId, id);

    return (this.prisma as any).integratedGiftSubsGiveaway.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * Delete a giveaway
   */
  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    await (this.prisma as any).integratedGiftSubsGiveaway.delete({
      where: { id },
    });
  }

  /**
   * Sync participants from both Twitch Gift Subs and Kick Gift Subs giveaways
   */
  async syncParticipants(
    userId: string,
    giveawayId: string,
    twitchGiftSubsLeaderboard: TwitchGiftSubsLeaderboardResponse,
    kickGiftSubsLeaderboard: KickGiftSubsLeaderboardResponse,
  ) {
    const giveaway = await this.findOne(userId, giveawayId);

    // Delete existing participants
    await (this.prisma as any).integratedGiftSubsGiveawayParticipant.deleteMany({
      where: { integratedGiftSubsGiveawayId: giveawayId },
    });

    // Get ticket rules for GIFT_SUB
    const twitchTicketRule = await this.prisma.ticketGlobalDonationRule.findFirst({
      where: {
        userId,
        platform: ConnectedPlatform.TWITCH,
        unitType: 'GIFT_SUB',
      },
    });

    const kickTicketRule = await this.prisma.ticketGlobalDonationRule.findFirst({
      where: {
        userId,
        platform: ConnectedPlatform.KICK,
        unitType: 'GIFT_SUB',
      },
    });

    if (!twitchTicketRule) {
      throw new BadRequestException('Twitch GIFT_SUB ticket rule not found for this user');
    }

    if (!kickTicketRule) {
      throw new BadRequestException('Kick GIFT_SUB ticket rule not found for this user');
    }

    // Process Twitch gift subs using the existing service's logic
    // Group by gifter from the subscription data
    const twitchGifterMap = new Map<string, { gifter_id: string; gifter_name: string; count: number }>();
    
    for (const sub of twitchGiftSubsLeaderboard.data) {
      if (sub.is_gift && sub.gifter_id) {
        const existing = twitchGifterMap.get(sub.gifter_id);
        if (existing) {
          existing.count += 1;
        } else {
          twitchGifterMap.set(sub.gifter_id, {
            gifter_id: sub.gifter_id,
            gifter_name: sub.gifter_name || sub.gifter_login,
            count: 1,
          });
        }
      }
    }

    const twitchParticipants: Array<{
      platform: ConnectedPlatform;
      externalUserId: string;
      username: string;
      avatarUrl?: string;
      quantity: number;
      tickets: number;
    }> = [];

    for (const [, gifter] of twitchGifterMap) {
      const tickets = Math.floor((gifter.count / twitchTicketRule.unitSize) * twitchTicketRule.ticketsPerUnitSize);
      
      if (tickets > 0) {
        twitchParticipants.push({
          platform: ConnectedPlatform.TWITCH,
          externalUserId: gifter.gifter_id,
          username: gifter.gifter_name,
          quantity: gifter.count,
          tickets,
        });
      }
    }

    // Process Kick gift subs from gifters array
    const kickParticipants: Array<{
      platform: ConnectedPlatform;
      externalUserId: string;
      username: string;
      avatarUrl?: string;
      quantity: number;
      tickets: number;
    }> = [];

    for (const gifter of kickGiftSubsLeaderboard.gifters) {
      const tickets = Math.floor((gifter.quantity / kickTicketRule.unitSize) * kickTicketRule.ticketsPerUnitSize);
      
      if (tickets > 0) {
        kickParticipants.push({
          platform: ConnectedPlatform.KICK,
          externalUserId: gifter.user_id.toString(),
          username: gifter.username,
          quantity: gifter.quantity,
          tickets,
        });
      }
    }

    // Combine all participants
    const allParticipants = [...twitchParticipants, ...kickParticipants];

    if (allParticipants.length === 0) {
      throw new BadRequestException('No eligible participants found with tickets > 0');
    }

    // Create participant records
    await (this.prisma as any).integratedGiftSubsGiveawayParticipant.createMany({
      data: allParticipants.map((p) => ({
        integratedGiftSubsGiveawayId: giveawayId,
        platform: p.platform,
        externalUserId: p.externalUserId,
        username: p.username,
        avatarUrl: p.avatarUrl,
        quantity: p.quantity,
        tickets: p.tickets,
      })),
    });

    // Fetch created participants to enrich with avatars
    const createdParticipants = await (this.prisma as any).integratedGiftSubsGiveawayParticipant.findMany({
      where: { integratedGiftSubsGiveawayId: giveawayId },
    });

    // Separate participants by platform
    const twitchParticipantsToEnrich = createdParticipants.filter(
      (p: any) => p.platform === ConnectedPlatform.TWITCH
    );
    const kickParticipantsToEnrich = createdParticipants.filter(
      (p: any) => p.platform === ConnectedPlatform.KICK
    );

    // Enrich Twitch participants with avatars
    if (twitchParticipantsToEnrich.length > 0) {
      await this.enrichTwitchParticipants(userId, twitchParticipantsToEnrich);
    }

    // Enrich Kick participants with avatars
    if (kickParticipantsToEnrich.length > 0) {
      await this.enrichKickParticipants(userId, kickParticipantsToEnrich);
    }

    return this.findOne(userId, giveawayId);
  }

  /**
   * Enrich Twitch participants with avatar URLs
   */
  private async enrichTwitchParticipants(userId: string, participants: any[]) {
    if (participants.length === 0) return;

    try {
      const userIds = participants.map((p) => p.externalUserId);
      const usersResponse = await this.twitchService.getUsers(userId, userIds);

      if (!usersResponse?.data) return;

      const usersMap = new Map(usersResponse.data.map((u: any) => [u.id, u]));

      // Update each participant with avatar
      for (const participant of participants) {
        const userData = usersMap.get(participant.externalUserId) as any;
        if (userData?.profile_image_url) {
          try {
            await (this.prisma as any).integratedGiftSubsGiveawayParticipant.update({
              where: { id: participant.id },
              data: { avatarUrl: userData.profile_image_url },
            });
          } catch (error) {
            console.warn(`Failed to update avatar for Twitch participant ${participant.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to enrich Twitch participants:', error);
    }
  }

  /**
   * Enrich Kick participants with avatar URLs
   */
  private async enrichKickParticipants(userId: string, participants: any[]) {
    if (participants.length === 0) return;

    try {
      const userIds = participants.map((p) => parseInt(p.externalUserId, 10)).filter((id) => !isNaN(id));
      const usersResponse = await this.kickService.getUsers(userId, userIds);

      if (!usersResponse?.data) return;

      const usersMap = new Map(usersResponse.data.map((u: any) => [u.user_id, u]));

      // Update each participant with avatar
      for (const participant of participants) {
        const kickUserId = parseInt(participant.externalUserId, 10);
        const userData = usersMap.get(kickUserId) as any;
        if (userData?.profile_picture) {
          try {
            await (this.prisma as any).integratedGiftSubsGiveawayParticipant.update({
              where: { id: participant.id },
              data: { avatarUrl: userData.profile_picture },
            });
          } catch (error) {
            console.warn(`Failed to update avatar for Kick participant ${participant.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to enrich Kick participants:', error);
    }
  }

  /**
   * Draw a winner from the integrated gift subs giveaway
   */
  async draw(userId: string, giveawayId: string): Promise<any> {
    const giveaway = await this.findOne(userId, giveawayId);

    if (!giveaway.participants || giveaway.participants.length === 0) {
      throw new BadRequestException('Cannot draw from a giveaway with no participants');
    }

    // Get participants that haven't won yet
    const existingWinners = giveaway.winners.filter((w: any) => w.status === 'WINNER');
    const winnerIds = new Set(existingWinners.map((w: any) => w.winnerParticipantId));
    const eligibleParticipants = giveaway.participants.filter((p: any) => !winnerIds.has(p.id));

    if (eligibleParticipants.length === 0) {
      throw new BadRequestException('No eligible participants remaining');
    }

    // Calculate total tickets and build ranges
    let currentTicket = 1;
    const participantRanges: Array<{ id: string; display: string; start: number; end: number }> = [];

    for (const participant of eligibleParticipants) {
      const start = currentTicket;
      const end = currentTicket + participant.tickets - 1;
      participantRanges.push({
        id: participant.id,
        display: `${participant.username}|${participant.tickets} tickets`,
        start,
        end,
      });
      currentTicket = end + 1;
    }

    const totalTickets = currentTicket - 1;

    // Generate list hash
    const listString = participantRanges
      .map((r) => `${r.id}:${r.display}:${r.start}-${r.end}`)
      .join('|');
    const listHashAlgo = 'SHA256';
    const listHash = this.calculateHash(listString, listHashAlgo);

    // Call Random.org to draw a number
    const randomOrgResult = await this.callRandomOrg(1, totalTickets);
    const drawnNumber = randomOrgResult.random.data[0];

    // Find winner by binary search
    const winnerRange = this.findWinnerByBinarySearch(participantRanges, drawnNumber);
    if (!winnerRange) {
      throw new BadRequestException('Failed to find winner range');
    }

    // Verify Random.org signature
    const verified = await this.verifyRandomOrgSignature(randomOrgResult);

    // Create winner record
    const winner = await (this.prisma as any).integratedGiftSubsGiveawayWinner.create({
      data: {
        integratedGiftSubsGiveawayId: giveawayId,
        winnerParticipantId: winnerRange.id,
        status: 'WINNER',
        participantRanges,
        totalTickets,
        listHashAlgo,
        listHash,
        randomOrgRandom: randomOrgResult.random,
        randomOrgSignature: randomOrgResult.signature,
        randomOrgVerificationUrl: this.generateRandomOrgVerificationUrl(randomOrgResult),
        drawnNumber,
        verified,
      },
      include: {
        winnerParticipant: true,
      },
    });

    return {
      winner,
    };
  }

  /**
   * Generate Random.org verification URL
   */
  private generateRandomOrgVerificationUrl(randomOrgResult: any): string {
    const serialNumber = randomOrgResult.random.serialNumber;
    return `https://api.random.org/signatures/form?format=json&serial=${serialNumber}`;
  }

  /**
   * Calculate hash of a string
   */
  private calculateHash(data: string, algorithm: string): string {
    const hash = crypto.createHash(algorithm.toLowerCase());
    hash.update(data);
    return hash.digest('hex');
  }

  /**
   * Call Random.org API to generate random integers
   */
  private async callRandomOrg(min: number, max: number): Promise<any> {
    const apiKey = this.configService.get('RANDOM_ORG_API_KEY');
    if (!apiKey) {
      throw new BadRequestException('Random.org API key not configured');
    }

    const url = 'https://api.random.org/json-rpc/4/invoke';
    const payload = {
      jsonrpc: '2.0',
      method: 'generateSignedIntegers',
      params: {
        apiKey,
        n: 1,
        min,
        max,
        replacement: true,
      },
      id: Date.now(),
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.error) {
        throw new BadRequestException(`Random.org error: ${data.error.message}`);
      }

      return data.result;
    } catch (error: any) {
      console.error('Random.org API error:', error);
      throw new BadRequestException(`Failed to call Random.org: ${error.message}`);
    }
  }

  /**
   * Verify Random.org signature
   */
  private async verifyRandomOrgSignature(randomOrgResult: any): Promise<boolean> {
    try {
      const crypto = await import('crypto');
      const publicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtyYj3sMhFmR+FaJRPd3x
vZqPRvxVqKgWqhcNEOmSvppR0rz5PLPX0qNM0qKqHh6xGnPcxw7hXMr7hKGJYpYm
X8m6xJ3qdFE//7J3i1aJh+LJ0kqM3mS7dhexqmJV0Q3ivNXbTbW/Z6m7UDUxQvNC
yN/3k/7cJaH4n2cLXQxD8B0Qn8cIvL0PHVH4VVGm3Q2CqMjKuYH7E5/bz3aKF1ZL
OtQIhKwWNtpZPNTEJE/CtW9fF0NTZxVDYnJEURvLT3wRJKT8YC3DJXLFqMTzHQU2
GvZqVQmf8NxzGxQJuQ7dCqgEVVGqEz0cEaE0KZVZtjdqcV6ixDHQOJyxLZRWZwAC
4wIDAQAB
-----END PUBLIC KEY-----`;

      const verify = crypto.createVerify('SHA512');
      verify.update(JSON.stringify(randomOrgResult.random));
      verify.end();

      return verify.verify(publicKey, randomOrgResult.signature, 'base64');
    } catch (error) {
      console.error('Failed to verify Random.org signature:', error);
      return false;
    }
  }

  /**
   * Find winner by binary search in participant ranges
   */
  private findWinnerByBinarySearch(
    ranges: Array<{ id: string; start: number; end: number; display: string }>,
    drawnNumber: number,
  ) {
    let left = 0;
    let right = ranges.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const range = ranges[mid];

      if (drawnNumber >= range.start && drawnNumber <= range.end) {
        return range;
      } else if (drawnNumber < range.start) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }

    return null;
  }
}
