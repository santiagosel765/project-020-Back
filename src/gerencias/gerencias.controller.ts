import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GerenciasService } from './gerencias.service';

@UseGuards(JwtAuthGuard)
@Controller({ path: 'gerencias', version: '1' })
export class GerenciasController {
  constructor(private readonly gerenciasService: GerenciasService) {}

  @Get()
  findAll(@Query('all') all = '0') {
    return this.gerenciasService.findAll(all === '1');
  }
}
