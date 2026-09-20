/**
 * Date utility functions for consistent date handling.
 * All dates should be handled in UTC to avoid timezone issues.
 */
export class DateHelpers {
  /**
   * Add days to a date.
   *
   * @param date - Starting date
   * @param days - Number of days to add
   * @returns New date with days added
   */
  static addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * Add hours to a date.
   *
   * @param date - Starting date
   * @param hours - Number of hours to add
   * @returns New date with hours added
   */
  static addHours(date: Date, hours: number): Date {
    const result = new Date(date);
    result.setHours(result.getHours() + hours);
    return result;
  }

  /**
   * Add minutes to a date.
   *
   * @param date - Starting date
   * @param minutes - Number of minutes to add
   * @returns New date with minutes added
   */
  static addMinutes(date: Date, minutes: number): Date {
    const result = new Date(date);
    result.setMinutes(result.getMinutes() + minutes);
    return result;
  }

  /**
   * Check if a date has passed.
   *
   * @param date - Date to check
   * @returns true if date is in the past
   */
  static isExpired(date: Date): boolean {
    return new Date() > date;
  }

  /**
   * Check if a date is within a given timeframe from now.
   *
   * @param date - Date to check
   * @param minutes - Timeframe in minutes
   * @returns true if date is within the timeframe
   */
  static isWithinMinutes(date: Date, minutes: number): boolean {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = diffMs / (1000 * 60);
    return diffMinutes <= minutes;
  }

  /**
   * Get the difference between two dates in days.
   *
   * @param date1 - First date
   * @param date2 - Second date
   * @returns Difference in days
   */
  static differenceInDays(date1: Date, date2: Date): number {
    const diffMs = Math.abs(date2.getTime() - date1.getTime());
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Format a date as ISO string.
   *
   * @param date - Date to format
   * @returns ISO formatted string
   */
  static toISOString(date: Date): string {
    return date.toISOString();
  }

  /**
   * Format a date for display.
   *
   * @param date - Date to format
   * @param options - Intl.DateTimeFormat options
   * @returns Formatted date string
   */
  static formatDate(
    date: Date,
    options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }
  ): string {
    return new Intl.DateTimeFormat('en-US', options).format(date);
  }

  /**
   * Get current date/time in UTC.
   *
   * @returns Current date in UTC
   */
  static now(): Date {
    return new Date();
  }

  /**
   * Create a date from ISO string.
   *
   * @param isoString - ISO date string
   * @returns Date object
   */
  static fromISOString(isoString: string): Date {
    return new Date(isoString);
  }

  /**
   * Parse a date string safely, returning null if invalid.
   *
   * @param dateString - Date string to parse
   * @returns Date object or null if invalid
   */
  static safeParse(dateString: string): Date | null {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  }

  /**
   * Get start of day (00:00:00) for a given date.
   *
   * @param date - Date to get start of day for
   * @returns Date at start of day
   */
  static startOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  /**
   * Get end of day (23:59:59.999) for a given date.
   *
   * @param date - Date to get end of day for
   * @returns Date at end of day
   */
  static endOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
  }
}
