import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Group } from './group.entity';
import { User } from './user.entity';
import { SkillLevel } from '../common/enums/skill-level.enum';

@Entity()
export class PlayerInGroup {
  @ApiProperty({ description: '그룹 플레이어 ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: '그룹', type: () => Group })
  @ManyToOne(() => Group, group => group.players, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group: Group;

  @ApiProperty({ description: '플레이어', type: () => User })
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
  
  @ApiProperty({ description: '그룹 내 순위', example: 1 })
  @Column({ default: 0 })
  rank: number;

  @ApiProperty({ description: '참가자 부수', enum: SkillLevel })
  @Column({
    type: 'enum',
    enum: SkillLevel,
    nullable: true
  })
  skillLevel: SkillLevel;
  
  @ApiProperty({ description: '플레이어 표시 순서', example: 1 })
  @Column({ default: 0 })
  orderNumber: number;
} 