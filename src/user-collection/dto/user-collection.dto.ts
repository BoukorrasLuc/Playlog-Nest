import { IsOptional, IsInt, IsString } from 'class-validator';

export class UserCollectionDto {
  @IsInt()
  userId: number;

  @IsOptional()
  @IsString()
  systemId?: string;

  @IsOptional()
  @IsString()
  accessoryId?: string;

  @IsOptional()
  @IsString()
  gameId?: string;

  @IsOptional()
  acquisitionDate?: Date;

  @IsOptional()
  acquisitionPrice?: number;

  @IsOptional()
  @IsString()
  condition?: string;

  @IsOptional()
  @IsString()
  completeness?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}