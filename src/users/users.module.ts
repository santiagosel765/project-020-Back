// src/users/users.module.ts
import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { RolesModule } from '../roles/roles.module';
import { AwsModule } from '../aws/aws.module';
import { AiModule } from 'src/ai/ai.module';

@Module({
  imports: [PrismaModule, AuthModule, RolesModule, AwsModule, AiModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
