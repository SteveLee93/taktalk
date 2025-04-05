import { Stage } from '../../../entities/stage.entity';
import { User } from '../../../entities/user.entity';

export interface StageStrategy {
  createGroups(stage: Stage, players: User[]): Promise<void>;
  createMatches(stage: Stage): Promise<void>;
  getAdvancingPlayers(stage: Stage): Promise<User[]>;
} 