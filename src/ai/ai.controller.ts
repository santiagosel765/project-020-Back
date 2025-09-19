import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AiService } from './ai.service';


@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get()
  findAll() {
    return 'findAll()';
  }

}
