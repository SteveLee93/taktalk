import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsArray, IsNotEmpty, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { ParticipantStatus } from '../../../entities/league-participant.entity';
import { SkillLevel } from '../../../common/enums/skill-level.enum';

export class CreateLeagueDto {
  @ApiProperty({ description: '리그 이름' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: '시/도' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ description: '구/군' })
  @IsString()
  @IsNotEmpty()
  district: string;

  @ApiProperty({ description: '경기장' })
  @IsString()
  @IsNotEmpty()
  venue: string;

  @ApiProperty({ description: '시작 시간', example: '2023-07-15T14:00:00Z' })
  @IsDateString()
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

  @ApiProperty({ 
    description: '최소 실력 수준',
    enum: SkillLevel,
    example: SkillLevel.FIVE
  })
  @IsEnum(SkillLevel)
  @IsNotEmpty()
  minSkillLevel: SkillLevel;

  @ApiProperty({ 
    description: '최대 실력 수준',
    enum: SkillLevel,
    example: SkillLevel.ZERO
  })
  @IsEnum(SkillLevel)
  @IsNotEmpty()
  maxSkillLevel: SkillLevel;

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

export class ParticipateLeagueDto {
  @ApiProperty({ description: '참가자 닉네임', required: false })
  nickname?: string;

  @ApiProperty({ description: '사용자 아이디' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ description: '참가자 부수', enum: SkillLevel })
  @IsEnum(SkillLevel)
  skillLevel: SkillLevel;
}

export class UpdateParticipantStatusDto {
  @IsEnum(ParticipantStatus)
  @ApiProperty({
    description: '참가 상태',
    enum: ParticipantStatus,
    example: ParticipantStatus.APPROVED
  })
  status: ParticipantStatus;
}

export class SearchLeagueDto {
  @ApiProperty({ description: '시/도', required: false })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({ description: '구/군', required: false })
  @IsString()
  @IsOptional()
  district?: string;

  @ApiProperty({ 
    description: '실력 수준',
    enum: SkillLevel,
    required: false,
    example: SkillLevel.FIVE
  })
  @IsEnum(SkillLevel)
  @IsOptional()
  skillLevel?: SkillLevel;
} 