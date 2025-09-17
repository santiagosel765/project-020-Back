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
  UseInterceptors,
  UploadedFiles,
  UploadedFile,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateSignatureDto } from './dto/update-signature.dto';
import { MeResponseDto } from 'src/shared/dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @UseInterceptors(FileInterceptor('foto'))
  create(
    @Body() createUserDto: CreateUserDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.usersService.create(createUserDto, file);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
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
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.usersService.update(id, updateUserDto, file);
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
}
