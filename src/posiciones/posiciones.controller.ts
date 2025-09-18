import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PosicionesService } from './posiciones.service';

@UseGuards(JwtAuthGuard)
@Controller({ path: 'posiciones', version: '1' })
export class PosicionesController {
  constructor(private readonly posicionesService: PosicionesService) {}

  @Get()
  findAll(@Query('all') all = '0') {
    return this.posicionesService.findAll(all === '1');
  }
}
