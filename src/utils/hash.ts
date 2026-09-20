import bcrypt from 'bcrypt';
import { env } from '../config/env';

/**
 * Password hashing utility using bcrypt.
 * Provides secure password hashing and comparison.
 */
export class HashUtils {
  /**
   * Hash a plain text string.
   *
   * @param data - Plain text to hash
   * @returns Hashed string
   *
   * @example
   * const hashedPassword = await HashUtils.hash('mypassword123');
   */
  static async hash(data: string): Promise<string> {
    const saltRounds = env.BCRYPT_ROUNDS;
    return bcrypt.hash(data, saltRounds);
  }

  /**
   * Compare plain text with a hash.
   *
   * @param data - Plain text to compare
   * @param hashed - Hashed string to compare against
   * @returns true if match, false otherwise
   *
   * @example
   * const isValid = await HashUtils.compare('mypassword123', hashedPassword);
   */
  static async compare(data: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(data, hashed);
  }

  /**
   * Check if a string is a valid bcrypt hash format.
   *
   * @param data - String to check
   * @returns true if valid bcrypt hash format
   */
  static isBcryptHash(data: string): boolean {
    return /^\$2[abxy]?\$\d{1,2}\$/.test(data);
  }
}
