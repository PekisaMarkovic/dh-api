import { ApiProperty } from '@nestjs/swagger';
import { Drink } from '@/drinks/entities/drink.entity';

export class PublicDrinkImageDto {
  @ApiProperty({ description: 'Public address of the image (WebP)' })
  url: string;

  @ApiProperty({ nullable: true, type: String })
  altText: string | null;

  @ApiProperty()
  width: number;

  @ApiProperty()
  height: number;
}

/** What a white label site is allowed to know about a drink, nothing about the warehouse or the stock levels */
export class PublicDrinkDto {
  @ApiProperty()
  drinkId: number;

  @ApiProperty()
  name: string;

  @ApiProperty({ description: 'Price per unit' })
  price: number;

  @ApiProperty({ description: 'False when the drink is out of stock' })
  inStock: boolean;

  @ApiProperty({ type: () => PublicDrinkImageDto, nullable: true })
  image: PublicDrinkImageDto | null;

  static from(drink: Drink): PublicDrinkDto {
    return {
      drinkId: drink.drinkId,
      name: drink.name,
      price: drink.price,
      inStock: drink.quantity > 0,
      image: drink.image
        ? {
            url: drink.image.url,
            altText: drink.image.altText,
            width: drink.image.width,
            height: drink.image.height,
          }
        : null,
    };
  }
}
