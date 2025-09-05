
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from 'generated/prisma';


@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {

  logger: Logger = new Logger('Prisma-Client');

  async onModuleInit() {
    await this.$connect();
    this.logger.log("Database successfully connected");
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log("Database successfully disconnected");
  }
}
