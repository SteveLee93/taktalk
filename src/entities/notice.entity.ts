import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';

@Entity()
export class Notice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column('text')
  content: string;

  @Column({ default: false })
  isImportant: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  viewCount: number;

  @ManyToOne(() => User, { nullable: true })
  author: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
