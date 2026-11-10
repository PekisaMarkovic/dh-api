import { LocationPointDto } from '@/common/dto/location-point.dto';

export const pointTransformer = {
  to(value: LocationPointDto): string {
    return `(${value.x}, ${value.y})`;
  },
  from(value: LocationPointDto): LocationPointDto {
    return value;
  },
};
