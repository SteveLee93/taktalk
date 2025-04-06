import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { League } from './league.entity';
import { StageType } from '../common/types/stage-options.type';
import { Group } from './group.entity';
import { Match } from './match.entity';
import { GroupStageOptions, TournamentOptions } from '../common/types/stage-options.type';

@Entity()
export class Stage {
  @ApiProperty({ description: '단계 ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: '리그', type: () => League })
  @ManyToOne(() => League, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'league_id' })
  league: League;

  @ApiProperty({ description: '단계 이름' })
  @Column()
  name: string;

  @ApiProperty({ description: '단계 순서' })
  @Column()
  order: number;

  @ApiProperty({ description: '단계 타입', enum: StageType })
  @Column({
    type: 'enum',
    enum: StageType,
  })
  type: StageType;

  @ApiProperty({ description: '단계 설정' })
  @Column('json')
  options: GroupStageOptions | TournamentOptions;

  @ApiProperty({ description: '조 편성 확정 여부' })
  @Column({ default: false })
  isGroupConfirmed: boolean;

  @OneToMany(() => Group, group => group.stage)
  groups: Group[];

  @OneToMany(() => Match, match => match.stage)
  matches: Match[];
} 