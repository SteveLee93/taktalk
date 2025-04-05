import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { LeagueOperator } from './league-operator.entity';
import { LeagueParticipant } from './league-participant.entity';
import { User } from './user.entity';
import { Stage } from './stage.entity';
import { SkillLevel } from '../common/enums/skill-level.enum';

@Entity()
export class League {
  @ApiProperty({ description: '리그 ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: '리그 생성자', type: () => User })
  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'creator_id' })
  creator: User;

  @ApiProperty({ description: '생성 일시' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ description: '리그 이름' })
  @Column()
  name: string;

  @ApiProperty({ description: '시/도' })
  @Column()
  city: string;

  @ApiProperty({ description: '구/군' })
  @Column()
  district: string;

  @ApiProperty({ description: '경기장' })
  @Column()
  venue: string;

  @ApiProperty({ description: '경기 시간' })
  @Column()
  time: string;

  @ApiProperty({ description: '테이블 수' })
  @Column()
  tableCount: number;

  @ApiProperty({ description: '상금' })
  @Column()
  prize: string;

  @ApiProperty({ description: '리그 설명' })
  @Column('text')
  description: string;

  @ApiProperty({ description: '최소 실력 수준', enum: SkillLevel })
  @Column({
    type: 'enum',
    enum: SkillLevel,
  })
  minSkillLevel: SkillLevel;

  @ApiProperty({ description: '최대 실력 수준', enum: SkillLevel })
  @Column({
    type: 'enum',
    enum: SkillLevel,
  })
  maxSkillLevel: SkillLevel;

  @ApiProperty({ description: '최대 참가자 수' })
  @Column()
  maxPlayers: number;

  @ApiProperty({ description: '연락처' })
  @Column()
  contact: string;

  @ApiProperty({ description: '해시태그', type: [String] })
  @Column('simple-array')
  hashtags: string[];

  @OneToMany(() => LeagueOperator, operator => operator.league)
  operators: LeagueOperator[];

  @OneToMany(() => LeagueParticipant, participant => participant.league)
  participants: LeagueParticipant[];

  @OneToMany(() => Stage, stage => stage.league)
  stages: Stage[];
} 