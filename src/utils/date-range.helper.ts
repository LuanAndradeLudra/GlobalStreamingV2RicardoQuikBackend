/**
 * Helper functions for calculating date ranges for giveaways
 * Follows Brazil timezone (America/Sao_Paulo) for consistency with Event table
 */

export class DateRangeHelper {
  /**
   * Get start and end dates for DAILY period
   * Returns: Start of current day (03:00) to start of next day (03:00) in Brazil timezone
   * 03:00 no Brasil = 06:00 UTC (UTC-3)
   */
  static getDailyRange(): { start: Date; end: Date } {
    const now = new Date();
    
    // Obtém componentes da data/hora atual no Brasil
    const brazilFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    
    const parts = brazilFormatter.formatToParts(now);
    const brazilYear = parseInt(parts.find(p => p.type === 'year')?.value || '0');
    const brazilMonth = parseInt(parts.find(p => p.type === 'month')?.value || '0') - 1; // Month is 0-indexed
    const brazilDay = parseInt(parts.find(p => p.type === 'day')?.value || '0');
    const brazilHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    
    // Se for >= 03:00 no Brasil, o dia atual começa às 03:00 de hoje
    // Se for < 03:00 no Brasil, o dia atual começa às 03:00 de ontem
    let startYear = brazilYear;
    let startMonth = brazilMonth;
    let startDay = brazilDay;
    
    if (brazilHour < 3) {
      // Ainda estamos no período que começou às 03:00 de ontem
      const yesterday = new Date(Date.UTC(brazilYear, brazilMonth, brazilDay));
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      startYear = yesterday.getUTCFullYear();
      startMonth = yesterday.getUTCMonth();
      startDay = yesterday.getUTCDate();
    }
    
    // Cria data UTC: 03:00 no Brasil = 06:00 UTC (UTC-3)
    const start = new Date(Date.UTC(startYear, startMonth, startDay, 6, 0, 0, 0));
    
    // End é 24 horas depois (03:00 do dia seguinte no Brasil)
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    
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

