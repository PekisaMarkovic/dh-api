import { BadRequestException } from '@nestjs/common';

/**
 * Parse an optional integer query param, undefined when it is missing
 */
export const parseOptionalInt = (value?: string, name = 'value') => {
  if (value === undefined || value === '') {
    return undefined;
  }

  if (!/^\d+$/.test(value)) {
    throw new BadRequestException(`${name} must be a number`);
  }

  return Number(value);
};
