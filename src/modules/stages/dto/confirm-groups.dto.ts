import { IsArray, ArrayMinSize, ArrayMaxSize, IsNumber, Min, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class MatchFormatDto {
  @ApiProperty({ description: '전체 판 수', example: 5 })
  @IsNumber()
  gamesRequired: number;

  @ApiProperty({ description: '승리 판 수', example: 3 })
  @IsNumber()
  setsRequired: number;
}

export class ConfirmGroupsDto {
  @ApiProperty({
    description: '각 조별 참가자 ID 배열',
    example: [[1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15], [4, 8, 12, 16]],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  groups: number[][];

  @ApiProperty({
    description: '매치 포맷 설정',
    example: { gamesRequired: 5, setsRequired: 3 },
    required: false
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => MatchFormatDto)
  matchFormat?: MatchFormatDto;
} 