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

export interface TournamentOptions extends BaseStageOptions {
  bracketType: BracketType;          // 상위부/하위부 구분
  playerCount: number;               // 참가자 수
  startRound: number;               // 시작 라운드 (8강 = 3, 16강 = 4, 32강 = 5)
  seeding: {
    type: SeedingType;              // 시드 배정 방식
    groupRankWeights?: number[];    // 조별 순위별 가중치 (GROUP_RANK 타입일 때만 사용)
    manualSeeds?: number[];        // 수동 시드 배정 (MANUAL 타입일 때만 사용)
  };
} 