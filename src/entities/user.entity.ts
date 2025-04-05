import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { LeagueOperator } from './league-operator.entity';
import { LeagueParticipant } from './league-participant.entity';
import { Exclude } from 'class-transformer';

@Entity()
export class User {
  @ApiProperty({ description: '사용자 ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: '사용자 이름' })
  @Column({ unique: true })
  username: string;

  @ApiProperty({ description: '비밀번호' })
  @Column()
  @Exclude()
  password: string;

  @ApiProperty({ description: '닉네임' })
  @Column({ unique: true })
  nickname: string;

  @ApiProperty({ description: '이메일' })
  @Column({ unique: true })
  email: string;

  @ApiProperty({ description: '전화번호', required: false })
  @Column({ nullable: true })
  phone: string;

  @OneToMany(() => LeagueOperator, operator => operator.user)
  operatedLeagues: LeagueOperator[];

  @OneToMany(() => LeagueParticipant, participant => participant.user)
  participatedLeagues: LeagueParticipant[];
} 