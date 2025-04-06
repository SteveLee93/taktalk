import { ApiProperty } from '@nestjs/swagger';

export class GroupPlayerDto {
  @ApiProperty({ description: '그룹 플레이어 ID' })
  id: number;
  
  @ApiProperty({ description: '그룹 ID' })
  groupId: number;
  
  @ApiProperty({ description: '사용자 ID' })
  userId: number;
  
  @ApiProperty({ description: '그룹 내 순위', example: 1 })
  rank: number;
} 