import { IsOptional, IsString } from 'class-validator';

export class ItemScrappeDatabaseDto {
  @IsOptional()
  @IsString()
  ean?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  systems?: string;

  @IsOptional()
  @IsString()
  condition?: string;

  @IsOptional()
  @IsString()
  completeness?: string;

  @IsOptional()
  @IsString()
  zone?: string;

  @IsOptional()
  @IsString()
  priceSold?: string;

  @IsOptional()
  dateSold?: Date;
}
