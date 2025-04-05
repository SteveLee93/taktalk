import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Stage } from './stage.entity';
import { Group } from './group.entity';
import { User } from './user.entity';
import { MatchResult } from './match-result.entity';

export enum MatchStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  BYE = 'bye'
}

export interface PlayerOrigin {
  groupId?: number;
  groupName?: string;
  rank?: number;
  seed?: number;
}

@Entity()
export class Match {
  @ApiProperty({ description: '경기 ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: '단계', type: () => Stage })
  @ManyToOne(() => Stage, stage => stage.matches, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stage_id' })
  stage: Stage;

  @ApiProperty({ description: '그룹', type: () => Group, required: false })
  @ManyToOne(() => Group, group => group.matches, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'group_id' })
  group?: Group;

  @ApiProperty({ description: '플레이어 1', type: () => User })
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'player1_id' })
  player1: User;

  @ApiProperty({ description: '플레이어 2', type: () => User })
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'player2_id' })
  player2: User;

  @ApiProperty({ description: '플레이어 1 출신 정보 (예선 조/순위/시드)' })
  @Column('json', { nullable: true })
  player1Origin?: PlayerOrigin;

  @ApiProperty({ description: '플레이어 2 출신 정보 (예선 조/순위/시드)' })
  @Column('json', { nullable: true })
  player2Origin?: PlayerOrigin;

  @ApiProperty({ description: '조 번호 (예선: 몇 조인지, 본선: 토너먼트 매치 번호)' })
  @Column()
  groupNumber: number;

  @ApiProperty({ description: '매치 설명 (예: "A조 1경기", "8강 1경기")' })
  @Column()
  description: string;

  @ApiProperty({ description: '경기 순서' })
  @Column()
  order: number;

  @ApiProperty({ description: '경기 상태', enum: MatchStatus })
  @Column({
    type: 'enum',
    enum: MatchStatus,
    default: MatchStatus.SCHEDULED,
  })
  status: MatchStatus;

  @ApiProperty({ description: '라운드 (예: 8강=3, 4강=2, 결승=1)' })
  @Column()
  round: number;

  @ApiProperty({ description: '다음 라운드 매치', type: () => Match, required: false })
  @ManyToOne(() => Match, { nullable: true })
  @JoinColumn({ name: 'next_match_id' })
  nextMatch?: Match;

  @ApiProperty({ description: '다음 라운드 매치에서의 위치 (1: player1, 2: player2)', required: false })
  @Column({ nullable: true })
  nextMatchPosition?: 1 | 2;

  @OneToOne(() => MatchResult, result => result.match, { eager: true })
  result: MatchResult;
} 