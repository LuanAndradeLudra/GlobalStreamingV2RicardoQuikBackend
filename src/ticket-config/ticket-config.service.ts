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
   * NON_SUB must be platform-specific (e.g., NON_SUB for Twitch, NON_SUB for Kick).
   * Donation rules define extra ticket increments based on quantity of bits/coins/gifts.
   */
  async getGlobalConfig(userId: string): Promise<{
    rules: TicketGlobalRule[];
    donationRules: TicketGlobalDonationRule[];
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

    return { rules, donationRules };
  }

  /**
   * Upsert (create or update) global ticket rules for a user.
   * These rules define tickets based on the user's base subscription status.
   * Roles represent the "base state" of the user: non-sub, twitch tier, kick sub, youtube sub.
   * NON_SUB must be platform-specific (e.g., NON_SUB for Twitch, NON_SUB for Kick).
   * Gift subs are handled in TicketGlobalDonationRule, not here.
   * These are default rules applied to all giveaways.
   */
  async upsertGlobalRules(
    userId: string,
    rules: CreateTicketGlobalRuleDto[],
  ): Promise<TicketGlobalRule[]> {
    const upsertPromises = rules.map((rule) =>
      this.prisma.ticketGlobalRule.upsert({
        where: {
          userId_platform_role: {
            userId,
            platform: rule.platform,
            role: rule.role,
          },
        },
        update: {
          ticketsPerUnit: rule.ticketsPerUnit,
        },
        create: {
          userId,
          platform: rule.platform,
          role: rule.role,
          ticketsPerUnit: rule.ticketsPerUnit,
        },
      }),
    );

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

