import { Injectable } from '@nestjs/common';
import { verifyJwt } from '../utils/jwt.util';
import { envs } from '../../config/envs';

@Injectable()
export class JwtStrategy {
  validate(token: string) {
    return verifyJwt(token, envs.jwtSecret);
  }
}
