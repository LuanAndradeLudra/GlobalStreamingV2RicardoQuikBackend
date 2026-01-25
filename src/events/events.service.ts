import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DateRangeHelper } from '../utils/date-range.helper';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get daily Kick Coins leaderboard from Event table
   * Returns users who donated Kick Coins today, grouped and summed
   */
  async getKickCoinsDaily(userId: string) {
    const { start, end } = DateRangeHelper.getDailyRange();

    console.log(`📅 [Events API] Fetching daily Kick Coins`);
    DateRangeHelper.logDateRange('DAILY', start, end);

    const results = await this.prisma.event.groupBy({
      by: ['externalUserId', 'username'],
      where: {
        platform: 'KICK',
        eventType: 'KICK_COINS',
        eventDate: {
          gte: start,
          lt: end,
        },
      },
      _sum: {
        amount: true,
      },
      orderBy: {
        _sum: {
          amount: 'desc',
        },
      },
    });

    // Transform to match Kick API format
    const data = results.map((result, index) => ({
      user_id: parseInt(result.externalUserId),
      username: result.username,
      gifted_amount: result._sum.amount || 0,
      rank: index + 1,
    }));

    console.log(`✅ [Events API] Found ${data.length} participants with Kick Coins today`);

    return {
      data,
      message: 'Daily Kick Coins leaderboard from database',
    };
  }

  /**
   * Get weekly Kick Coins leaderboard from Event table
   * Returns users who donated Kick Coins this week, grouped and summed
   */
  async getKickCoinsWeekly(userId: string) {
    const { start, end } = DateRangeHelper.getWeeklyRange();

    console.log(`📅 [Events API] Fetching weekly Kick Coins`);
    DateRangeHelper.logDateRange('WEEKLY', start, end);

    const results = await this.prisma.event.groupBy({
      by: ['externalUserId', 'username'],
      where: {
        platform: 'KICK',
        eventType: 'KICK_COINS',
        eventDate: {
          gte: start,
          lt: end,
        },
      },
      _sum: {
        amount: true,
      },
      orderBy: {
        _sum: {
          amount: 'desc',
        },
      },
    });

    const data = results.map((result, index) => ({
      user_id: parseInt(result.externalUserId),
      username: result.username,
      gifted_amount: result._sum.amount || 0,
      rank: index + 1,
    }));

    console.log(`✅ [Events API] Found ${data.length} participants with Kick Coins this week`);

    return {
      data,
      message: 'Weekly Kick Coins leaderboard from database',
    };
  }

  /**
   * Get monthly Kick Coins leaderboard from Event table
   * Returns users who donated Kick Coins this month, grouped and summed
   */
  async getKickCoinsMonthly(userId: string) {
    const { start, end } = DateRangeHelper.getMonthlyRange();

    console.log(`📅 [Events API] Fetching monthly Kick Coins`);
    DateRangeHelper.logDateRange('MONTHLY', start, end);

    const results = await this.prisma.event.groupBy({
      by: ['externalUserId', 'username'],
      where: {
        platform: 'KICK',
        eventType: 'KICK_COINS',
        eventDate: {
          gte: start,
          lt: end,
        },
      },
      _sum: {
        amount: true,
      },
      orderBy: {
        _sum: {
          amount: 'desc',
        },
      },
    });

    const data = results.map((result, index) => ({
      user_id: parseInt(result.externalUserId),
      username: result.username,
      gifted_amount: result._sum.amount || 0,
      rank: index + 1,
    }));

    console.log(`✅ [Events API] Found ${data.length} participants with Kick Coins this month`);

    return {
      data,
      message: 'Monthly Kick Coins leaderboard from database',
    };
  }
}

