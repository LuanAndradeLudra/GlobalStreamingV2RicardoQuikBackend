import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { ConnectedPlatform } from '@prisma/client';
import { CreateTwitchGiftSubsGiveawayDto, TwitchGiftSubsCategory } from './dto/create-twitch-gift-subs-giveaway.dto';
import { UpdateTwitchGiftSubsGiveawayDto } from './dto/update-twitch-gift-subs-giveaway.dto';
import { DrawResponseDto } from '../giveaway/dto/draw-response.dto';
import { TwitchService } from '../twitch/twitch.service';
import * as crypto from 'crypto';

interface TwitchSubscriptionData {
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
}

interface SyncParticipantsData {
  data: TwitchSubscriptionData[];
}

@Injectable()
export class TwitchGiftSubsGiveawayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly twitchService: TwitchService,
  ) {}

  /**
   * Get all Twitch Gift Subs giveaways (public endpoint - no user filter)
   */
  async findAllPublic() {
    const giveaways = await (this.prisma as any).twitchGiftSubsGiveaway.findMany({
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
   * Get a single Twitch Gift Subs giveaway by ID (public endpoint - no user filter)
   */
  async findOnePublic(id: string) {
    const giveaway = await (this.prisma as any).twitchGiftSubsGiveaway.findFirst({
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
      throw new NotFoundException(`Twitch Gift Subs Giveaway with ID ${id} not found`);
    }

    return giveaway;
  }

  /**
   * Get all Twitch Gift Subs giveaways for a user (without participants and winners for performance)
   */
  async findAll(userId: string) {
    const giveaways = await (this.prisma as any).twitchGiftSubsGiveaway.findMany({
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

    // Transform to include participant count
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
   * Get a single Twitch Gift Subs giveaway by ID
   */
  async findOne(userId: string, id: string) {
    const giveaway = await (this.prisma as any).twitchGiftSubsGiveaway.findFirst({
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
      throw new NotFoundException(`Twitch Gift Subs Giveaway with ID ${id} not found`);
    }

    return giveaway;
  }

  /**
   * Generate name for Twitch Gift Subs giveaway
   * Format: "Sorteio de Twitch Gift Subs - Ativos - DD MM YYYY"
   */
  private generateGiveawayName(category: TwitchGiftSubsCategory): string {
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear();
    return `Sorteio de Twitch Gift Subs - Ativos - ${day} ${month} ${year}`;
  }

  /**
   * Create a new Twitch Gift Subs giveaway
   * Note: Participants should be synced separately via syncParticipants endpoint (called from frontend)
   */
  async create(userId: string, dto: CreateTwitchGiftSubsGiveawayDto) {
    // Use provided name or generate automatically
    const name = dto.name || this.generateGiveawayName(dto.category);

    // Create giveaway
    const giveaway = await (this.prisma as any).twitchGiftSubsGiveaway.create({
      data: {
        userId,
        name,
        category: dto.category,
      },
    });

    // Return giveaway (participants will be synced by frontend)
    return this.findOne(userId, giveaway.id);
  }

  /**
   * Update a Twitch Gift Subs giveaway
   */
  async update(userId: string, id: string, dto: UpdateTwitchGiftSubsGiveawayDto) {
    await this.findOne(userId, id); // Ensure it exists and belongs to user

    return (this.prisma as any).twitchGiftSubsGiveaway.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * Delete a Twitch Gift Subs giveaway
   */
  async remove(userId: string, id: string) {
    await this.findOne(userId, id); // Ensure it exists and belongs to user

    await (this.prisma as any).twitchGiftSubsGiveaway.delete({
      where: { id },
    });
  }

  /**
   * Sync participants from subscriptions data (called from frontend)
   */
  async syncParticipantsFromSubscriptions(
    userId: string,
    giveawayId: string,
    subscriptionsData: SyncParticipantsData,
  ) {
    // Ensure giveaway exists and belongs to user
    const giveaway = await this.findOne(userId, giveawayId);

    // Validate subscriptions data structure
    if (!subscriptionsData?.data || !Array.isArray(subscriptionsData.data)) {
      throw new BadRequestException('Invalid subscriptions data structure');
    }

    // Filter only gift subscriptions
    const giftSubs = subscriptionsData.data.filter((sub) => sub.is_gift === true && sub.gifter_id);

    if (giftSubs.length === 0) {
      throw new BadRequestException('No gift subscriptions found in the provided data');
    }

    // Group by gifter_id to count quantity
    const gifterMap = new Map<string, { gifter_id: string; gifter_name: string; quantity: number }>();

    for (const sub of giftSubs) {
      if (!gifterMap.has(sub.gifter_id)) {
        gifterMap.set(sub.gifter_id, {
          gifter_id: sub.gifter_id,
          gifter_name: sub.gifter_name,
          quantity: 0,
        });
      }
      const gifter = gifterMap.get(sub.gifter_id)!;
      gifter.quantity++;
    }

    // Convert to array
    const giftersArray = Array.from(gifterMap.values());

    return this.processGiftersArray(userId, giveawayId, giftersArray);
  }

  /**
   * Helper method to fetch user data from Twitch API and enrich participants
   * @param userId - The admin user ID (for authentication)
   * @param participants - Array of participants to enrich
   * @param updateAvatarUrl - Whether to update avatarUrl in database (default: true)
   * @returns Enriched participants with userData field
   */
  async enrichParticipantsWithUserData(
    userId: string,
    participants: Array<{ id: string; externalUserId: string; [key: string]: any }>,
    updateAvatarUrl: boolean = true,
  ): Promise<Array<any>> {
    if (!participants || participants.length === 0) {
      return participants.map((p) => ({
        ...p,
        userData: null,
      }));
    }

    const userIds = participants.map((p) => p.externalUserId).filter((id) => id);

    if (userIds.length === 0) {
      return participants.map((p) => ({
        ...p,
        userData: null,
      }));
    }

    try {
      const usersResponse = await this.twitchService.getUsers(userId, userIds);

      // Create a map of id to user data
      const usersMap = new Map<string, any>();
      if (usersResponse?.data && Array.isArray(usersResponse.data)) {
        usersResponse.data.forEach((user: any) => {
          usersMap.set(user.id, user);
        });
      }

      // Enrich participants with user data
      const enrichedParticipants = await Promise.all(
        participants.map(async (participant) => {
          const userData = usersMap.get(participant.externalUserId);

          if (!userData) {
            return {
              ...participant,
              userData: null,
            };
          }

          const userDataEnriched = {
            id: userData.id,
            login: userData.login,
            display_name: userData.display_name,
            profile_image_url: userData.profile_image_url,
          };

          // Update avatarUrl in database if requested and profile_image_url exists
          if (updateAvatarUrl && userData.profile_image_url) {
            try {
              const updatedParticipant = await (this.prisma as any).twitchGiftSubsGiveawayParticipant.update({
                where: { id: participant.id },
                data: { avatarUrl: userData.profile_image_url },
              });

              return {
                ...updatedParticipant,
                userData: userDataEnriched,
              };
            } catch (error) {
              // If update fails, return participant with userData but without updating DB
              console.warn(`Failed to update avatarUrl for participant ${participant.id}:`, error);
              return {
                ...participant,
                userData: userDataEnriched,
              };
            }
          }

          return {
            ...participant,
            userData: userDataEnriched,
          };
        }),
      );

      return enrichedParticipants;
    } catch (error) {
      // If fetching user data fails, log but don't fail the entire operation
      console.warn('Failed to fetch user data from Twitch API:', error);
      // Return participants without enrichment
      return participants.map((p) => ({
        ...p,
        userData: null,
      }));
    }
  }

  /**
   * Process gifters array and create participants
   */
  private async processGiftersArray(
    userId: string,
    giveawayId: string,
    giftersArray: Array<{ gifter_id: string; gifter_name: string; quantity: number }>,
  ) {
    // Get ticket donation rule for TWITCH GIFT_SUB
    const donationRule = await this.prisma.ticketGlobalDonationRule.findFirst({
      where: {
        userId,
        platform: ConnectedPlatform.TWITCH,
        unitType: 'GIFT_SUB',
      },
    });

    if (!donationRule) {
      throw new BadRequestException(
        'Ticket donation rule for TWITCH GIFT_SUB not configured. Please configure it in Ticket Config first.',
      );
    }

    // Delete existing participants
    await (this.prisma as any).twitchGiftSubsGiveawayParticipant.deleteMany({
      where: { twitchGiftSubsGiveawayId: giveawayId },
    });

    // Calculate tickets and create participants
    const participants = [];
    for (const gifter of giftersArray) {
      // Calculate tickets: floor(quantity / unitSize) * ticketsPerUnitSize
      const tickets = Math.floor(gifter.quantity / donationRule.unitSize) * donationRule.ticketsPerUnitSize;

      // Only create participant if they have tickets
      if (tickets > 0) {
        const participant = await (this.prisma as any).twitchGiftSubsGiveawayParticipant.create({
          data: {
            twitchGiftSubsGiveawayId: giveawayId,
            externalUserId: gifter.gifter_id,
            username: gifter.gifter_name,
            quantity: gifter.quantity,
            tickets,
          },
        });
        participants.push(participant);
      }
    }

    // Enrich participants with user data from Twitch API
    return this.enrichParticipantsWithUserData(userId, participants, true);
  }

  /**
   * Sync participants from subscriptions data provided by frontend
   */
  async syncParticipants(
    userId: string,
    giveawayId: string,
    subscriptionsData: SyncParticipantsData,
  ) {
    return this.syncParticipantsFromSubscriptions(userId, giveawayId, subscriptionsData);
  }

  /**
   * Draw a winner from the Twitch Gift Subs giveaway
   */
  async draw(userId: string, giveawayId: string): Promise<DrawResponseDto> {
    // Ensure the giveaway exists and belongs to the user
    const giveaway = await this.findOne(userId, giveawayId);

    // Count existing winners to determine repick number
    const existingWinners = await (this.prisma as any).twitchGiftSubsGiveawayWinner.findMany({
      where: { twitchGiftSubsGiveawayId: giveawayId },
    });
    const repickNumber = existingWinners.length > 0 ? existingWinners.length : null;

    // If this is a repick, mark current winner as REPICK first
    if (repickNumber !== null && repickNumber > 0) {
      await (this.prisma as any).twitchGiftSubsGiveawayWinner.updateMany({
        where: {
          twitchGiftSubsGiveawayId: giveawayId,
          status: 'WINNER' as any,
        },
        data: {
          status: 'REPICK' as any,
        },
      });
    }

    // Fetch all participants ordered by creation date (or ID as fallback)
    // Exclude participants that have been repicked (have a winner entry with status REPICK)
    const repickedWinners = await (this.prisma as any).twitchGiftSubsGiveawayWinner.findMany({
      where: {
        twitchGiftSubsGiveawayId: giveawayId,
        status: 'REPICK' as any,
      },
      select: {
        winnerParticipantId: true,
      },
    });

    const repickedParticipantIds = new Set(repickedWinners.map((w: any) => w.winnerParticipantId));

    const allParticipants = await (this.prisma as any).twitchGiftSubsGiveawayParticipant.findMany({
      where: { twitchGiftSubsGiveawayId: giveawayId },
      orderBy: [
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
    });

    // Filter out repicked participants
    const participants = allParticipants.filter((p: any) => !repickedParticipantIds.has(p.id));

    if (participants.length === 0) {
      throw new BadRequestException('Cannot draw winner: no eligible participants found (all have been repicked)');
    }

    // Prevent drawing if there is only 1 participant
    if (participants.length === 1) {
      throw new BadRequestException('Cannot draw winner: at least 2 participants are required to draw a winner');
    }

    // Calculate ticket ranges - ensure repicked participants are not included
    const ranges: Array<{ id: string; display: string; start: number; end: number }> = [];
    let start = 0;

    for (const participant of participants) {
      // Double check: skip if this participant is repicked
      if (repickedParticipantIds.has(participant.id)) {
        continue;
      }

      const display = `${participant.username}|TWITCH_GIFT_SUB`;
      const end = start + participant.tickets - 1;
      ranges.push({
        id: participant.id,
        display,
        start,
        end,
      });
      start = end + 1;
    }

    const totalTickets = start; // start is now the total count

    // Generate hash of the participant list
    const listLines = ranges.map((r) => `${r.id};${r.display};${r.start};${r.end}`).join('\n');
    const hashAlgo = this.configService.get<string>('LIST_HASH_ALGO', 'SHA256').toUpperCase();
    const hash = this.calculateHash(listLines, hashAlgo);

    // Call Random.org Signed API
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

    // Verify signature (optional but recommended)
    const verified = await this.verifyRandomOrgSignature(randomPayload, signature);

    // Find winner using binary search
    const winner = this.findWinnerByBinarySearch(ranges, drawnNumber);

    // Generate Random.org verification URL
    const verificationUrl = this.generateRandomOrgVerificationUrl(randomPayload, signature);

    // Save new winner to database
    await (this.prisma as any).twitchGiftSubsGiveawayWinner.create({
      data: {
        twitchGiftSubsGiveawayId: giveawayId,
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

    // Return audit payload
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

  /**
   * Generate Random.org verification URL.
   */
  private generateRandomOrgVerificationUrl(random: any, signature: string): string {
    const randomJson = JSON.stringify(random);
    const randomBase64 = Buffer.from(randomJson).toString('base64');
    const signatureEncoded = encodeURIComponent(signature);
    return `https://api.random.org/signatures/form?format=json&random=${randomBase64}&signature=${signatureEncoded}`;
  }

  /**
   * Calculate hash of a string using the specified algorithm.
   */
  private calculateHash(data: string, algorithm: string): string {
    if (algorithm === 'MD5') {
      return crypto.createHash('md5').update(data).digest('hex');
    }
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Call Random.org Signed API to generate a random integer.
   */
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

  /**
   * Verify Random.org signature.
   */
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

  /**
   * Find winner using binary search on ticket ranges.
   */
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












