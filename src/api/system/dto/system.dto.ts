import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsOptional, IsNumber, IsDateString } from 'class-validator';

export class CreateSystemDto {
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

  @IsDateString()
  @IsOptional()
  ebayDate?: string;

  @IsDateString()
  @IsOptional()
  zone?: string;
}

export class UpdateSystemDto extends PartialType(CreateSystemDto) {}