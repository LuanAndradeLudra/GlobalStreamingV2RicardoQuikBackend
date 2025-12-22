import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { ConnectedPlatform } from '@prisma/client';
import { CreateIntegratedBitsKickCoinsGiveawayDto } from './dto/create-integrated-bits-kick-coins-giveaway.dto';
import { UpdateIntegratedBitsKickCoinsGiveawayDto } from './dto/update-integrated-bits-kick-coins-giveaway.dto';
import { DrawResponseDto } from '../giveaway/dto/draw-response.dto';
import { TwitchService } from '../twitch/twitch.service';
import { KickService } from '../kick/kick.service';
import * as crypto from 'crypto';

type IntegratedBitsKickCoinsCategory = 'WEEKLY' | 'MONTHLY';

interface TwitchBitsLeaderboardResponse {
  data: Array<{
    user_id: string;
    user_login: string;
    user_name: string;
    rank: number;
    score: number;
  }>;
}

interface KickCoinsLeaderboardResponse {
  data: {
    lifetime: Array<{
      user_id: number;
      username: string;
      gifted_amount: number;
      rank: number;
    }>;
    month: Array<{
      user_id: number;
      username: string;
      gifted_amount: number;
      rank: number;
    }>;
    week: Array<{
      user_id: number;
      username: string;
      gifted_amount: number;
      rank: number;
    }>;
  };
  message: string;
}

@Injectable()
export class IntegratedBitsKickCoinsGiveawayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly twitchService: TwitchService,
    private readonly kickService: KickService,
  ) {}

  /**
   * Get all Integrated Bits + Kick Coins giveaways (public endpoint - no user filter)
   */
  async findAllPublic() {
    const giveaways = await (this.prisma as any).integratedBitsKickCoinsGiveaway.findMany({
      orderBy: { createdAt: 'desc' },
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

    return giveaways;
  }

  /**
   * Get a single Integrated Bits + Kick Coins giveaway by ID (public endpoint - no user filter)
   */
  async findOnePublic(id: string) {
    const giveaway = await (this.prisma as any).integratedBitsKickCoinsGiveaway.findFirst({
      where: { id },
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
      throw new NotFoundException(`Integrated Bits + Kick Coins Giveaway with ID ${id} not found`);
    }

    return giveaway;
  }

  /**
   * Get all Integrated Bits + Kick Coins giveaways for a user
   */
  async findAll(userId: string) {
    const giveaways = await (this.prisma as any).integratedBitsKickCoinsGiveaway.findMany({
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
    const giveaway = await (this.prisma as any).integratedBitsKickCoinsGiveaway.findFirst({
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
      throw new NotFoundException(`Integrated Bits + Kick Coins Giveaway with ID ${id} not found`);
    }

    return giveaway;
  }

  /**
   * Generate name for giveaway
   */
  private generateGiveawayName(category: IntegratedBitsKickCoinsCategory): string {
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear();
    const categoryLabel = category === 'WEEKLY' ? 'Semanal' : 'Mensal';
    return `Sorteio Integrado Bits + Kick Coins - ${categoryLabel} - ${day} ${month} ${year}`;
  }

  /**
   * Create a new giveaway
   */
  async create(userId: string, dto: CreateIntegratedBitsKickCoinsGiveawayDto) {
    const name = dto.name || this.generateGiveawayName(dto.category);

    const giveaway = await (this.prisma as any).integratedBitsKickCoinsGiveaway.create({
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
  async update(userId: string, id: string, dto: UpdateIntegratedBitsKickCoinsGiveawayDto) {
    await this.findOne(userId, id);

    return (this.prisma as any).integratedBitsKickCoinsGiveaway.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * Delete a giveaway
   */
  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    await (this.prisma as any).integratedBitsKickCoinsGiveaway.delete({
      where: { id },
    });
  }

  /**
   * Sync participants from both Twitch Bits and Kick Coins leaderboards
   */
  async syncParticipants(
    userId: string,
    giveawayId: string,
    twitchBitsLeaderboard: TwitchBitsLeaderboardResponse,
    kickCoinsLeaderboard: KickCoinsLeaderboardResponse,
  ) {
    const giveaway = await this.findOne(userId, giveawayId);

    // Validate Twitch leaderboard
    if (!twitchBitsLeaderboard?.data || !Array.isArray(twitchBitsLeaderboard.data)) {
      throw new BadRequestException('Invalid Twitch Bits leaderboard data structure');
    }

    // Validate Kick leaderboard
    if (!kickCoinsLeaderboard?.data) {
      throw new BadRequestException('Invalid Kick Coins leaderboard data structure');
    }

    // Get the appropriate Kick leaderboard array based on category
    const kickLeaderboardArray = giveaway.category === 'WEEKLY' 
      ? kickCoinsLeaderboard.data.week 
      : kickCoinsLeaderboard.data.month;

    if (!kickLeaderboardArray || !Array.isArray(kickLeaderboardArray)) {
      throw new BadRequestException('Invalid Kick Coins leaderboard array');
    }

    // Get ticket donation rules
    const twitchDonationRule = await this.prisma.ticketGlobalDonationRule.findFirst({
      where: {
        userId,
        platform: ConnectedPlatform.TWITCH,
        unitType: 'BITS',
      },
    });

    if (!twitchDonationRule) {
      throw new BadRequestException(
        'Ticket donation rule for TWITCH BITS not configured. Please configure it in Ticket Config first.',
      );
    }

    const kickDonationRule = await this.prisma.ticketGlobalDonationRule.findFirst({
      where: {
        userId,
        platform: ConnectedPlatform.KICK,
        unitType: 'KICK_COINS',
      },
    });

    if (!kickDonationRule) {
      throw new BadRequestException(
        'Ticket donation rule for KICK KICK_COINS not configured. Please configure it in Ticket Config first.',
      );
    }

    // Delete existing participants
    await (this.prisma as any).integratedBitsKickCoinsGiveawayParticipant.deleteMany({
      where: { integratedBitsKickCoinsGiveawayId: giveawayId },
    });

    // Process Twitch Bits participants
    const twitchParticipants = [];
    for (const entry of twitchBitsLeaderboard.data) {
      const tickets = Math.floor(entry.score / twitchDonationRule.unitSize) * twitchDonationRule.ticketsPerUnitSize;

      if (tickets > 0) {
        const participant = await (this.prisma as any).integratedBitsKickCoinsGiveawayParticipant.create({
          data: {
            integratedBitsKickCoinsGiveawayId: giveawayId,
            platform: ConnectedPlatform.TWITCH,
            externalUserId: entry.user_id,
            username: entry.user_name,
            amount: entry.score,
            tickets,
          },
        });
        twitchParticipants.push(participant);
      }
    }

    // Process Kick Coins participants
    const kickParticipants = [];
    for (const entry of kickLeaderboardArray) {
      const tickets = Math.floor(entry.gifted_amount / kickDonationRule.unitSize) * kickDonationRule.ticketsPerUnitSize;

      if (tickets > 0) {
        const participant = await (this.prisma as any).integratedBitsKickCoinsGiveawayParticipant.create({
          data: {
            integratedBitsKickCoinsGiveawayId: giveawayId,
            platform: ConnectedPlatform.KICK,
            externalUserId: entry.user_id.toString(),
            username: entry.username,
            amount: entry.gifted_amount,
            tickets,
          },
        });
        kickParticipants.push(participant);
      }
    }

    // Enrich with user data
    const enrichedTwitchParticipants = await this.enrichTwitchParticipantsWithUserData(userId, twitchParticipants);
    const enrichedKickParticipants = await this.enrichKickParticipantsWithUserData(userId, kickParticipants);

    return [...enrichedTwitchParticipants, ...enrichedKickParticipants];
  }

  /**
   * Enrich Twitch participants with user data
   */
  private async enrichTwitchParticipantsWithUserData(
    userId: string,
    participants: Array<{ id: string; externalUserId: string; [key: string]: any }>,
  ): Promise<Array<any>> {
    if (!participants || participants.length === 0) {
      return [];
    }

    const userIds = participants.map((p) => p.externalUserId).filter((id) => id);

    if (userIds.length === 0) {
      return participants;
    }

    try {
      const usersResponse = await this.twitchService.getUsers(userId, userIds);
      const usersMap = new Map<string, any>();
      
      if (usersResponse?.data && Array.isArray(usersResponse.data)) {
        usersResponse.data.forEach((user: any) => {
          usersMap.set(user.id, user);
        });
      }

      return await Promise.all(
        participants.map(async (participant) => {
          const userData = usersMap.get(participant.externalUserId);

          if (userData?.profile_image_url) {
            try {
              const updated = await (this.prisma as any).integratedBitsKickCoinsGiveawayParticipant.update({
                where: { id: participant.id },
                data: { avatarUrl: userData.profile_image_url },
              });
              return {
                ...updated,
                userData: {
                  id: userData.id,
                  login: userData.login,
                  display_name: userData.display_name,
                  profile_image_url: userData.profile_image_url,
                },
              };
            } catch (error) {
              console.warn(`Failed to update avatarUrl for participant ${participant.id}:`, error);
            }
          }

          return participant;
        }),
      );
    } catch (error) {
      console.warn('Failed to fetch Twitch user data:', error);
      return participants;
    }
  }

  /**
   * Enrich Kick participants with user data
   */
  private async enrichKickParticipantsWithUserData(
    userId: string,
    participants: Array<{ id: string; externalUserId: string; [key: string]: any }>,
  ): Promise<Array<any>> {
    if (!participants || participants.length === 0) {
      return [];
    }

    const userIds = participants
      .map((p) => parseInt(p.externalUserId, 10))
      .filter((id) => !isNaN(id));

    if (userIds.length === 0) {
      return participants;
    }

    try {
      const usersResponse = await this.kickService.getUsers(userId, userIds);
      const usersMap = new Map<number, any>();
      
      if (usersResponse?.data && Array.isArray(usersResponse.data)) {
        usersResponse.data.forEach((user: any) => {
          usersMap.set(user.user_id, user);
        });
      }

      return await Promise.all(
        participants.map(async (participant) => {
          const kickUserId = parseInt(participant.externalUserId, 10);
          const userData = usersMap.get(kickUserId);

          if (userData?.profile_picture) {
            try {
              const updated = await (this.prisma as any).integratedBitsKickCoinsGiveawayParticipant.update({
                where: { id: participant.id },
                data: { avatarUrl: userData.profile_picture },
              });
              return {
                ...updated,
                userData: {
                  user_id: userData.user_id,
                  name: userData.name,
                  profile_picture: userData.profile_picture,
                },
              };
            } catch (error) {
              console.warn(`Failed to update avatarUrl for participant ${participant.id}:`, error);
            }
          }

          return participant;
        }),
      );
    } catch (error) {
      console.warn('Failed to fetch Kick user data:', error);
      return participants;
    }
  }

  /**
   * Draw a winner
   */
  async draw(userId: string, giveawayId: string): Promise<DrawResponseDto> {
    const giveaway = await this.findOne(userId, giveawayId);

    const existingWinners = await (this.prisma as any).integratedBitsKickCoinsGiveawayWinner.findMany({
      where: { integratedBitsKickCoinsGiveawayId: giveawayId },
    });
    const repickNumber = existingWinners.length > 0 ? existingWinners.length : null;

    if (repickNumber !== null && repickNumber > 0) {
      await (this.prisma as any).integratedBitsKickCoinsGiveawayWinner.updateMany({
        where: {
          integratedBitsKickCoinsGiveawayId: giveawayId,
          status: 'WINNER' as any,
        },
        data: {
          status: 'REPICK' as any,
        },
      });
    }

    const repickedWinners = await (this.prisma as any).integratedBitsKickCoinsGiveawayWinner.findMany({
      where: {
        integratedBitsKickCoinsGiveawayId: giveawayId,
        status: 'REPICK' as any,
      },
      select: {
        winnerParticipantId: true,
      },
    });

    const repickedParticipantIds = new Set(repickedWinners.map((w: any) => w.winnerParticipantId));

    const allParticipants = await (this.prisma as any).integratedBitsKickCoinsGiveawayParticipant.findMany({
      where: { integratedBitsKickCoinsGiveawayId: giveawayId },
      orderBy: [
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
    });

    const participants = allParticipants.filter((p: any) => !repickedParticipantIds.has(p.id));

    if (participants.length === 0) {
      throw new BadRequestException('Cannot draw winner: no eligible participants found');
    }

    if (participants.length === 1) {
      throw new BadRequestException('Cannot draw winner: at least 2 participants are required');
    }

    const ranges: Array<{ id: string; display: string; start: number; end: number }> = [];
    let start = 0;

    for (const participant of participants) {
      if (repickedParticipantIds.has(participant.id)) {
        continue;
      }

      const platformLabel = participant.platform === 'TWITCH' ? 'BITS' : 'KICK_COINS';
      const display = `${participant.username}|${platformLabel}`;
      const end = start + participant.tickets - 1;
      ranges.push({
        id: participant.id,
        display,
        start,
        end,
      });
      start = end + 1;
    }

    const totalTickets = start;

    const listLines = ranges.map((r) => `${r.id};${r.display};${r.start};${r.end}`).join('\n');
    const hashAlgo = this.configService.get<string>('LIST_HASH_ALGO', 'SHA256').toUpperCase();
    const hash = this.calculateHash(listLines, hashAlgo);

    const randomOrgApiKey = this.configService.get<string>('RANDOM_ORG_API_KEY');
    if (!randomOrgApiKey) {
      throw new BadRequestException('RANDOM_ORG_API_KEY is not configured');
    }

    const randomResult = await this.callRandomOrg(
      randomOrgApiKey,
      totalTickets,
      giveaway.name,
      repickNumber,
    );
    const drawnNumber = randomResult.random.data[0];
    const randomPayload = randomResult.random;
    const signature = randomResult.signature;

    const verified = await this.verifyRandomOrgSignature(randomPayload, signature);
    const winner = this.findWinnerByBinarySearch(ranges, drawnNumber);
    const verificationUrl = this.generateRandomOrgVerificationUrl(randomPayload, signature);

    await (this.prisma as any).integratedBitsKickCoinsGiveawayWinner.create({
      data: {
        integratedBitsKickCoinsGiveawayId: giveawayId,
        winnerParticipantId: winner.id,
        status: 'WINNER' as any,
        participantRanges: ranges,
        totalTickets,
        listHashAlgo: hashAlgo,
        listHash: hash,
        randomOrgRandom: randomPayload,
        randomOrgSignature: signature,
        randomOrgVerificationUrl: verificationUrl,
        drawnNumber,
        verified,
      },
    });

    return {
      ticket: giveawayId,
      totalTickets,
      listHashAlgo: hashAlgo,
      listHash: hash,
      draw: {
        number: drawnNumber,
        source: 'random.org/signed',
        random: randomPayload,
        signature,
        verified,
      },
      winner: {
        id: winner.id,
        display: winner.display,
        start: winner.start,
        end: winner.end,
        index: drawnNumber,
      },
      createdAt: new Date().toISOString(),
    };
  }

  private generateRandomOrgVerificationUrl(random: any, signature: string): string {
    const randomJson = JSON.stringify(random);
    const randomBase64 = Buffer.from(randomJson).toString('base64');
    const signatureEncoded = encodeURIComponent(signature);
    return `https://api.random.org/signatures/form?format=json&random=${randomBase64}&signature=${signatureEncoded}`;
  }

  private calculateHash(data: string, algorithm: string): string {
    if (algorithm === 'MD5') {
      return crypto.createHash('md5').update(data).digest('hex');
    }
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private async callRandomOrg(
    apiKey: string,
    max: number,
    giveawayName: string,
    repickNumber: number | null,
  ): Promise<{
    random: any;
    signature: string;
  }> {
    let userData: string;
    if (repickNumber !== null && repickNumber > 0) {
      userData = `${giveawayName} - Repick ${repickNumber}`;
    } else {
      userData = giveawayName;
    }

    const requestBody = {
      jsonrpc: '2.0',
      method: 'generateSignedIntegers',
      params: {
        apiKey,
        n: 1,
        min: 0,
        max: max - 1,
        replacement: true,
        userData,
      },
      id: 1,
    };

    const response = await fetch('https://api.random.org/json-rpc/4/invoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new BadRequestException(`Random.org API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new BadRequestException(`Random.org API error: ${data.error.message || 'Unknown error'}`);
    }

    return {
      random: data.result.random,
      signature: data.result.signature,
    };
  }

  private async verifyRandomOrgSignature(random: any, signature: string): Promise<boolean> {
    try {
      const requestBody = {
        jsonrpc: '2.0',
        method: 'verify',
        params: {
          random,
          signature,
        },
        id: 1,
      };

      const response = await fetch('https://api.random.org/json-rpc/4/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();

      if (data.error) {
        return false;
      }

      return data.result.authentic === true;
    } catch (error) {
      return false;
    }
  }

  private findWinnerByBinarySearch(
    ranges: Array<{ id: string; display: string; start: number; end: number }>,
    ticketIndex: number,
  ): { id: string; display: string; start: number; end: number } {
    let left = 0;
    let right = ranges.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const range = ranges[mid];

      if (ticketIndex >= range.start && ticketIndex <= range.end) {
        return range;
      }

      if (ticketIndex < range.start) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }

    throw new BadRequestException(`Could not find winner for ticket index ${ticketIndex}`);
  }
}











