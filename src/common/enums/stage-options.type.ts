import { MatchFormat } from './match-format.enum';
import { StageType } from './stage-type.enum';

export interface BaseStageOptions {
  leagueId: number;
  order: number;
  matchFormat: MatchFormat;
  type: StageType;
}

export interface GroupStageOptions extends BaseStageOptions {
  type: StageType.GROUP;
  groups: {
    playerIds: number[];
  }[];
}

export interface TournamentOptions extends BaseStageOptions {
  type: StageType.TOURNAMENT;
  playerIds: number[];
}

export type StageOptions = GroupStageOptions | TournamentOptions; 