import { MatchFormat } from './match-format.enum';
import { StageType } from './stage-type.enum';

export interface MatchFormatOptions {
  gamesRequired: number;
  setsRequired: number;
}

export type BracketType = 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION';
export type SeedingType = 'GROUP_RANK' | 'MANUAL';

export interface BaseStageOptions {
  matchFormat: MatchFormatOptions;
}

export interface GroupStageOptions extends BaseStageOptions {
  groupCount: number;
  playersPerGroup: number;
  advancingPlayersCount: number;
}

export interface TournamentOptions extends BaseStageOptions {
  bracketType: BracketType;
  seeding: {
    type: SeedingType;
    qualificationCriteria?: {
      rankCutoff?: number;
      minRank?: number;
      maxRank?: number;
    };
  };
}

export type StageOptions = GroupStageOptions | TournamentOptions; 