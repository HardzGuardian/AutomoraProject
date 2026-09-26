import bcrypt from 'bcrypt';
import { env } from '../config/env';

export class HashUtils {
  static async hash(data: string): Promise<string> {
    const saltRounds = env.BCRYPT_ROUNDS;
    return bcrypt.hash(data, saltRounds);
  }

  static async compare(data: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(data, hashed);
  }

  static isBcryptHash(data: string): boolean {
    return /^\$2[abxy]?\$\d{1,2}\$/.test(data);
  }
}
