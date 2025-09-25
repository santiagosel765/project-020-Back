import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Put,
  Post,
  Query,
  UseGuards,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRolDto } from './dto/create-rol.dto';
import { UpdateRolDto } from './dto/update-rol.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InactiveFlagDto, PaginationDto } from 'src/shared/dto';

@UseGuards(JwtAuthGuard)
@Controller({ path: 'roles', version: '1' })
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  findAll(@Query() pagination: PaginationDto, @Query() q: InactiveFlagDto) {
    const includeInactive = (q.includeInactive ?? q.showInactive ?? q.all) ?? false;
    return this.rolesService.findAll(includeInactive, pagination);
  }

  @Post()
  create(@Body() dto: CreateRolDto) {
    return this.rolesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRolDto) {
    return this.rolesService.update(id, dto);
  }

  @Get(':id/paginas')
  getPages(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.getPages(id);
  }

  @Put(':id/paginas')
  setPages(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { paginaIds: number[] },
    @Req() req: any,
  ) {
    return this.rolesService.setPages(id, body.paginaIds ?? [], req.user.sub);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.remove(id);
  }

  @Patch(':id/restore')
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.restore(id);
  }
}
