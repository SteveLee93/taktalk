import { Entity, PrimaryGeneratedColumn, Column, OneToOne, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Match } from './match.entity';
import { LeagueParticipant } from './league-participant.entity';

@Entity()
export class MatchResult {
  @ApiProperty({ description: '경기 결과 ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: '경기', type: () => Match })
  @OneToOne(() => Match, match => match.result, { onDelete: 'CASCADE', cascade: true })
  @JoinColumn({ name: 'match_id' })
  match: Match;

  @ApiProperty({ description: '승자', type: () => LeagueParticipant })
  @ManyToOne(() => LeagueParticipant, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'winner_id' })
  winner: LeagueParticipant;

  @ApiProperty({ description: '점수 상세' })
  @Column('json')
  scoreDetails: {
    sets: Array<{
      player1Score: number;
      player2Score: number;
    }>;
    finalScore?: {
      player1Sets: number;
      player2Sets: number;
    };
  };
} 