import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsOptional, IsNumber, IsDateString } from 'class-validator';

export class CreateAccessoryDto {
  @IsString()
  id: string;

  @IsString()
  @IsOptional()
  asin?: string;

  @IsString()
  @IsOptional()
  upc?: string;

  @IsString()
  @IsOptional()
  productName?: string;

  @IsString()
  @IsOptional()
  consoleName?: string;

  @IsString()
  @IsOptional()
  genre?: string;

  @IsDateString()
  @IsOptional()
  releaseDate?: string;

  @IsNumber()
  @IsOptional()
  loosePrice?: number;

  @IsNumber()
  @IsOptional()
  cibPrice?: number;

  @IsNumber()
  @IsOptional()
  newPrice?: number;

  @IsNumber()
  @IsOptional()
  boxOnlyPrice?: number;

  @IsNumber()
  @IsOptional()
  manualOnlyPrice?: number;

  @IsNumber()
  @IsOptional()
  gradedPrice?: number;
}

export class UpdateAccessoryDto extends PartialType(CreateAccessoryDto) {}