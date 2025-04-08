import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsObject, IsNumber, IsOptional } from 'class-validator';
import { CreateLeagueDto } from './league.dto';

export class CreateLeagueTemplateDto {
  @ApiProperty({ description: '템플릿 이름' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: '저장된 폼 데이터' })
  @IsObject()
  data: Partial<CreateLeagueDto>;

  @ApiProperty({ description: '사용자 ID', required: false })
  @IsNumber()
  @IsOptional()
  userId?: number;
}

export class LeagueTemplateDto {
  @ApiProperty({ description: '템플릿 ID' })
  id: number;

  @ApiProperty({ description: '템플릿 이름' })
  name: string;

  @ApiProperty({ description: '저장된 폼 데이터' })
  data: Partial<CreateLeagueDto>;

  @ApiProperty({ description: '생성 일시' })
  createdAt: Date;
} 