import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import { BcryptAdapter } from '../auth/adapters/bcrypt.adapter';
import { RolesService } from '../roles/roles.service';
import { AWSService } from 'src/aws/aws.service';
import { envs } from 'src/config/envs';
import { UpdateSignatureDto } from './dto/update-signature.dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private rolesService: RolesService,
    private awsService: AWSService,
  ) {}

  create(createUserDto: CreateUserDto) {
    const { password, ...rest } = createUserDto;
    return this.prisma.user.create({
      data: { ...rest, password: BcryptAdapter.hashPassword(password) },
    });
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        primer_nombre: true,
        correo_institucional: true,
        activo: true,
      },
    });
  }

  findOne(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        primer_nombre: true,
        correo_institucional: true,
        activo: true,
      },
    });
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return this.prisma.user.update({ where: { id }, data: updateUserDto });
  }

  remove(id: number) {
    return this.prisma.user.delete({ where: { id } });
  }

  async me(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        primer_nombre: true,
        correo_institucional: true,
      },
    });
    if (!user) return null;
    const [pages, roles] = await Promise.all([
      this.rolesService.getPagesForUser(user.id),
      this.rolesService.getRoleNamesForUser(user.id),
    ]);

    const fileKey = `${envs.bucketSignaturesPrefix}/${id}/current.png`;
    const exists = await this.awsService.checkFileAvailabilityInBucket(fileKey);
    let url: string | null = null;
    if (exists) {
      const presigned = await this.awsService.getPresignedURLByKey(fileKey);
      url = presigned.data;
    }

    return {
      id: user.id,
      nombre: user.primer_nombre,
      correo: user.correo_institucional,
      pages,
      roles,
      signatureUrl: url,
      hasSignature: exists,
    };
  }

  async updateSignature(
    userId: number,
    file?: Express.Multer.File,
    dto?: UpdateSignatureDto,
  ) {
    let buffer: Buffer | undefined;
    let contentType: string | undefined;
    if (file) {
      if (!['image/png', 'image/jpeg'].includes(file.mimetype)) {
        throw new HttpException(
          'Tipo de archivo no permitido',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (file.size > 2 * 1024 * 1024) {
        throw new HttpException(
          'El archivo supera el tamaño máximo de 2MB',
          HttpStatus.BAD_REQUEST,
        );
      }
      buffer = file.buffer;
      contentType = file.mimetype;
    } else if (dto?.dataUrl) {
      const matches = dto.dataUrl.match(
        /^data:(image\/png|image\/jpeg);base64,(.+)$/,
      );
      if (!matches) {
        throw new HttpException(
          'Formato de dataUrl inválido',
          HttpStatus.BAD_REQUEST,
        );
      }
      contentType = matches[1];
      buffer = Buffer.from(matches[2], 'base64');
      if (buffer.length > 2 * 1024 * 1024) {
        throw new HttpException(
          'El archivo supera el tamaño máximo de 2MB',
          HttpStatus.BAD_REQUEST,
        );
      }
    } else {
      throw new HttpException(
        'No se proporcionó archivo ni dataUrl',
        HttpStatus.BAD_REQUEST,
      );
    }

    const fileKey = `${envs.bucketSignaturesPrefix}/${userId}/current.png`;
    await this.awsService.uploadFile(buffer, 'signature', 'png', {
      keyPrefix: envs.bucketSignaturesPrefix,
      contentType: contentType ?? 'image/png',
      customKey: fileKey,
    });
    const url = await this.awsService.getPresignedURLByKey(
      fileKey,
      contentType ?? 'image/png',
    );
    return {
      status: 'success',
      data: {
        fileKey,
        url: url.data,
      },
    };
  }
}
