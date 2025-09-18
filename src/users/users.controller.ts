import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateSignatureDto } from './dto/update-signature.dto';
import { MeResponseDto, PaginationDto } from 'src/shared/dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @UseInterceptors(FileInterceptor('foto'))
  create(
    @Body() createUserDto: CreateUserDto,
    @Req() req: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const roleIds = this.extractRoleIds(req?.body);
    return this.usersService.create(createUserDto, file, roleIds);
  }

  @Get()
  findAll(@Query() pagination: PaginationDto, @Query('all') all = '0') {
    return this.usersService.findAll(all === '1', pagination);
  }

  @Get('me')
  me(@Req() req: any): Promise<MeResponseDto> {
    return this.usersService.me(+req.user.sub);
  }

  @Patch('me/signature')
  @UseInterceptors(FilesInterceptor('file', 1))
  updateSignature(
    @Req() req: any,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: UpdateSignatureDto,
  ) {
    const [file] = files ?? [];
    return this.usersService.updateSignature(+req.user.sub, file, dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('foto'))
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
    @Req() req: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const roleIds = this.extractRoleIds(req?.body);
    return this.usersService.update(id, updateUserDto, file, roleIds);
  }

  @Get(':id/roles')
  getRoles(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getUserRoles(id);
  }

  @Put(':id/roles')
  setRoles(
    @Param('id', ParseIntPipe) id: number,
    @Body('rolIds') rolIds?: unknown,
  ) {
    const normalized = this.normalizeRoleIds(
      rolIds === undefined ? [] : Array.isArray(rolIds) ? rolIds : [rolIds],
    );
    return this.usersService.replaceUserRoles(id, normalized);
  }

  @Patch(':id/password')
  changePassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ChangePasswordDto,
    @Req() req: any,
  ) {
    return this.usersService.changePassword(id, body, {
      id: req.user.sub,
      roleIds: req.user.roleIds ?? [],
    });
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.softDelete(id);
  }

  private extractRoleIds(payload: any): number[] | undefined {
    if (!payload || typeof payload !== 'object') {
      return undefined;
    }

    const keys = Object.keys(payload);
    const candidates: unknown[] = [];
    let hasRoles = false;

    if (Object.prototype.hasOwnProperty.call(payload, 'roles')) {
      candidates.push(payload.roles);
      hasRoles = true;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'roles[]')) {
      candidates.push(payload['roles[]']);
      hasRoles = true;
    }

    for (const key of keys) {
      if (/^roles\[[^\]]*\]$/.test(key)) {
        candidates.push(payload[key]);
        hasRoles = true;
      }
    }

    if (!hasRoles) {
      return undefined;
    }

    return this.normalizeRoleIds(candidates);
  }

  private normalizeRoleIds(inputs: unknown[]): number[] {
    const queue: unknown[] = [...inputs];
    const normalized = new Set<number>();

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined || current === null) {
        continue;
      }

      if (Array.isArray(current)) {
        queue.unshift(...current);
        continue;
      }

      if (typeof current === 'object') {
        queue.unshift(...Object.values(current));
        continue;
      }

      if (typeof current === 'string') {
        const trimmed = current.trim();
        if (!trimmed) {
          continue;
        }

        if (/^\[[\s\S]*\]$/.test(trimmed)) {
          try {
            const parsed = JSON.parse(trimmed);
            queue.unshift(parsed);
            continue;
          } catch (error) {
            // Ignore malformed JSON and try to parse as number below
          }
        }

        const num = Number(trimmed);
        if (Number.isInteger(num) && num > 0) {
          normalized.add(num);
        }
        continue;
      }

      if (typeof current === 'number') {
        if (Number.isInteger(current) && current > 0) {
          normalized.add(current);
        }
      }
    }

    return Array.from(normalized.values());
  }
}
