import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGiveawayDto } from './dto/create-giveaway.dto';
import { UpdateGiveawayDto } from './dto/update-giveaway.dto';
import { StreamGiveaway, StreamGiveawayStatus, ConnectedPlatform, StreamGiveawayParticipant } from '@prisma/client';
import { CreateGiveawayTicketRuleOverrideDto } from './dto/create-giveaway-ticket-rule-override.dto';
import { CreateGiveawayDonationRuleOverrideDto } from './dto/create-giveaway-donation-rule-override.dto';
import { CreateGiveawayDonationConfigDto } from './dto/create-giveaway-donation-config.dto';
import { CreateParticipantDto } from './dto/create-participant.dto';
import { CreateParticipantsBatchDto } from './dto/create-participants-batch.dto';
import { DrawResponseDto } from './dto/draw-response.dto';
import * as crypto from 'crypto';

@Injectable()
export class GiveawayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get the universe of valid roles for given platforms.
   * NON_SUB is now platform-specific: TWITCH_NON_SUB, KICK_NON_SUB, YOUTUBE_NON_SUB.
   * Adds platform-specific subscription roles based on platforms.
   */
  getRoleUniverseForPlatforms(platforms: ConnectedPlatform[]): string[] {
    const roles: string[] = [];

    // Add platform-specific NON_SUB roles
    if (platforms.includes(ConnectedPlatform.TWITCH)) {
      roles.push('TWITCH_NON_SUB', 'TWITCH_TIER_1', 'TWITCH_TIER_2', 'TWITCH_TIER_3');
    }
    if (platforms.includes(ConnectedPlatform.KICK)) {
      roles.push('KICK_NON_SUB', 'KICK_SUB');
    }
    if (platforms.includes(ConnectedPlatform.YOUTUBE)) {
      roles.push('YOUTUBE_NON_SUB', 'YOUTUBE_SUB');
    }

    return roles;
  }

  /**
   * Normalize allowedRoles based on shortcuts and platforms.
   * - If subsOnly: expand to all subscription roles for selected platforms
   * - If nonSubsOnly: set to ["NON_SUB"]
   * - Otherwise: validate against role universe
   */
  normalizeAllowedRoles(
    input: {
      subsOnly?: boolean;
      nonSubsOnly?: boolean;
      allowedRoles?: string[];
      platforms: ConnectedPlatform[];
    },
  ): string[] {
    const { subsOnly, nonSubsOnly, allowedRoles, platforms } = input;

    if (nonSubsOnly) {
      // Return platform-specific NON_SUB roles
      const roles: string[] = [];
      if (platforms.includes(ConnectedPlatform.TWITCH)) {
        roles.push('TWITCH_NON_SUB');
      }
      if (platforms.includes(ConnectedPlatform.KICK)) {
        roles.push('KICK_NON_SUB');
      }
      if (platforms.includes(ConnectedPlatform.YOUTUBE)) {
        roles.push('YOUTUBE_NON_SUB');
      }
      return roles;
    }

    if (subsOnly) {
      const universe = this.getRoleUniverseForPlatforms(platforms);
      // Return all roles except NON_SUB variants
      return universe.filter((role) => !role.includes('NON_SUB'));
    }

    if (allowedRoles && allowedRoles.length > 0) {
      const universe = this.getRoleUniverseForPlatforms(platforms);
      // Validate that all provided roles are in the universe
      const invalidRoles = allowedRoles.filter((role) => !universe.includes(role));
      if (invalidRoles.length > 0) {
        throw new BadRequestException(
          `Invalid roles for selected platforms: ${invalidRoles.join(', ')}. Valid roles: ${universe.join(', ')}`,
        );
      }
      return allowedRoles;
    }

    // Default: allow all roles
    return this.getRoleUniverseForPlatforms(platforms);
  }

  /**
   * Validate platforms are stream platforms only (TWITCH, KICK, YOUTUBE).
   */
  validatePlatforms(platforms: ConnectedPlatform[]): void {
    const streamPlatforms: ConnectedPlatform[] = [ConnectedPlatform.TWITCH, ConnectedPlatform.KICK, ConnectedPlatform.YOUTUBE];
    const invalidPlatforms = platforms.filter((p) => !streamPlatforms.includes(p));
    if (invalidPlatforms.length > 0) {
      throw new BadRequestException(
        `Invalid platforms: ${invalidPlatforms.join(', ')}. Only stream platforms are allowed: TWITCH, KICK, YOUTUBE`,
      );
    }
  }

  /**
   * Upsert ticket rule overrides for a stream giveaway.
   * Removes existing overrides not in the new list, creates/updates the ones provided.
   */
  async upsertTicketOverrides(
    streamGiveawayId: string,
    overrides: CreateGiveawayTicketRuleOverrideDto[] | undefined,
  ): Promise<void> {
    if (!overrides) {
      return;
    }

    // Get existing overrides
    const existing = await this.prisma.streamGiveawayTicketRuleOverride.findMany({
      where: { streamGiveawayId },
    });

    const existingRoles = new Set(existing.map((o) => o.role));
    const newRoles = new Set(overrides.map((o) => o.role));

    // Delete overrides that are no longer in the list
    const toDelete = existing.filter((o) => !newRoles.has(o.role));
    if (toDelete.length > 0) {
      await this.prisma.streamGiveawayTicketRuleOverride.deleteMany({
        where: {
          streamGiveawayId,
          role: { in: toDelete.map((o) => o.role) },
        },
      });
    }

    // Upsert the new/updated overrides
    await Promise.all(
      overrides.map((override) =>
        this.prisma.streamGiveawayTicketRuleOverride.upsert({
          where: {
            streamGiveawayId_role: {
              streamGiveawayId,
              role: override.role,
            },
          },
          update: {
            ticketsPerUnit: override.ticketsPerUnit,
          },
          create: {
            streamGiveawayId,
            role: override.role,
            ticketsPerUnit: override.ticketsPerUnit,
          },
        }),
      ),
    );
  }

  /**
   * Upsert donation configs for a stream giveaway.
   * Removes existing configs not in the new list, creates/updates the ones provided.
   */
  async upsertDonationConfigs(
    streamGiveawayId: string,
    configs: CreateGiveawayDonationConfigDto[] | undefined,
  ): Promise<void> {
    if (!configs) {
      return;
    }

    // Get existing configs
    const existing = await this.prisma.streamGiveawayDonationConfig.findMany({
      where: { streamGiveawayId },
    });

    const existingKeys = new Set(
      existing.map((c) => `${c.platform}:${c.unitType}`),
    );
    const newKeys = new Set(
      configs.map((c) => `${c.platform}:${c.unitType}`),
    );

    // Delete configs that are no longer in the list
    const toDelete = existing.filter(
      (c) => !newKeys.has(`${c.platform}:${c.unitType}`),
    );
    if (toDelete.length > 0) {
      await this.prisma.streamGiveawayDonationConfig.deleteMany({
        where: {
          streamGiveawayId,
          id: { in: toDelete.map((c) => c.id) },
        },
      });
    }

    // Upsert the new/updated configs
    await Promise.all(
      configs.map((config) =>
        this.prisma.streamGiveawayDonationConfig.upsert({
          where: {
            streamGiveawayId_platform_unitType: {
              streamGiveawayId,
              platform: config.platform,
              unitType: config.unitType,
            },
          },
          update: {
            donationWindow: config.donationWindow,
          },
          create: {
            streamGiveawayId,
            platform: config.platform,
            unitType: config.unitType,
            donationWindow: config.donationWindow,
          },
        }),
      ),
    );
  }

  /**
   * Upsert donation rule overrides for a stream giveaway.
   * Removes existing overrides not in the new list, creates/updates the ones provided.
   */
  async upsertDonationOverrides(
    streamGiveawayId: string,
    overrides: CreateGiveawayDonationRuleOverrideDto[] | undefined,
  ): Promise<void> {
    if (!overrides) {
      return;
    }

    // Get existing overrides
    const existing = await this.prisma.streamGiveawayDonationRuleOverride.findMany({
      where: { streamGiveawayId },
    });

    const existingKeys = new Set(
      existing.map((o: { platform: ConnectedPlatform; unitType: string }) => `${o.platform}:${o.unitType}`),
    );
    const newKeys = new Set(
      overrides.map((o) => `${o.platform}:${o.unitType}`),
    );

    // Delete overrides that are no longer in the list
    const toDelete = existing.filter(
      (o: { platform: ConnectedPlatform; unitType: string }) => !newKeys.has(`${o.platform}:${o.unitType}`),
    );
    if (toDelete.length > 0) {
      await Promise.all(
        toDelete.map((o: { streamGiveawayId: string; platform: ConnectedPlatform; unitType: string }) =>
          this.prisma.streamGiveawayDonationRuleOverride.delete({
            where: {
              streamGiveawayId_platform_unitType: {
                streamGiveawayId: o.streamGiveawayId,
                platform: o.platform,
                unitType: o.unitType,
              },
            },
          }),
        ),
      );
    }

    // Upsert the new/updated overrides
    await Promise.all(
      overrides.map((override) =>
        this.prisma.streamGiveawayDonationRuleOverride.upsert({
          where: {
            streamGiveawayId_platform_unitType: {
              streamGiveawayId,
              platform: override.platform,
              unitType: override.unitType,
            },
          },
          update: {
            unitSize: override.unitSize,
            ticketsPerUnitSize: override.ticketsPerUnitSize,
          },
          create: {
            streamGiveawayId,
            platform: override.platform,
            unitType: override.unitType,
            unitSize: override.unitSize,
            ticketsPerUnitSize: override.ticketsPerUnitSize,
          },
        }),
      ),
    );
  }

  /**
   * Create a new stream giveaway for the authenticated admin user.
   * Business rule: Only one OPEN stream giveaway per admin. Returns error if trying to create OPEN when one already exists.
   */
  async create(userId: string, dto: CreateGiveawayDto): Promise<StreamGiveaway> {
    const status = dto.status || StreamGiveawayStatus.DRAFT;

    // Validate platforms are stream platforms only
    this.validatePlatforms(dto.platforms);

    // Validate keyword is required and not empty
    if (!dto.keyword || dto.keyword.trim().length === 0) {
      throw new BadRequestException('Keyword is required for all stream giveaways');
    }

    // Normalize allowedRoles
    const allowedRoles = this.normalizeAllowedRoles({
      subsOnly: dto.subsOnly,
      nonSubsOnly: dto.nonSubsOnly,
      allowedRoles: dto.allowedRoles,
      platforms: dto.platforms,
    });

    // If creating with OPEN status, check if another OPEN stream giveaway exists
    if (status === StreamGiveawayStatus.OPEN) {
      await this.checkOnlyOneOpenGiveaway(userId);
    }

    // Create stream giveaway with overrides in a transaction
    const streamGiveaway = await this.prisma.$transaction(async (tx) => {
      const created = await tx.streamGiveaway.create({
        data: {
          userId,
          name: dto.name,
          description: dto.description,
          status,
          platforms: dto.platforms,
          keyword: dto.keyword,
          allowedRoles,
        },
      });

      // Create ticket rule overrides if provided
      if (dto.ticketRuleOverrides && dto.ticketRuleOverrides.length > 0) {
        await tx.streamGiveawayTicketRuleOverride.createMany({
          data: dto.ticketRuleOverrides.map((override) => ({
            streamGiveawayId: created.id,
            role: override.role,
            ticketsPerUnit: override.ticketsPerUnit,
          })),
        });
      }

      // Create donation configs if provided
      if (dto.donationConfigs && dto.donationConfigs.length > 0) {
        await tx.streamGiveawayDonationConfig.createMany({
          data: dto.donationConfigs.map((config) => ({
            streamGiveawayId: created.id,
            platform: config.platform,
            unitType: config.unitType,
            donationWindow: config.donationWindow,
          })),
        });
      }

      // Create donation rule overrides if provided
      if (dto.donationRuleOverrides && dto.donationRuleOverrides.length > 0) {
        await tx.streamGiveawayDonationRuleOverride.createMany({
          data: dto.donationRuleOverrides.map((override) => ({
            streamGiveawayId: created.id,
            platform: override.platform,
            unitType: override.unitType,
            unitSize: override.unitSize,
            ticketsPerUnitSize: override.ticketsPerUnitSize,
          })),
        });
      }

      return created;
    });

    // Fetch with relations
    return this.findOne(userId, streamGiveaway.id);
  }

  /**
   * Get all stream giveaways for the authenticated admin user.
   */
  async findAll(userId: string): Promise<StreamGiveaway[]> {
    return this.prisma.streamGiveaway.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        ticketRuleOverrides: true,
        donationRuleOverrides: true,
        donationConfigs: true,
      },
    });
  }

  /**
   * Get a specific stream giveaway by ID, ensuring it belongs to the authenticated admin user.
   * Includes all related data: ticket rule overrides, donation rule overrides, donation configs, and participants.
   */
  async findOne(userId: string, id: string): Promise<StreamGiveaway> {
    const streamGiveaway = await (this.prisma as any).streamGiveaway.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        ticketRuleOverrides: true,
        donationRuleOverrides: true,
        donationConfigs: true,
        participants: {
          orderBy: [
            { createdAt: 'desc' },
            { tickets: 'desc' },
          ],
        },
        winners: {
          include: {
            winnerParticipant: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!streamGiveaway) {
      throw new NotFoundException(`Stream giveaway with ID ${id} not found`);
    }

    return streamGiveaway;
  }

  /**
   * Update a stream giveaway.
   * Business rule: Only one OPEN stream giveaway per admin. Returns error if trying to set OPEN when another already exists.
   */
  async update(userId: string, id: string, dto: UpdateGiveawayDto): Promise<StreamGiveaway> {
    // Ensure the stream giveaway exists and belongs to the user
    const existingStreamGiveaway = await this.findOne(userId, id);

    // Validate platforms if being updated
    const platforms = dto.platforms ?? (existingStreamGiveaway.platforms as ConnectedPlatform[]);
    if (dto.platforms) {
      this.validatePlatforms(dto.platforms);
    }

    // Validate keyword is required and not empty
    const keyword = dto.keyword ?? existingStreamGiveaway.keyword;
    if (!keyword || keyword.trim().length === 0) {
      throw new BadRequestException('Keyword is required for all stream giveaways');
    }

    // Normalize allowedRoles if any role-related fields are being updated
    let allowedRoles = existingStreamGiveaway.allowedRoles as string[];
    if (dto.subsOnly !== undefined || dto.nonSubsOnly !== undefined || dto.allowedRoles !== undefined) {
      allowedRoles = this.normalizeAllowedRoles({
        subsOnly: dto.subsOnly,
        nonSubsOnly: dto.nonSubsOnly,
        allowedRoles: dto.allowedRoles,
        platforms,
      });
    }

    // If updating status to OPEN, check if another OPEN stream giveaway exists
    if (dto.status === StreamGiveawayStatus.OPEN) {
      await this.checkOnlyOneOpenGiveaway(userId, id);
    }

    // Update stream giveaway and overrides in a transaction
    await this.prisma.$transaction(async (tx) => {
      await tx.streamGiveaway.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.platforms !== undefined && { platforms: dto.platforms }),
          ...(dto.keyword !== undefined && { keyword: dto.keyword }),
          ...(allowedRoles !== undefined && { allowedRoles }),
        },
      });

      // Upsert ticket rule overrides if provided
      if (dto.ticketRuleOverrides !== undefined) {
        // Get existing overrides
        const existing = await tx.streamGiveawayTicketRuleOverride.findMany({
          where: { streamGiveawayId: id },
        });

        const existingRoles = new Set(existing.map((o) => o.role));
        const newRoles = new Set(dto.ticketRuleOverrides.map((o) => o.role));

        // Delete overrides that are no longer in the list
        const toDelete = existing.filter((o) => !newRoles.has(o.role));
        if (toDelete.length > 0) {
          await tx.streamGiveawayTicketRuleOverride.deleteMany({
            where: {
              streamGiveawayId: id,
              role: { in: toDelete.map((o) => o.role) },
            },
          });
        }

        // Upsert the new/updated overrides
        await Promise.all(
          dto.ticketRuleOverrides.map((override) =>
            tx.streamGiveawayTicketRuleOverride.upsert({
              where: {
                streamGiveawayId_role: {
                  streamGiveawayId: id,
                  role: override.role,
                },
              },
              update: {
                ticketsPerUnit: override.ticketsPerUnit,
              },
              create: {
                streamGiveawayId: id,
                role: override.role,
                ticketsPerUnit: override.ticketsPerUnit,
              },
            }),
          ),
        );
      }

      // Upsert donation configs if provided
      if (dto.donationConfigs !== undefined) {
        // Get existing configs
        const existing = await tx.streamGiveawayDonationConfig.findMany({
          where: { streamGiveawayId: id },
        });

        const existingKeys = new Set(
          existing.map((c) => `${c.platform}:${c.unitType}`),
        );
        const newKeys = new Set(
          dto.donationConfigs.map((c) => `${c.platform}:${c.unitType}`),
        );

        // Delete configs that are no longer in the list
        const toDelete = existing.filter(
          (c) => !newKeys.has(`${c.platform}:${c.unitType}`),
        );
        if (toDelete.length > 0) {
          await tx.streamGiveawayDonationConfig.deleteMany({
            where: {
              streamGiveawayId: id,
              id: { in: toDelete.map((c) => c.id) },
            },
          });
        }

        // Upsert the new/updated configs
        await Promise.all(
          dto.donationConfigs.map((config) =>
            tx.streamGiveawayDonationConfig.upsert({
              where: {
                streamGiveawayId_platform_unitType: {
                  streamGiveawayId: id,
                  platform: config.platform,
                  unitType: config.unitType,
                },
              },
              update: {
                donationWindow: config.donationWindow,
              },
              create: {
                streamGiveawayId: id,
                platform: config.platform,
                unitType: config.unitType,
                donationWindow: config.donationWindow,
              },
            }),
          ),
        );
      }

      // Upsert donation rule overrides if provided
      if (dto.donationRuleOverrides !== undefined) {
        // Get existing overrides
        const existing = await tx.streamGiveawayDonationRuleOverride.findMany({
          where: { streamGiveawayId: id },
        });

        const existingKeys = new Set(
          existing.map((o: { platform: ConnectedPlatform; unitType: string }) => `${o.platform}:${o.unitType}`),
        );
        const newKeys = new Set(
          dto.donationRuleOverrides.map((o) => `${o.platform}:${o.unitType}`),
        );

        // Delete overrides that are no longer in the list
        const toDelete = existing.filter(
          (o: { platform: ConnectedPlatform; unitType: string }) => !newKeys.has(`${o.platform}:${o.unitType}`),
        );
        if (toDelete.length > 0) {
          await Promise.all(
            toDelete.map((o: { streamGiveawayId: string; platform: ConnectedPlatform; unitType: string }) =>
              tx.streamGiveawayDonationRuleOverride.delete({
                where: {
                  streamGiveawayId_platform_unitType: {
                    streamGiveawayId: o.streamGiveawayId,
                    platform: o.platform,
                    unitType: o.unitType,
                  },
                },
              }),
            ),
          );
        }

        // Upsert the new/updated overrides
        await Promise.all(
          dto.donationRuleOverrides.map((override) =>
            tx.streamGiveawayDonationRuleOverride.upsert({
              where: {
                streamGiveawayId_platform_unitType: {
                  streamGiveawayId: id,
                  platform: override.platform,
                  unitType: override.unitType,
                },
              },
              update: {
                unitSize: override.unitSize,
                ticketsPerUnitSize: override.ticketsPerUnitSize,
              },
              create: {
                streamGiveawayId: id,
                platform: override.platform,
                unitType: override.unitType,
                unitSize: override.unitSize,
                ticketsPerUnitSize: override.ticketsPerUnitSize,
              },
            }),
          ),
        );
      }
    });

    return this.findOne(userId, id);
  }

  /**
   * Business rule: Ensure only one OPEN stream giveaway exists per admin user.
   * Strategy: Return error if trying to create/update to OPEN when another OPEN stream giveaway already exists.
   */
  private async checkOnlyOneOpenGiveaway(userId: string, excludeId?: string): Promise<void> {
    const whereClause: any = {
      userId,
      status: StreamGiveawayStatus.OPEN,
      ...(excludeId && { id: { not: excludeId } }),
    };

    const existingOpenStreamGiveaway = await this.prisma.streamGiveaway.findFirst({
      where: whereClause,
    });

    if (existingOpenStreamGiveaway) {
      throw new BadRequestException(
        `You already have an open stream giveaway (${existingOpenStreamGiveaway.name}). Only one stream giveaway can be OPEN at a time. Please close it first.`,
      );
    }
  }

  /**
   * Calculate tickets for a participant based on stream giveaway rules and ticket configuration.
   * 
   * This method uses:
   * 1. StreamGiveawayTicketRuleOverride if exists (stream giveaway-specific overrides)
   * 2. TicketGlobalRule (default rules for the admin user)
   * 3. TicketGlobalDonationRule / StreamGiveawayDonationRuleOverride for donation-based tickets
   * 
   * Note: The donation window is ignored for now.
   * This will be used when integrating with the actual source of bits/gifts data.
   */
  async calculateTicketsForParticipant(input: {
    streamGiveawayId: string;
    platform: ConnectedPlatform;
    adminUserId: string;
    role: string; // NON_SUB, TWITCH_TIER_1, TWITCH_TIER_2, TWITCH_TIER_3, KICK_SUB, YOUTUBE_SUB
    totalBits?: number; // total de bits válidos para esse stream giveaway
    totalGiftSubs?: number; // total de gift subs válidos para esse stream giveaway
  }): Promise<{
    baseTickets: number;
    bitsTickets: number;
    giftTickets: number;
    totalTickets: number;
  }> {
    // Get stream giveaway with donation configs to check which donation types are enabled
    const streamGiveaway = await this.prisma.streamGiveaway.findFirst({
      where: {
        id: input.streamGiveawayId,
        userId: input.adminUserId,
      },
      include: {
        donationConfigs: true,
      },
    });

    if (!streamGiveaway) {
      throw new NotFoundException(`Stream giveaway with ID ${input.streamGiveawayId} not found`);
    }

    // 1. Calculate base tickets from role (check override first, then global rule)
    let baseTickets = 0;

    // Convert platform-specific NON_SUB (TWITCH_NON_SUB, KICK_NON_SUB, YOUTUBE_NON_SUB) to NON_SUB for database lookup
    let normalizedRole = input.role;
    if (input.role === 'TWITCH_NON_SUB' || input.role === 'KICK_NON_SUB' || input.role === 'YOUTUBE_NON_SUB') {
      normalizedRole = 'NON_SUB';
    }

    // Check for stream giveaway-specific override
    const override = await this.prisma.streamGiveawayTicketRuleOverride.findUnique({
      where: {
        streamGiveawayId_role: {
          streamGiveawayId: input.streamGiveawayId,
          role: input.role, // Use original role for override lookup (overrides use platform-specific format)
        },
      },
    });

    if (override) {
      baseTickets = override.ticketsPerUnit;
    } else {
      // Use global rule (platform is required, use normalized role for database lookup)
      const globalRule = await this.prisma.ticketGlobalRule.findUnique({
        where: {
          userId_platform_role: {
            userId: input.adminUserId,
            platform: input.platform,
            role: normalizedRole, // Use normalized role (NON_SUB) for database lookup
          },
        },
      });

      if (globalRule) {
        baseTickets = globalRule.ticketsPerUnit;
      }
    }

    // 2. Calculate bits tickets (if enabled via donation config)
    let bitsTickets = 0;
    const bitsConfig = streamGiveaway.donationConfigs.find(
      (config) => config.platform === input.platform && config.unitType === 'BITS',
    );
    if (bitsConfig && input.totalBits && input.totalBits > 0) {
      // Check for stream giveaway-specific override first
      const donationOverride = await this.prisma.streamGiveawayDonationRuleOverride.findUnique({
        where: {
          streamGiveawayId_platform_unitType: {
            streamGiveawayId: input.streamGiveawayId,
            platform: input.platform,
            unitType: 'BITS',
          },
        },
      });

      if (donationOverride) {
        bitsTickets = Math.floor(
          (input.totalBits / donationOverride.unitSize) * donationOverride.ticketsPerUnitSize,
        );
      } else {
        // Use global rule
        const bitsRule = await this.prisma.ticketGlobalDonationRule.findUnique({
          where: {
            userId_platform_unitType: {
              userId: input.adminUserId,
              platform: input.platform,
              unitType: 'BITS',
            },
          },
        });

        if (bitsRule) {
          bitsTickets = Math.floor((input.totalBits / bitsRule.unitSize) * bitsRule.ticketsPerUnitSize);
        }
      }
    }

    // 3. Calculate gift sub tickets (if enabled via donation config)
    let giftTickets = 0;
    const giftSubConfig = streamGiveaway.donationConfigs.find(
      (config) => config.platform === input.platform && config.unitType === 'GIFT_SUB',
    );
    if (giftSubConfig && input.totalGiftSubs && input.totalGiftSubs > 0) {
      // Check for stream giveaway-specific override first
      const donationOverride = await this.prisma.streamGiveawayDonationRuleOverride.findUnique({
        where: {
          streamGiveawayId_platform_unitType: {
            streamGiveawayId: input.streamGiveawayId,
            platform: input.platform,
            unitType: 'GIFT_SUB',
          },
        },
      });

      if (donationOverride) {
        giftTickets = Math.floor(
          (input.totalGiftSubs / donationOverride.unitSize) * donationOverride.ticketsPerUnitSize,
        );
      } else {
        // Use global rule
        const giftRule = await this.prisma.ticketGlobalDonationRule.findUnique({
          where: {
            userId_platform_unitType: {
              userId: input.adminUserId,
              platform: input.platform,
              unitType: 'GIFT_SUB',
            },
          },
        });

        if (giftRule) {
          giftTickets = Math.floor((input.totalGiftSubs / giftRule.unitSize) * giftRule.ticketsPerUnitSize);
        }
      }
    }

    // For now, return only baseTickets as total (bits and gift tickets are calculated but not included)
    // TODO: Include bitsTickets and giftTickets in totalTickets when donation windows are properly integrated
    const totalTickets = baseTickets;

    return {
      baseTickets,
      bitsTickets,
      giftTickets,
      totalTickets,
    };
  }

  /**
   * Delete a stream giveaway.
   * Ensures the stream giveaway belongs to the authenticated admin user.
   * Related data (participants, configs, overrides) will be deleted automatically via cascade.
   */
  async remove(userId: string, id: string): Promise<void> {
    // Ensure the stream giveaway exists and belongs to the user
    const streamGiveaway = await this.findOne(userId, id);

    // Delete the stream giveaway (cascade will handle related records)
    await this.prisma.streamGiveaway.delete({
      where: { id: streamGiveaway.id },
    });
  }

  /**
   * Add a single participant entry to a stream giveaway.
   * Allows multiple entries per user with different methods.
   * Only allowed when status is OPEN.
   */
  async addParticipant(
    userId: string,
    streamGiveawayId: string,
    dto: CreateParticipantDto,
  ): Promise<StreamGiveawayParticipant> {
    // Ensure the stream giveaway exists and belongs to the user
    const streamGiveaway = await this.findOne(userId, streamGiveawayId);
    
    // Only allow adding participants when status is OPEN
    if (streamGiveaway.status !== StreamGiveawayStatus.OPEN) {
      throw new BadRequestException('Can only add participants when giveaway status is OPEN');
    }

    // Create the participant entry
    return this.prisma.streamGiveawayParticipant.create({
      data: {
        streamGiveawayId,
        platform: dto.platform,
        externalUserId: dto.externalUserId,
        username: dto.username,
        avatarUrl: dto.avatarUrl || undefined,
        method: dto.method,
        tickets: dto.tickets,
        metadata: dto.metadata || undefined,
      },
    });
  }

  /**
   * Add multiple participant entries to a stream giveaway in batch.
   * Allows multiple entries per user with different methods.
   * Only allowed when status is OPEN.
   */
  async addParticipantsBatch(
    userId: string,
    streamGiveawayId: string,
    dto: CreateParticipantsBatchDto,
  ): Promise<StreamGiveawayParticipant[]> {
    // Ensure the stream giveaway exists and belongs to the user
    const streamGiveaway = await this.findOne(userId, streamGiveawayId);
    
    // Only allow adding participants when status is OPEN
    if (streamGiveaway.status !== StreamGiveawayStatus.OPEN) {
      throw new BadRequestException('Can only add participants when giveaway status is OPEN');
    }

    // Create all participant entries in a transaction
    return this.prisma.$transaction(
      dto.participants.map((participant) =>
        this.prisma.streamGiveawayParticipant.create({
          data: {
            streamGiveawayId,
            platform: participant.platform,
            externalUserId: participant.externalUserId,
            username: participant.username,
            avatarUrl: participant.avatarUrl || undefined,
            method: participant.method,
            tickets: participant.tickets,
            metadata: participant.metadata || undefined,
          },
        }),
      ),
    );
  }

  /**
   * Get all participants for a stream giveaway.
   */
  async getParticipants(
    userId: string,
    streamGiveawayId: string,
  ): Promise<StreamGiveawayParticipant[]> {
    // Ensure the stream giveaway exists and belongs to the user
    await this.findOne(userId, streamGiveawayId);

    return this.prisma.streamGiveawayParticipant.findMany({
      where: { streamGiveawayId },
      orderBy: [
        { createdAt: 'desc' },
        { tickets: 'desc' },
      ],
    });
  }

  /**
   * Draw a winner from a stream giveaway using Random.org Signed API.
   * 
   * Steps:
   * 1. Fetch all participants ordered by creation/ID
   * 2. Calculate ticket ranges (start, end) for each participant
   * 3. Generate hash of the participant list
   * 4. Call Random.org to get a random number
   * 5. Find winner using binary search
   * 6. Verify Random.org signature (optional)
   * 7. Return audit payload
   */
  async draw(userId: string, streamGiveawayId: string): Promise<DrawResponseDto> {
    // Ensure the stream giveaway exists and belongs to the user
    const streamGiveaway = await this.findOne(userId, streamGiveawayId);
    
    // Only allow drawing when status is OPEN (first draw) or DONE (repick)
    if (streamGiveaway.status !== StreamGiveawayStatus.OPEN && streamGiveaway.status !== 'DONE' as any) {
      throw new BadRequestException('Can only draw winners when giveaway status is OPEN or DONE');
    }

    // If this is a repick (status is DONE), mark current winner as REPICK first
    if (streamGiveaway.status === 'DONE' as any) {
      await (this.prisma as any).streamGiveawayWinner.updateMany({
        where: {
          streamGiveawayId,
          status: 'WINNER' as any,
        },
        data: {
          status: 'REPICK' as any,
        },
      });
    }

    // Fetch all participants ordered by creation date (or ID as fallback)
    // Exclude participants that have been repicked (have a winner entry with status REPICK)
    const repickedWinners = await (this.prisma as any).streamGiveawayWinner.findMany({
      where: {
        streamGiveawayId,
        status: 'REPICK' as any,
      },
      select: {
        winnerParticipantId: true,
      },
    });

    const repickedParticipantIds = new Set(repickedWinners.map((w: any) => w.winnerParticipantId));

    const allParticipants = await this.prisma.streamGiveawayParticipant.findMany({
      where: { streamGiveawayId },
      orderBy: [
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
    });

    // Filter out repicked participants
    const participants = allParticipants.filter((p) => !repickedParticipantIds.has(p.id));

    if (participants.length === 0) {
      throw new BadRequestException('Cannot draw winner: no eligible participants found (all have been repicked)');
    }

    // Calculate ticket ranges - ensure repicked participants are not included
    const ranges: Array<{ id: string; display: string; start: number; end: number }> = [];
    let start = 0;

    for (const participant of participants) {
      // Double check: skip if this participant is repicked
      if (repickedParticipantIds.has(participant.id)) {
        continue;
      }

      const display = `${participant.username}|${participant.method}`;
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

    const randomResult = await this.callRandomOrg(randomOrgApiKey, totalTickets);
    const drawnNumber = randomResult.random.data[0];
    const randomPayload = randomResult.random;
    const signature = randomResult.signature;

    // Verify signature (optional but recommended)
    const verified = await this.verifyRandomOrgSignature(randomPayload, signature);

    // Find winner using binary search
    const winner = this.findWinnerByBinarySearch(ranges, drawnNumber);

    // Generate Random.org verification URL
    const verificationUrl = this.generateRandomOrgVerificationUrl(randomPayload, signature);

    // Check if this is the first draw (no previous winners and status is OPEN)
    const previousWinners = await (this.prisma as any).streamGiveawayWinner.findMany({
      where: { streamGiveawayId },
    });

    const isFirstDraw = previousWinners.length === 0 && streamGiveaway.status === StreamGiveawayStatus.OPEN;

    // Save new winner to database
    await (this.prisma as any).streamGiveawayWinner.create({
      data: {
        streamGiveawayId,
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

    // If this is the first draw, change status from OPEN to DONE
    if (isFirstDraw) {
      await this.prisma.streamGiveaway.update({
        where: { id: streamGiveawayId },
        data: { status: 'DONE' as any },
      });
    }

    // Return audit payload
    return {
      ticket: streamGiveawayId,
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
   * Format: https://api.random.org/signatures/form?format=json&random=<base64>&signature=<url_encoded>
   */
  private generateRandomOrgVerificationUrl(random: any, signature: string): string {
    // Encode random payload as base64
    const randomJson = JSON.stringify(random);
    const randomBase64 = Buffer.from(randomJson).toString('base64');

    // URL encode the signature
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
    // Default to SHA-256
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Call Random.org Signed API to generate a random integer.
   */
  private async callRandomOrg(apiKey: string, max: number): Promise<{
    random: any;
    signature: string;
  }> {
    const requestBody = {
      jsonrpc: '2.0',
      method: 'generateSignedIntegers',
      params: {
        apiKey,
        n: 1,
        min: 0,
        max: max - 1,
        replacement: true,
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
      // If verification fails, return false but don't throw
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

    // This should never happen if ranges are correct, but throw error as fallback
    throw new BadRequestException(`Could not find winner for ticket index ${ticketIndex}`);
  }
}
