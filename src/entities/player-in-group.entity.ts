import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Group } from './group.entity';
import { User } from './user.entity';

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
} 