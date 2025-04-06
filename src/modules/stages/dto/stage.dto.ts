import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsObject, IsOptional, IsBoolean, IsArray } from 'class-validator';
import { StageType } from '../../../common/types/stage-options.type';
import { GroupStageOptions, TournamentOptions } from '../../../common/types/stage-options.type';
import { UpdateMatchResultDto } from './match.dto';

export class CreateStageDto {
  @ApiProperty({ description: '리그 ID' })
  @IsNumber()
  leagueId: number;

  @ApiProperty({ description: '단계 이름' })
  @IsString()
  name: string;

  @ApiProperty({ description: '단계 순서' })
  @IsNumber()
  order: number;

  @ApiProperty({ description: '단계 타입', enum: StageType })
  @IsEnum(StageType)
  type: StageType;

  @ApiProperty({ description: '단계 설정' })
  @IsObject()
  options: GroupStageOptions | TournamentOptions;
}

export class ConfirmGroupsDto {
  @ApiProperty({ description: '그룹별 플레이어 ID 배열' })
  @IsArray()
  groups: number[][];
}

export { UpdateMatchResultDto }; 