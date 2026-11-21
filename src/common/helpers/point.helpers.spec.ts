import { pointTransformer } from '@/common/helpers/point.helpers';

describe('pointTransformer', () => {
  it('should write a point the way postgres reads it', () => {
    expect(pointTransformer.to({ x: 44.2, y: 19.1 })).toBe('(44.2, 19.1)');
  });

  it('should return the point from the database as it is', () => {
    const point = { x: 44.2, y: 19.1 };

    expect(pointTransformer.from(point)).toBe(point);
  });
});
