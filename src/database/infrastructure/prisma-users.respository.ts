import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

import { UsersRepository } from '../domain/repositories/users.repository';
import { user } from 'generated/prisma';

@Injectable()
export class PrismaUsersRepository implements UsersRepository {
  constructor(private prisma: PrismaService) {}

    async findUserById(userId: number): Promise<user> {
        try {
            const dbUser = await this.prisma.user.findFirst({ where: { id: userId } });
    
            if( !dbUser ) {
                throw new HttpException(`Usuario con ID "${userId}" no encontrado`, HttpStatus.NOT_FOUND);
            }
    
            return dbUser
            
        } catch (error) {
            throw new HttpException(`Problemas al consultar usuario con ID "${userId}": ${ error }`, HttpStatus.NOT_FOUND);
        }
    }


}
