import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateNoticeDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsBoolean()
  isImportant?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
} 