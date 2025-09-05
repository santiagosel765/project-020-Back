import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  signup() {
    return 'signup action';
  }

  login() {
    return `login action`;
  }

  refreshToken() {
    return `refreshToken action`;
  }

}
