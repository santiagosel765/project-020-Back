import { Request, Response, NextFunction } from 'express';
import * as cookie from 'cookie';

export function cookieParser(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.cookie;
  (req as any).cookies = header ? cookie.parse(header) : {};
  next();
}
