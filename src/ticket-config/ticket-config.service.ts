import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketGlobalRuleDto } from './dto/create-ticket-global-rule.dto';
import { CreateTicketGlobalDonationRuleDto } from './dto/create-ticket-global-donation-rule.dto';
import { TicketGlobalRule, TicketGlobalDonationRule } from '@prisma/client';

@Injectable()
export class TicketConfigService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all global ticket rules and donation rules for a user.
   * These rules serve as defaults for all giveaways.
   * 
   * Global ticket rules define tickets based on the user's base subscription status.
   * Donation rules define extra ticket increments based on quantity of bits/coins/gifts.
   */
  async getGlobalConfig(userId: string): Promise<{
    rules: { platform: string; role: string; ticketsPerUnit: number }[];
    donationRules: {
      platform: string;
      unitType: string;
      unitSize: number;
      ticketsPerUnitSize: number;
    }[];
  }> {
    const [rules, donationRules] = await Promise.all([
      this.prisma.ticketGlobalRule.findMany({
        where: { userId },
        orderBy: [{ platform: 'asc' }, { role: 'asc' }],
      }),
      this.prisma.ticketGlobalDonationRule.findMany({
        where: { userId },
        orderBy: [{ platform: 'asc' }, { unitType: 'asc' }],
      }),
    ]);

    return {
      rules: rules.map((r) => ({
        platform: r.platform,
        // Transform NON_SUB + platform to platform-specific format (TWITCH_NON_SUB, KICK_NON_SUB, YOUTUBE_NON_SUB)
        role: r.role === 'NON_SUB' ? `${r.platform}_NON_SUB` : r.role,
        ticketsPerUnit: r.ticketsPerUnit,
      })),
      donationRules: donationRules.map((dr) => ({
        platform: dr.platform,
        unitType: dr.unitType,
        unitSize: dr.unitSize,
        ticketsPerUnitSize: dr.ticketsPerUnitSize,
      })),
    };
  }

  /**
   * Upsert (create or update) global ticket rules for a user.
   * These rules define tickets based on the user's base subscription status.
   * Roles represent the "base state" of the user: non-sub, twitch tier, kick sub, youtube sub.
   * Gift subs are handled in TicketGlobalDonationRule, not here.
   * These are default rules applied to all giveaways.
   * 
   * Accepts platform-specific NON_SUB formats (TWITCH_NON_SUB, KICK_NON_SUB, YOUTUBE_NON_SUB)
   * and converts them to NON_SUB + platform for storage.
   */
  async upsertGlobalRules(
    userId: string,
    rules: CreateTicketGlobalRuleDto[],
  ): Promise<TicketGlobalRule[]> {
    const upsertPromises = rules.map((rule) => {
      // Convert platform-specific NON_SUB (TWITCH_NON_SUB, KICK_NON_SUB, YOUTUBE_NON_SUB) to NON_SUB
      // The platform is already specified in rule.platform
      let normalizedRole = rule.role;
      if (rule.role === 'TWITCH_NON_SUB' || rule.role === 'KICK_NON_SUB' || rule.role === 'YOUTUBE_NON_SUB') {
        normalizedRole = 'NON_SUB';
      }

      return this.prisma.ticketGlobalRule.upsert({
        where: {
          userId_platform_role: {
            userId,
            platform: rule.platform,
            role: normalizedRole,
          },
        },
        update: {
          ticketsPerUnit: rule.ticketsPerUnit,
        },
        create: {
          userId,
          platform: rule.platform,
          role: normalizedRole,
          ticketsPerUnit: rule.ticketsPerUnit,
        },
      });
    });

    return Promise.all(upsertPromises);
  }

  /**
   * Upsert (create or update) global donation rules for a user.
   * These rules define extra ticket increments based on quantity of bits/coins/gifts.
   * Time window (daily/weekly/monthly) is not defined here; it will be set per giveaway.
   * Examples:
   *   - Bits: unitType="BITS", unitSize=100, ticketsPerUnitSize=1 → 100 bits = 1 ticket
   *   - Gift subs: unitType="GIFT_SUB", unitSize=1, ticketsPerUnitSize=4 → 1 gift = 4 tickets
   * These are default rules applied to all giveaways.
   */
  async upsertGlobalDonationRules(
    userId: string,
    donationRules: CreateTicketGlobalDonationRuleDto[],
  ): Promise<TicketGlobalDonationRule[]> {
    const upsertPromises = donationRules.map((rule) =>
      this.prisma.ticketGlobalDonationRule.upsert({
        where: {
          userId_platform_unitType: {
            userId,
            platform: rule.platform,
            unitType: rule.unitType,
          },
        },
        update: {
          unitSize: rule.unitSize,
          ticketsPerUnitSize: rule.ticketsPerUnitSize,
        },
        create: {
          userId,
          platform: rule.platform,
          unitType: rule.unitType,
          unitSize: rule.unitSize,
          ticketsPerUnitSize: rule.ticketsPerUnitSize,
        },
      }),
    );

    return Promise.all(upsertPromises);
  }
}

