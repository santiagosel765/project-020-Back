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
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MeResponseDto } from './dto/me-response.dto';
import { UpdateSignatureDto } from './dto/update-signature.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
  me(@Req() req: any): Promise<MeResponseDto | null> {
    return this.usersService.me(req.user.sub);
  }

  @Patch('me/signature')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('file', 1))
  updateSignature(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: UpdateSignatureDto,
    @Req() req: any,
  ) {
    return this.usersService.updateSignature(req.user.sub, files?.[0], dto);
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
