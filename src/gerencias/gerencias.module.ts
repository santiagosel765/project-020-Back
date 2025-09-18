import { Module } from '@nestjs/common';
import { GerenciasService } from './gerencias.service';
import { GerenciasController } from './gerencias.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [GerenciasController],
  providers: [GerenciasService],
})
export class GerenciasModule {}
