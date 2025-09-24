import { Module } from '@nestjs/common';
import { WsService } from './ws.service';
import { WsGateway } from './ws.gateway';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [ DatabaseModule ],
  providers: [WsGateway, WsService],
  exports: [ WsService ],
})
export class WsModule {}
