import { IsArray, ArrayMinSize, ArrayMaxSize, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConfirmGroupsDto {
  @ApiProperty({
    description: '각 조별 참가자 ID 배열',
    example: [[1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15], [4, 8, 12, 16]],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  groups: number[][];
} 