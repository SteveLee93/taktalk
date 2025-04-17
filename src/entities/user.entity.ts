import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { LeagueOperator } from './league-operator.entity';
import { LeagueParticipant } from './league-participant.entity';
import { PlayerInGroup } from './player-in-group.entity';
import { MatchResult } from './match-result.entity';
import { Exclude, Expose } from 'class-transformer';

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user'
}

@Entity()
export class User {
  @ApiProperty({ description: '사용자 ID' })
  @PrimaryGeneratedColumn()
  @Expose()
  id: number;

  @ApiProperty({ description: '로그인 아이디' })
  @Column({ unique: true })
  @Expose()
  userId: string;

  @ApiProperty({ description: '비밀번호' })
  @Column()
  @Exclude()
  password: string;

  @ApiProperty({ description: '이름' })
  @Column({ unique: true })
  @Expose()
  name: string;

  @ApiProperty({ description: '이메일' })
  @Column({ unique: true })
  @Expose()
  email: string;

  @ApiProperty({ description: '전화번호', required: false })
  @Column({ nullable: true })
  @Expose()
  phone: string;

  @ApiProperty({ description: '사용자 역할', enum: UserRole, default: UserRole.USER })
  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  @Expose()
  role: UserRole;

  @OneToMany(() => LeagueOperator, operator => operator.user)
  operatingLeagues: LeagueOperator[];

  @OneToMany(() => LeagueParticipant, participant => participant.user)
  participatingLeagues: LeagueParticipant[];

  @OneToMany(() => PlayerInGroup, playerInGroup => playerInGroup.user)
  groups: PlayerInGroup[];

  @OneToMany(() => MatchResult, result => result.winner)
  wonMatches: MatchResult[];
} 