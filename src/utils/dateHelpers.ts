export class DateHelpers {
  static addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  static addHours(date: Date, hours: number): Date {
    const result = new Date(date);
    result.setHours(result.getHours() + hours);
    return result;
  }

  static addMinutes(date: Date, minutes: number): Date {
    const result = new Date(date);
    result.setMinutes(result.getMinutes() + minutes);
    return result;
  }

  static isExpired(date: Date): boolean {
    return new Date() > date;
  }

  static isWithinMinutes(date: Date, minutes: number): boolean {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = diffMs / (1000 * 60);
    return diffMinutes <= minutes;
  }

  /** Whole days between the two dates, regardless of order. */
  static differenceInDays(date1: Date, date2: Date): number {
    const diffMs = Math.abs(date2.getTime() - date1.getTime());
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  static toISOString(date: Date): string {
    return date.toISOString();
  }

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

  static now(): Date {
    return new Date();
  }

  static fromISOString(isoString: string): Date {
    return new Date(isoString);
  }

  /** Returns null instead of an Invalid Date. */
  static safeParse(dateString: string): Date | null {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  }

  static startOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  static endOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
  }
}
