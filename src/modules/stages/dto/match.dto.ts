import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsArray, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { PlayerOrigin } from '../../../entities/match.entity';

export class SetScoreDto {
  @ApiProperty({
    description: '플레이어1 점수',
    example: 11,
  })
  player1Score: number;

  @ApiProperty({
    description: '플레이어2 점수',
    example: 9,
  })
  player2Score: number;
}

export class UpdateMatchResultDto {
  @ApiProperty({
    description: '세트별 스코어',
    type: [SetScoreDto],
  })
  scoreDetails: SetScoreDto[];
}

export class MatchResponseDto {
  @ApiProperty({ description: '매치 ID' })
  id: number;

  @ApiProperty({ description: '조 번호' })
  groupNumber: number;

  @ApiProperty({ description: '매치 설명' })
  description: string;

  @ApiProperty({ description: '매치 순서' })
  order: number;

  @ApiProperty({ description: '라운드' })
  round: number;

  @ApiProperty({ description: '플레이어 1 ID', required: false })
  @IsOptional()
  player1Id?: number;

  @ApiProperty({ description: '플레이어 2 ID', required: false })
  @IsOptional()
  player2Id?: number;

  @ApiProperty({ description: '플레이어 1 출신 정보', required: false })
  @IsOptional()
  player1Origin?: PlayerOrigin;

  @ApiProperty({ description: '플레이어 2 출신 정보', required: false })
  @IsOptional()
  player2Origin?: PlayerOrigin;

  @ApiProperty({ description: '매치 상태' })
  status: string;

  @ApiProperty({ description: '다음 매치 ID', required: false })
  @IsOptional()
  nextMatchId?: number;

  @ApiProperty({ description: '다음 매치에서의 위치', required: false })
  @IsOptional()
  nextMatchPosition?: 1 | 2;

  @ApiProperty({ description: '세트 스코어', type: [SetScoreDto], required: false })
  @IsOptional()
  scoreDetails?: SetScoreDto[];

  @ApiProperty({ description: '승자 ID', required: false })
  @IsOptional()
  winnerId?: number;
} 