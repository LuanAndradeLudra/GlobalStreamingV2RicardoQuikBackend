/**
 * Helper functions for calculating date ranges for giveaways
 * Follows Brazil timezone (America/Sao_Paulo) for consistency with Event table
 */

export class DateRangeHelper {
  /**
   * Get start and end dates for DAILY period
   * Returns: Start of current day (00:00) to start of next day (00:00) in Brazil timezone
   */
  static getDailyRange(): { start: Date; end: Date } {
    const now = new Date();
    
    // Start of current day in Brazil (00:00:00)
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    
    // Start of next day in Brazil (00:00:00)
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    
    return { start, end };
  }

  /**
   * Get start and end dates for WEEKLY period
   * According to Twitch spec: "A week spans from 00:00:00 on the Monday of the week 
   * specified in started_at and runs through 00:00:00 of the next Monday"
   * 
   * Returns: Monday 00:00 of current week to Monday 00:00 of next week (Brazil timezone)
   */
  static getWeeklyRange(): { start: Date; end: Date } {
    const now = new Date();
    
    // Get current day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const dayOfWeek = now.getDay();
    
    // Calculate days to subtract to get to Monday
    // If Sunday (0), go back 6 days; otherwise go back (dayOfWeek - 1) days
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    // Start of current week (Monday 00:00:00)
    const start = new Date(now);
    start.setDate(start.getDate() - daysToMonday);
    start.setHours(0, 0, 0, 0);
    
    // Start of next week (next Monday 00:00:00)
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    
    return { start, end };
  }

  /**
   * Get start and end dates for MONTHLY period
   * Returns: First day of current month (00:00) to first day of next month (00:00) in Brazil timezone
   */
  static getMonthlyRange(): { start: Date; end: Date } {
    const now = new Date();
    
    // Start of current month (day 1, 00:00:00)
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    
    // Start of next month (day 1, 00:00:00)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
    
    return { start, end };
  }

  /**
   * Format date for PostgreSQL query with Brazil timezone
   * Returns ISO string that can be used in SQL queries
   */
  static formatForPostgres(date: Date): string {
    return date.toISOString();
  }

  /**
   * Get SQL WHERE clause for date range filtering
   * Uses the Event.eventDate field with Brazil timezone handling
   */
  static getEventDateWhereClause(
    period: 'DAILY' | 'WEEKLY' | 'MONTHLY',
    fieldName: string = 'eventDate',
  ): { start: Date; end: Date; sql: string } {
    let range: { start: Date; end: Date };
    
    switch (period) {
      case 'DAILY':
        range = this.getDailyRange();
        break;
      case 'WEEKLY':
        range = this.getWeeklyRange();
        break;
      case 'MONTHLY':
        range = this.getMonthlyRange();
        break;
      default:
        throw new Error(`Invalid period: ${period}`);
    }
    
    return {
      start: range.start,
      end: range.end,
      sql: `"${fieldName}" >= '${this.formatForPostgres(range.start)}' AND "${fieldName}" < '${this.formatForPostgres(range.end)}'`,
    };
  }

  /**
   * Log current date range for debugging
   */
  static logDateRange(period: string, start: Date, end: Date): void {
    console.log(`📅 [${period}] Date Range:`);
    console.log(`   Start: ${start.toISOString()} (${start.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} BRT)`);
    console.log(`   End: ${end.toISOString()} (${end.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} BRT)`);
  }
}

