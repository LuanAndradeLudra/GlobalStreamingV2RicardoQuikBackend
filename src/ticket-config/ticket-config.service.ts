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
   * These rules define how many tickets each user role/tier receives.
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
   * These rules define how many units (bits, coins, etc.) equal one ticket.
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
          unitsPerTicket: rule.unitsPerTicket,
        },
        create: {
          userId,
          platform: rule.platform,
          unitType: rule.unitType,
          unitsPerTicket: rule.unitsPerTicket,
        },
      }),
    );

    return Promise.all(upsertPromises);
  }
}

