import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Stage } from './stage.entity';
import { PlayerInGroup } from './player-in-group.entity';
import { Match } from './match.entity';

@Entity()
export class Group {
  @ApiProperty({ description: '그룹 ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: '단계', type: () => Stage })
  @ManyToOne(() => Stage, stage => stage.groups, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stage_id' })
  stage: Stage;

  @ApiProperty({ description: '그룹 이름' })
  @Column()
  name: string;

  @ApiProperty({ description: '그룹 번호' })
  @Column()
  number: number;

  @OneToMany(() => PlayerInGroup, playerInGroup => playerInGroup.group)
  players: PlayerInGroup[];

  @OneToMany(() => Match, match => match.group)
  matches: Match[];
} 