import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import { PaginationDto } from '../dto';
import { PaginationOptions } from '../types';

/**
 * @example
 * 
 * @Query(ValidationPipe, PaginationPipe) pagination: Required<PaginationOptions>`
 */
@Injectable()
export class PaginationPipe
  implements PipeTransform<PaginationDto, Required<PaginationOptions>>
{
  transform(
    value: PaginationDto,
    metadata: ArgumentMetadata,
  ): Required<PaginationOptions> {
    return {
      page: value.page ?? 1,
      limit: value.limit ?? 10,
      sortBy: value.sortBy ?? 'updatedAt',
      sortOrder: value.sortOrder ?? 'DESC',
    };
  }
}
