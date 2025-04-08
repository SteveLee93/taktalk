import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from './user.entity';
import { League } from './league.entity';
import { SkillLevel } from '../common/enums/skill-level.enum';

export enum ParticipantStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

@Entity()
export class LeagueParticipant {
  @ApiProperty({ description: '참가자 ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: '리그', type: () => League })
  @ManyToOne(() => League, league => league.participants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'league_id' })
  league: League;

  @ApiProperty({ description: '사용자', type: () => User })
  @ManyToOne(() => User, user => user.participatingLeagues, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ApiProperty({ description: '사용자 아이디' })
  @Column()
  username: string;

  @ApiProperty({ description: '참가자 닉네임', required: false })
  @Column({ nullable: true })
  nickname: string;

  @ApiProperty({ description: '신청 순번' })
  @Column({ default: 0 })
  orderNumber: number;

  @ApiProperty({ description: '참가 상태', enum: ParticipantStatus, default: ParticipantStatus.PENDING })
  @Column({
    type: 'enum',
    enum: ParticipantStatus,
    default: ParticipantStatus.PENDING
  })
  status: ParticipantStatus;

  @Column({
    type: 'enum',
    enum: SkillLevel,
  })
  @ApiProperty({ description: '참가자 부수', enum: SkillLevel })
  skillLevel: SkillLevel;
} 