import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateNoticeDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  content: string;

  @IsOptional()
  @IsBoolean()
  isImportant?: boolean = false;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
} 