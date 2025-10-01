import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PdfModule } from './pdf/pdf.module';
import { DocumentsModule } from './documents/documents.module';
import { AiModule } from './ai/ai.module';
import { PrismaModule } from './prisma/prisma.module';
import { AwsModule } from './aws/aws.module';
import { RolesModule } from './roles/roles.module';
import { PaginasModule } from './paginas/paginas.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PosicionesModule } from './posiciones/posiciones.module';
import { GerenciasModule } from './gerencias/gerencias.module';
import { EmpresasModule } from './empresas/empresas.module';
import { WsModule } from './ws/ws.module';
import { NotificationService } from './notification/notification.service';
import { NotificationModule } from './notification/notification.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    AuthModule,
    UsersModule,
    RolesModule,
    PaginasModule,
    PdfModule,
    DocumentsModule,
    AiModule,
    PrismaModule,
    AwsModule,
    PosicionesModule,
    GerenciasModule,
    EmpresasModule,
    WsModule,
    NotificationModule,
    HttpModule.register({
      timeout: 10_000,
      maxRedirects: 5,
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    NotificationService,
  ],
})
export class AppModule {}
