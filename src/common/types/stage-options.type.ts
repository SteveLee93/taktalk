import { StageType } from '../enums/stage-type.enum';

export interface MatchFormatOptions {
  gamesRequired: number;
  setsRequired: number;
}

export type SeedingType = 'GROUP_RANK' | 'MANUAL';

export interface BaseStageOptions {
  matchFormat: MatchFormatOptions;
}

export interface GroupStageOptions extends BaseStageOptions {
  groupCount: number;
  playersPerGroup: number;
  advancingPlayersCount: number;
  seeding?: {
    type: SeedingType;
    qualificationCriteria?: {
      rankCutoff?: number;
      minRank?: number;
      maxRank?: number;
    };
  };
}

export interface TournamentOptions extends BaseStageOptions {
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