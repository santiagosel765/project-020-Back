import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmpresasService } from './empresas.service';
import {
  EmpresaListItemDto,
  FindEmpresasQueryDto,
  FindEmpresasResponseDto,
} from './dto/find-empresas.dto';

@ApiTags('Empresas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'empresas', version: '1' })
export class EmpresasController {
  constructor(private readonly empresasService: EmpresasService) {}

  @Get()
  @ApiOperation({ summary: 'Lista las empresas registradas' })
  @ApiOkResponse({
    description: 'Listado paginado de empresas',
    type: FindEmpresasResponseDto,
  })
  findAll(@Query() query: FindEmpresasQueryDto): Promise<{
    items: EmpresaListItemDto[];
    total: number;
  }> {
    return this.empresasService.findAll(query);
  }
}
