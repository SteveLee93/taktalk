import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from './user.entity';
import { League } from './league.entity';

@Entity()
export class LeagueOperator {
  @ApiProperty({ description: '운영자 ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: '리그', type: () => League })
  @ManyToOne(() => League, league => league.operators, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'league_id' })
  league: League;

  @ApiProperty({ description: '사용자', type: () => User })
  @ManyToOne(() => User, user => user.operatedLeagues, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
} 