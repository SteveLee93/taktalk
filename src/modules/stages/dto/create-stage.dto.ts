import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, IsEnum, ValidateNested, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { StageType } from '../../../common/enums/stage-type.enum';
import { BaseStageOptions, GroupStageOptions, TournamentOptions } from '../../../common/types/stage-options.type';

export class CreateStageDto {
  @ApiProperty({
    description: '리그 ID',
    example: 1
  })
  @IsNumber()
  @IsNotEmpty()
  leagueId: number;

  @ApiProperty({
    description: '단계 이름 (예: "예선 1조", "8강", "4강" 등)',
    example: '예선 1조'
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: '단계 순서 (예: 1: 예선, 2: 본선 등)',
    example: 1,
    minimum: 1
  })
  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  order: number;

  @ApiProperty({
    description: '단계 타입',
    enum: StageType,
    example: StageType.GROUP,
    examples: {
      GROUP: {
        value: StageType.GROUP,
        description: '예선 (조별 리그)',
      },
      TOURNAMENT: {
        value: StageType.TOURNAMENT,
        description: '본선 (토너먼트)',
      },
    },
  })
  @IsEnum(StageType)
  @IsNotEmpty()
  type: StageType;

  @ApiProperty({
    description: '단계 설정',
    examples: {
      GROUP: {
        value: {
          matchFormat: {
            gamesRequired: 5,  // 5판
            setsRequired: 3,   // 3선승
          },
          groupCount: 4,           // 4개 조
          playersPerGroup: 4,      // 조당 4명
          advancingPlayersCount: 2 // 조별 2명 진출
        },
        description: '예선 단계 설정 예시',
      },
      TOURNAMENT: {
        value: {
          matchFormat: {
            gamesRequired: 5,  // 5판
            setsRequired: 3,   // 3선승
          },
          "rankCutoff": 4,
          "minRank": 1,
          "maxRank": 3
        },
        description: '본선 토너먼트 설정 예시 (16강)',
      }
    },
  })
  @ValidateNested()
  @Type(() => Object)
  @IsNotEmpty()
  options: GroupStageOptions | TournamentOptions;
} 