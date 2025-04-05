import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsArray, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ParticipantStatus } from '../../../entities/league-participant.entity';

export class CreateLeagueDto {
  @ApiProperty({ description: '리그 이름' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: '리그 장소' })
  @IsString()
  @IsNotEmpty()
  location: string;

  @ApiProperty({ description: '경기장' })
  @IsString()
  @IsNotEmpty()
  venue: string;

  @ApiProperty({ description: '경기 시간' })
  @IsString()
  @IsNotEmpty()
  time: string;

  @ApiProperty({ description: '테이블 수' })
  @IsNumber()
  tableCount: number;

  @ApiProperty({ description: '상금' })
  @IsString()
  @IsNotEmpty()
  prize: string;

  @ApiProperty({ description: '리그 설명' })
  @IsString()
  description: string;

  @ApiProperty({ description: '실력 수준' })
  @IsString()
  @IsNotEmpty()
  skillLevel: string;

  @ApiProperty({ description: '최대 참가자 수' })
  @IsNumber()
  maxPlayers: number;

  @ApiProperty({ description: '연락처' })
  @IsString()
  @IsNotEmpty()
  contact: string;

  @ApiProperty({ description: '해시태그', type: [String] })
  @IsArray()
  @IsString({ each: true })
  hashtags: string[];
}

export class AddOperatorDto {
  @ApiProperty({ description: '운영자 닉네임' })
  @IsString()
  @IsNotEmpty()
  nickname: string;
}

export class UpdateParticipantStatusDto {
  @ApiProperty({ description: '참가 상태', enum: ParticipantStatus })
  @IsEnum(ParticipantStatus)
  @IsNotEmpty()
  status: ParticipantStatus;
} 