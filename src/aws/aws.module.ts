import { Module } from '@nestjs/common';
import { AWSService } from './aws.service';

@Module({
  exports: [AWSService],
  providers: [AWSService],
})
export class AwsModule {}
