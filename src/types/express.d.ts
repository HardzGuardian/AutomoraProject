import { UserPayload } from './index';

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
      rawBody?: Buffer;
    }
  }
}

export {};
