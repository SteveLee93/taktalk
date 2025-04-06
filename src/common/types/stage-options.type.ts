export enum StageType {
  GROUP = 'GROUP',
  TOURNAMENT = 'TOURNAMENT'
}

export interface BaseStageOptions {
  matchFormat: {
    gamesRequired: number;  // 전체 판 수 (예: 5판)
    setsRequired: number;   // 승리에 필요한 판 수 (예: 3선승)
  };
}

export interface GroupStageOptions extends BaseStageOptions {
  groupCount: number;           // 그룹 수
  playersPerGroup: number;      // 그룹당 플레이어 수
  advancingPlayersCount: number; // 그룹당 진출 인원 수
}

export type BracketType = 'UPPER' | 'LOWER';
export type SeedingType = 'GROUP_RANK' | 'MANUAL';

export interface TournamentOptions {
  matchFormat: {
    gamesRequired: number;
    setsRequired: number;
  };
  bracketType: BracketType;
  seeding: {
    type: SeedingType;
    qualificationCriteria: {
      rankCutoff: number;  // 각 조별 상위 N위까지 진출
      minRank?: number;    // 최소 랭크 (기본값: 1)
      maxRank?: number;    // 최대 랭크 (기본값: rankCutoff)
    };
  };
} 