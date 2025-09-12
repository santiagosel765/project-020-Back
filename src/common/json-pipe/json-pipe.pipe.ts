import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

@Injectable()
export class JsonParsePipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    
    if (typeof value === 'string') {
      try {
        const result = JSON.parse(value);
        console.log({result})
        return result
      } catch (error) {
        throw new BadRequestException(
          'Validation failed (invalid JSON string)',
        );
      }
    }
    return value; // Return original value if not a string
  }
}
