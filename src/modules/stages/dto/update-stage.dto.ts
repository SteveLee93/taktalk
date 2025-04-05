import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, ValidateNested, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { StageType } from '../../../common/enums/stage-type.enum';
import { GroupStageOptions, TournamentOptions } from '../../../common/types/stage-options.type';

export class UpdateStageDto {
  @ApiProperty({
    description: '단계 이름 (예: "예선 1조", "8강", "4강" 등)',
    example: '예선 1조',
    required: false
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: '단계 순서 (예: 1: 예선, 2: 본선 등)',
    example: 1,
    minimum: 1,
    required: false
  })
  @IsNumber()
  @IsOptional()
  @Min(1)
  order?: number;

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
    required: false
  })
  @IsEnum(StageType)
  @IsOptional()
  type?: StageType;

  @ApiProperty({
    description: '단계 설정 (단계가 시작되지 않은 경우에만 수정 가능)',
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
            gamesRequired: 7,  // 7판
            setsRequired: 4,   // 4선승
          },
          type: 'single',           // 단판 토너먼트
          playerCount: 16,          // 16명 참가
          seeding: {
            type: 'group_rank',     // 조별 순위 기반 시드 배정
            groupRankWeights: [1, 0.7, 0.5, 0.3] // 조별 순위별 가중치
          }
        },
        description: '본선 단계 설정 예시',
      },
    },
    required: false
  })
  @ValidateNested()
  @Type(() => Object)
  @IsOptional()
  options?: GroupStageOptions | TournamentOptions;
} 