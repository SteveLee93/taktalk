import { IsOptional, IsString, IsBoolean, IsNumber, Min, IsEnum } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class GetNoticesDto {
  @ApiProperty({ required: false, description: '검색어 (제목, 내용)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, description: '중요 공지사항 여부' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  isImportant?: boolean;

  @ApiProperty({ required: false, description: '활성 공지사항 여부' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  isActive?: boolean;

  @ApiProperty({ required: false, description: '페이지 번호', minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, description: '페이지당 항목 수', minimum: 1, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;

  @ApiProperty({ required: false, description: '정렬 방식 (desc: 최신순, asc: 오래된순)', default: 'desc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';
} 