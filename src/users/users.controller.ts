import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesService } from '../roles/roles.service';
import { MeResponseDto, MePageDto } from './dto/me-response.dto';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
  ) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: any): Promise<MeResponseDto | null> {
    const user = await this.usersService.findOne(req.user.sub);
    if (!user) return null;
    const [pages, roles] = await Promise.all([
      this.rolesService.getPagesForUser(user.id),
      this.rolesService.getRoleNamesForUser(user.id),
    ]);
    return {
      id: user.id,
      nombre: user.primer_nombre,
      correo: user.correo_institucional,
      pages: pages as MePageDto[],
      roles,
    };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(+id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(+id);
  }
}
