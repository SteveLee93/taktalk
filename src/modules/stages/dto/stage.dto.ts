import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsObject, IsOptional, IsBoolean, IsArray, IsNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { StageType } from '../../../common/enums/stage-type.enum';
import { GroupStageOptions, TournamentOptions } from '../../../common/types/stage-options.type';
import { UpdateMatchResultDto } from './match.dto';
import { SkillLevel } from '../../../common/enums/skill-level.enum';

export class MatchFormatOptions {
  @ApiProperty({ description: '전체 판 수', example: 5 })
  @IsNumber()
  gamesRequired: number;

  @ApiProperty({ description: '승리 판 수', example: 3 })
  @IsNumber()
  setsRequired: number;
}

export class StageOptions {
  @ApiProperty({ description: '매치 포맷' })
  @IsObject()
  matchFormat: MatchFormatOptions;
}

export class ParticipantDto {
  @ApiProperty({ description: '사용자 아이디' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: '참가자 부수', enum: SkillLevel })
  @IsEnum(SkillLevel)
  @IsNotEmpty()
  skillLevel: SkillLevel;
}

export class GroupDto {
  @ApiProperty({ description: '그룹 참가자 목록', type: [ParticipantDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParticipantDto)
  participants: ParticipantDto[];
}

export class CreateStageDto {
  @ApiProperty({ description: '리그 ID' })
  @IsNumber()
  @IsNotEmpty()
  leagueId: number;

  @ApiProperty({ description: '단계 이름' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: '단계 순서' })
  @IsNumber()
  @IsNotEmpty()
  order: number;

  @ApiProperty({ description: '단계 타입', enum: StageType })
  @IsEnum(StageType)
  @IsNotEmpty()
  type: StageType;

  @ApiProperty({ description: '단계 설정' })
  @IsObject()
  @ValidateNested()
  @Type(() => Object)
  options: GroupStageOptions | TournamentOptions;

  @ApiProperty({ description: '그룹 목록', type: [GroupDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GroupDto)
  groups: GroupDto[];
}

export class ConfirmGroupsDto {
  @ApiProperty({ description: '그룹별 플레이어 ID 배열' })
  @IsArray()
  groups: number[][];
}

export { UpdateMatchResultDto }; 