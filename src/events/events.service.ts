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

  /**
   * Get daily Twitch Gift Subs leaderboard from Event table
   * Returns gifters who gifted subs today, grouped and summed
   */
  async getTwitchGiftSubsDaily(userId: string) {
    const { start, end } = DateRangeHelper.getDailyRange();

    console.log(`📅 [Events API] Fetching daily Twitch Gift Subs`);
    DateRangeHelper.logDateRange('DAILY', start, end);

    const results = await this.prisma.event.groupBy({
      by: ['externalUserId', 'username'],
      where: {
        userId,
        platform: 'TWITCH',
        eventType: 'GIFT_SUBSCRIPTION',
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

    // Transform to match API format
    const data = results.map((result, index) => ({
      user_id: result.externalUserId,
      user_login: result.username.toLowerCase(),
      user_name: result.username,
      rank: index + 1,
      score: result._sum.amount || 0,
    }));

    console.log(`✅ [Events API] Found ${data.length} Twitch gifters today`);

    return {
      data,
      message: 'Daily Twitch Gift Subs leaderboard from database',
    };
  }

  /**
   * Get daily Kick Gift Subs leaderboard from Event table
   * Returns gifters who gifted subs today, grouped and summed
   */
  async getKickGiftSubsDaily(userId: string) {
    const { start, end } = DateRangeHelper.getDailyRange();

    console.log(`📅 [Events API] Fetching daily Kick Gift Subs`);
    DateRangeHelper.logDateRange('DAILY', start, end);

    // For Kick, we get the GIFT_SUBSCRIPTION events which contain gifter info
    const events = await this.prisma.event.findMany({
      where: {
        userId,
        platform: 'KICK',
        eventType: 'GIFT_SUBSCRIPTION',
        eventDate: {
          gte: start,
          lt: end,
        },
      },
      select: {
        externalUserId: true,
        username: true,
        amount: true,
        metadata: true,
      },
    });

    // Group by gifter (externalUserId + username)
    const gifterMap = new Map<string, { userId: number; username: string; totalGifts: number }>();

    events.forEach((event) => {
      const key = event.externalUserId;
      if (!gifterMap.has(key)) {
        gifterMap.set(key, {
          userId: parseInt(event.externalUserId),
          username: event.username,
          totalGifts: 0,
        });
      }
      const gifter = gifterMap.get(key)!;
      gifter.totalGifts += event.amount || 1; // amount should be the number of gifts
    });

    // Convert to array and sort by totalGifts desc
    const data = Array.from(gifterMap.values())
      .sort((a, b) => b.totalGifts - a.totalGifts)
      .map((gifter, index) => ({
        user_id: gifter.userId,
        username: gifter.username,
        gifted_amount: gifter.totalGifts,
        rank: index + 1,
      }));

    console.log(`✅ [Events API] Found ${data.length} Kick gifters today`);

    return {
      gifters: data,
      message: 'Daily Kick Gift Subs leaderboard from database',
    };
  }
}

