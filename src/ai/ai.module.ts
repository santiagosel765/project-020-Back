import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { OpenAiProvider } from './providers/open-ai.provider';

@Module({
  controllers: [AiController],
  providers: [OpenAiProvider, AiService],
  exports: [AiService],
})
export class AiModule {}
