import { Module } from '@nestjs/common';
import { PaginasService } from './paginas.service';
import { PaginasController } from './paginas.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PaginasController],
  providers: [PaginasService],
})
export class PaginasModule {}
