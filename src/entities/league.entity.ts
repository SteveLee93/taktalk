import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { LeagueOperator } from './league-operator.entity';
import { LeagueParticipant } from './league-participant.entity';

@Entity()
export class League {
  @ApiProperty({ description: '리그 ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: '리그 이름' })
  @Column()
  name: string;

  @ApiProperty({ description: '리그 장소' })
  @Column()
  location: string;

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

  @ApiProperty({ description: '실력 수준' })
  @Column()
  skillLevel: string;

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
} 