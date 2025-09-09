import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { PaginasService } from './paginas.service';
import { CreatePaginaDto } from './dto/create-pagina.dto';
import { UpdatePaginaDto } from './dto/update-pagina.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller({ path: 'paginas', version: '1' })
export class PaginasController {
  constructor(private readonly paginasService: PaginasService) {}

  @Get()
  findAll(@Query('all') all = '0') {
    return this.paginasService.findAll(all === '1');
  }

  @Post()
  create(@Body() dto: CreatePaginaDto) {
    return this.paginasService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePaginaDto) {
    return this.paginasService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.paginasService.remove(id);
  }

  @Patch(':id/restore')
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.paginasService.restore(id);
  }
}
