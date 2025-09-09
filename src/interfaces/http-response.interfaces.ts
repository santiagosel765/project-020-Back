import { HttpStatus } from '@nestjs/common';

export interface HttpResponse<T = any> {
  status: HttpStatus;
  data: T;
}