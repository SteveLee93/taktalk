import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from './user.entity';

@Entity()
export class LeagueTemplate {
  @ApiProperty({ description: '템플릿 ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: '템플릿 이름' })
  @Column()
  name: string;

  @ApiProperty({ description: '저장된 폼 데이터' })
  @Column('json')
  data: Record<string, any>;

  @ApiProperty({ description: '템플릿 소유자', type: () => User })
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: number;

  @ApiProperty({ description: '생성 일시' })
  @CreateDateColumn()
  createdAt: Date;
} 