import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StageStrategy } from './stage-strategy.interface';
import { Stage } from '../../../entities/stage.entity';
import { Match, MatchStatus, PlayerOrigin } from '../../../entities/match.entity';
import { User } from '../../../entities/user.entity';
import { Group } from '../../../entities/group.entity';
import { TournamentOptions, BracketType, StageType } from '../../../common/types/stage-options.type';

@Injectable()
export class TournamentStageStrategy implements StageStrategy {
  constructor(
    @InjectRepository(Match)
    private matchRepository: Repository<Match>,
    @InjectRepository(Group)
    private groupRepository: Repository<Group>,
    @InjectRepository(Stage)
    private stageRepository: Repository<Stage>,
  ) {}

  async createGroups(stage: Stage, players: User[]): Promise<void> {
    // 토너먼트는 그룹이 없음
    return;
  }

  async createMatches(stage: Stage): Promise<void> {
    // 진출자 수를 기반으로 토너먼트 크기 결정
    const playerCount = await this.calculateQualifiedPlayerCount(stage);
    const requiredRounds = this.calculateRequiredRounds(playerCount);
    const totalSlots = Math.pow(2, requiredRounds);
    
    console.log(`본선 진출 예상 인원: ${playerCount}명, 필요한 라운드 수: ${requiredRounds}, 총 슬롯: ${totalSlots}`);
    
    const options = stage.options as TournamentOptions;
    
    // 바로 마지막 경기부터 시작
    const matches: Partial<Match>[] = [];
    const matchesByRound: Partial<Match>[][] = [];
    
    // 모든 라운드에 대한 빈 배열 준비
    for (let i = 0; i < requiredRounds; i++) {
      matchesByRound.push([]);
    }
    
    // 1. 첫 경기 라운드(마지막 라운드) 매치 생성 
    const firstRound = requiredRounds;
    const firstRoundMatchCount = Math.pow(2, firstRound - 1);
    const roundName = this.getRoundName(firstRound);
    
    // 실제 선수 배정이 필요한 매치 수 계산 (부전승 고려)
    const matchesNeeded = Math.ceil(playerCount / 2);
    const byeCount = totalSlots - playerCount;
    
    console.log(`첫 라운드(${roundName}) 매치 수: ${firstRoundMatchCount}, 실제 필요 매치: ${matchesNeeded}, 부전승: ${byeCount}`);
    
    for (let i = 0; i < firstRoundMatchCount; i++) {
      const match: Partial<Match> = {
        stage,
        round: firstRound,
        groupNumber: i + 1,
        description: `${roundName} ${i + 1}경기`,
        order: i + 1, // 단순히 인덱스 기반 순서
        status: MatchStatus.SCHEDULED
      };
      matches.push(match);
      matchesByRound[firstRound - 1].push(match);
    }
    
    // 2. 이전 라운드들 생성 (결승부터 시작해서 역순으로)
    for (let round = firstRound - 1; round >= 1; round--) {
      const matchesInRound = Math.pow(2, round - 1);
      const roundName = this.getRoundName(round);
      
      for (let i = 0; i < matchesInRound; i++) {
        const match: Partial<Match> = {
          stage,
          round,
          groupNumber: i + 1,
          description: `${roundName} ${i + 1}경기`,
          order: i + 1, // 단순히 인덱스 기반 순서
          status: MatchStatus.SCHEDULED
        };
        matches.push(match);
        matchesByRound[round - 1].push(match);
      }
    }
    
    // 3. 매치 연결 설정 (하위 라운드에서 상위 라운드로)
    for (let round = firstRound; round > 1; round--) {
      const currentRoundMatches = matchesByRound[round - 1];
      const previousRoundMatches = matchesByRound[round - 2];
      
      for (let i = 0; i < currentRoundMatches.length; i += 2) {
        const nextMatchIndex = Math.floor(i / 2);
        if (nextMatchIndex < previousRoundMatches.length) {
          const nextMatch = previousRoundMatches[nextMatchIndex];
          
          // 첫 번째 매치 연결
          if (i < currentRoundMatches.length) {
            currentRoundMatches[i].nextMatch = nextMatch as Match;
            currentRoundMatches[i].nextMatchPosition = 1;
          }
          
          // 두 번째 매치 연결
          if (i + 1 < currentRoundMatches.length) {
            currentRoundMatches[i + 1].nextMatch = nextMatch as Match;
            currentRoundMatches[i + 1].nextMatchPosition = 2;
          }
        }
      }
    }
    
    // 4. 매치 저장
    await this.matchRepository.save(matches);
    
    console.log(`토너먼트용 매치 ${matches.length}개 생성 완료`);
  }


  private getRoundName(round: number): string {
    const totalPlayers = Math.pow(2, round);
    switch (totalPlayers) {
      case 256: return '256강';
      case 128: return '128강';
      case 64: return '64강';
      case 32: return '32강';
      case 16: return '16강';
      case 8: return '8강';
      case 4: return '4강';
      case 2: return '결승';
      default: return `${totalPlayers}강`;
    }
  }

  async assignSeeds(stage: Stage): Promise<void> {
    // 1. 예선 순위에 따라 플레이어 배열 구성
    let rankedPlayers = await this.getRankedPlayersFromPreliminary(stage);
    if (!rankedPlayers.length) {
      console.log('시드 배정할 플레이어가 없습니다.');
      return;
    }
    
    console.log(`시드 배정 대상 플레이어: ${rankedPlayers.length}명`);
    
    // 중복 플레이어 제거
    const uniquePlayers = this.getUniquePlayers(rankedPlayers);
    if (uniquePlayers.length !== rankedPlayers.length) {
      console.log(`중복 플레이어 발견: ${rankedPlayers.length} -> ${uniquePlayers.length}`);
      rankedPlayers = uniquePlayers;
    }
    
    // 2. 토너먼트 구조 계산
    const requiredRounds = this.calculateRequiredRounds(rankedPlayers.length);
    const tournamentSize = Math.pow(2, requiredRounds);
    
    // 3. 모든 매치 가져오기
    const allMatches = await this.matchRepository.find({
      where: { stage: { id: stage.id } },
      relations: ['player1', 'player2', 'nextMatch'],
      order: { round: 'DESC', order: 'ASC' }
    });
    
    // 4. 각 라운드별 매치 정리
    const matchesByRound: Match[][] = [];
    for (let i = 1; i <= requiredRounds; i++) {
      const roundMatches = allMatches.filter(match => match.round === i);
      matchesByRound.push(roundMatches);
    }
    
    // 5. 첫 라운드 매치 (가장 높은 라운드)
    const firstRoundMatches = allMatches.filter(match => match.round === requiredRounds);
    console.log(`첫 라운드 매치 수: ${firstRoundMatches.length}`);
    
    // 6. 플레이어 출신 정보 가져오기
    const playerOrigins = await this.getPlayerOrigins(stage, rankedPlayers.map(p => p.id));
    
    // 7. 토너먼트 시드 배정 계획 작성
    const {
      matchAssignments,
      matchesWithByes
    } = this.createTournamentSeedPlan(rankedPlayers, playerOrigins, firstRoundMatches.length);
    
    console.log('매치 배정 계획:', matchAssignments);
    console.log('부전승 매치 수:', matchesWithByes.length);
    
    // 8. 계획에 따라 실제 매치에 선수 배정
    const processedMatches: Match[] = [];
    
    for (let i = 0; i < firstRoundMatches.length; i++) {
      const match = firstRoundMatches[i];
      const assignment = matchAssignments[i];
      
      if (!assignment) continue;
      
      // 플레이어 1 배정
      if (assignment.player1) {
        match.player1 = { id: assignment.player1.id } as User;
        match.player1Origin = assignment.player1Origin;
        console.log(`매치 ${match.id} player1: ${assignment.player1.id}`);
      }
      
      // 플레이어 2 배정
      if (assignment.player2) {
        match.player2 = { id: assignment.player2.id } as User;
        match.player2Origin = assignment.player2Origin;
        console.log(`매치 ${match.id} player2: ${assignment.player2.id}`);
      }
      
      // 부전승 처리
      if (assignment.isBye || 
          (assignment.player1 && !assignment.player2) || 
          (!assignment.player1 && assignment.player2)) {
        match.status = MatchStatus.BYE;
        console.log(`매치 ${match.id}: 부전승 처리됨`);
      }
      
      processedMatches.push(match);
    }
    
    // 9. 첫 라운드 매치 저장
    if (processedMatches.length > 0) {
      await this.matchRepository.save(processedMatches);
      console.log(`${processedMatches.length}개의 첫 라운드 매치 저장 완료`);
    }
    
    // 10. 부전승으로 인한 다음 라운드 진출 처리
    const nextRoundMatches = await this.processAutomaticAdvancement(allMatches, matchesWithByes);
    
    // 11. 다음 라운드 매치 저장
    if (nextRoundMatches.length > 0) {
      await this.matchRepository.save(nextRoundMatches);
      console.log(`부전승으로 인한 ${nextRoundMatches.length}개의 다음 라운드 매치 업데이트 완료`);
    }
  }
  
  // 토너먼트 시드 배정 계획 생성
  private createTournamentSeedPlan(
    players: User[],
    playerOrigins: Record<number, PlayerOrigin>,
    matchCount: number
  ): {
    matchAssignments: {
      player1?: User;
      player1Origin?: PlayerOrigin;
      player2?: User;
      player2Origin?: PlayerOrigin;
      isBye: boolean;
    }[];
    matchesWithByes: number[];
  } {
    // 필요한 변수 초기화
    const totalPlayers = players.length;
    const totalSlots = matchCount * 2;
    const byeCount = totalSlots - totalPlayers;
    const tournamentSize = totalSlots;
    
    console.log(`총 플레이어: ${totalPlayers}, 총 슬롯: ${totalSlots}, 부전승 수: ${byeCount}, 토너먼트 크기: ${tournamentSize}`);
    
    // 결과 배열 초기화
    const matchAssignments: {
      player1?: User;
      player1Origin?: PlayerOrigin;
      player2?: User;
      player2Origin?: PlayerOrigin;
      isBye: boolean;
    }[] = [];
    
    // 부전승 매치 인덱스 추적
    const matchesWithByes: number[] = [];
    
    // 1. 플레이어를 조별, 랭크별로 분류 (그룹ID 오름차순으로 정렬)
    const rankGroups: { 
      rank: number;
      groupId: number;
      groupName: string;
      player: User;
      origin: PlayerOrigin;
    }[][] = [];
    
    // 랭크 범위 설정 (minRank, maxRank 확인)
    const options = this.getCurrentStageOptions();
    const rankCutoff = options?.seeding?.qualificationCriteria?.rankCutoff || 3;
    const minRank = options?.seeding?.qualificationCriteria?.minRank || 1;
    const maxRank = options?.seeding?.qualificationCriteria?.maxRank || rankCutoff;
    
    // 랭크별 배열 초기화 (지정된 범위의 랭크만)
    const rankCount = maxRank - minRank + 1;
    for (let i = 0; i < rankCount; i++) {
      rankGroups.push([]);
    }

    console.log(`랭크 범위: ${minRank}-${maxRank}, 랭크 그룹 배열 생성: ${rankGroups.length}개`);

    // 분류 전에 모든 플레이어 원본 확인
    console.log(`분류 전 전체 플레이어 수: ${players.length}명`);
    players.forEach(p => {
      const origin = playerOrigins[p.id];
      console.log(`플레이어 ID ${p.id}, 이름: ${p.name}, 랭크: ${origin?.rank || '없음'}, 그룹: ${origin?.groupId || '없음'}`);
    });

    // 플레이어 정보 분류
    let classifiedCount = 0;
    for (const player of players) {
      const origin = playerOrigins[player.id];
      if (!origin || origin.groupId === undefined) {
        console.error(`오류: 플레이어 ID ${player.id}, 이름: ${player.name}의 소속 그룹 정보가 없습니다.`);
        continue;
      }

      const rank = origin.rank || 1;
      console.log(`플레이어 ${player.name} (ID: ${player.id}) 분류 중: 랭크=${rank}, 범위 체크=${rank >= minRank && rank <= maxRank}`);

      // 지정된 랭크 범위 내에 있는지 확인
      if (rank >= minRank && rank <= maxRank) {
        const rankIndex = rank - minRank; // 0-indexed로 변환

        if (rankIndex >= 0 && rankIndex < rankGroups.length) {
          rankGroups[rankIndex].push({
            rank: rank,
            groupId: origin.groupId,
            groupName: origin.groupName || '',
            player,
            origin
          });
          classifiedCount++;
        } else {
          console.error(`오류: 랭크 인덱스(${rankIndex})가 범위를 벗어납니다 (0-${rankGroups.length - 1})`);
        }
      } else {
        console.log(`제외됨: 플레이어 ${player.name}(랭크 ${rank})는 범위(${minRank}-${maxRank}) 밖입니다.`);
      }
    }

    console.log(`분류 완료: 총 ${players.length}명 중 ${classifiedCount}명 분류됨`);
    
    // 각 랭크 그룹 내에서 그룹ID로 정렬
    for (let i = 0; i < rankGroups.length; i++) {
      rankGroups[i].sort((a, b) => a.groupId - b.groupId);
      console.log(`${i+minRank}등 플레이어 수: ${rankGroups[i].length}명`);
    }
    
    // 2. 토너먼트 시드 번호 할당 (1,2,3,4... 순서로)
    const seedMap: Map<number, User | null> = new Map();
    const seedToOrigin: Map<number, PlayerOrigin> = new Map();
    
    // 각 랭크별로 시드 배정 (지정된 랭크 순서로)
    let nextSeed = 1;
    
    for (let rankIndex = 0; rankIndex < rankGroups.length; rankIndex++) {
      const actualRank = rankIndex + minRank;
      const playersInRank = rankGroups[rankIndex];
      
      console.log(`${actualRank}등 플레이어 ${playersInRank.length}명 시드 배정 시작`);
      
      for (let i = 0; i < playersInRank.length; i++) {
        const seedNumber = nextSeed++;
        seedMap.set(seedNumber, playersInRank[i].player);
        seedToOrigin.set(seedNumber, playersInRank[i].origin);
        console.log(`시드 ${seedNumber}: ${playersInRank[i].groupName} ${playersInRank[i].rank}등 (ID: ${playersInRank[i].player.id})`);
      }
    }
    
    // 가상 선수는 남은 시드에 배정
    for (let i = totalPlayers + 1; i <= tournamentSize; i++) {
      seedMap.set(i, null); // null은 가상 선수
      console.log(`시드 ${i}: 가상 선수`);
    }
    
    // 3. 토너먼트 매치 패턴 생성 (토너먼트 크기에 따라 적절한 패턴 생성)
    const orderedMatches = this.generateTournamentMatchPattern(tournamentSize, matchCount);
    console.log("생성된 매치 패턴:", orderedMatches);
    
    // 4. 매치 배정 (시드 매칭 패턴에 따라)
    for (let matchIndex = 0; matchIndex < matchCount; matchIndex++) {
      // 이 인덱스의 시드 매치업이 없으면 건너뛰기
      if (!orderedMatches[matchIndex]) continue;
      
      const [seed1, seed2] = orderedMatches[matchIndex];
      
      const player1 = seedMap.get(seed1) || undefined;
      const player2 = seedMap.get(seed2) || undefined;
      
      const player1Origin = player1 ? seedToOrigin.get(seed1) : undefined;
      const player2Origin = player2 ? seedToOrigin.get(seed2) : undefined;
      
      // 부전승 확인 (한쪽이 가상 선수인 경우)
      const isBye = (player1 === null || player2 === null);
      
      if (isBye) {
        matchesWithByes.push(matchIndex);
      }
      
      matchAssignments[matchIndex] = {
        player1: player1 || undefined,
        player1Origin: player1Origin,
        player2: player2 || undefined,
        player2Origin: player2Origin,
        isBye: isBye
      };
      
      // 매치 로깅
      let player1Info = '가상 선수';
      let player2Info = '가상 선수';
      
      if (player1) {
        player1Info = `시드 ${seed1}: ${player1Origin?.groupName} ${player1Origin?.rank}등 (ID: ${player1.id})`;
      }
      
      if (player2) {
        player2Info = `시드 ${seed2}: ${player2Origin?.groupName} ${player2Origin?.rank}등 (ID: ${player2.id})`;
      }
      
      console.log(`매치 ${matchIndex + 1} (${seed1} vs ${seed2}): ${player1Info} vs ${player2Info} ${isBye ? '(부전승)' : ''}`);
    }
    
    // 최종 검증 - 같은 조 선수들이 첫 라운드에서 만나지 않는지 확인
    for (const match of matchAssignments) {
      if (!match.isBye && match.player1 && match.player2 && 
          match.player1Origin?.groupId === match.player2Origin?.groupId) {
        console.log(`[경고] 같은 조 선수끼리 매치됨: ${match.player1Origin?.groupName}`);
      }
    }
    
    return { matchAssignments, matchesWithByes };
  }
  
  // 현재 스테이지 옵션 가져오기 (seeding 설정용)
  private getCurrentStageOptions(): any {
    try {
      // 기본값 설정
      return { seeding: { qualificationCriteria: { rankCutoff: 4 } } };
      
      // 참고: 실제 DB 조회를 구현하려면 아래 코드 사용
      /* 
      const stageRepository = this.stageRepository;
      const stage = await stageRepository.findOne({
        order: { id: 'DESC' }
      });
      return stage?.options || { seeding: { qualificationCriteria: { rankCutoff: 4 } } };
      */
    } catch (error) {
      console.error('스테이지 옵션 가져오기 실패:', error);
      return { seeding: { qualificationCriteria: { rankCutoff: 4 } } }; // 기본값
    }
  }
  
  // 토너먼트 크기에 맞는 매치 패턴 생성 함수
  private generateTournamentMatchPattern(tournamentSize: number, matchCount: number): [number, number][] {
    // 표준 시드 순서 가져오기
    const standardSeeds = this.getStandardSeedOrderFor(tournamentSize);
    console.log(`표준 시드 순서 (${tournamentSize}명): ${standardSeeds.join(', ')}`);

    // 결과 배열 초기화
    const orderedMatches: [number, number][] = new Array(matchCount);

    // 시드 순서대로 매치 구성
    for (let i = 0; i < matchCount; i++) {
      orderedMatches[i] = [standardSeeds[i * 2], standardSeeds[i * 2 + 1]];
    }

    return orderedMatches;
  }

  // 표준 시드 순서 생성
  private getStandardSeedOrderFor(size: number): number[] {
    // 미리 정의된 패턴 (8, 16, 32명)
    if (size === 8) {
      return [1, 8, 4, 5, 3, 6, 2, 7];
    } else if (size === 16) {
      return [1, 16, 8, 9, 5, 12, 4, 13, 3, 14, 6, 11, 7, 10, 2, 15];
    } else if (size === 32) {
      return [
        1, 32, 16, 17, 9, 24, 8, 25, 5, 28, 12, 21, 13, 20, 4, 29,
        3, 30, 14, 19, 11, 22, 6, 27, 7, 26, 10, 23, 15, 18, 2, 31
      ];
    }

    // 다른 크기의 토너먼트는 배열을 생성하여 재귀적으로 채우기
    const positions = new Array(size);
    this.fillStandardSeedOrder(positions, 1, size, 0);
    return positions;
  }

  // 표준 시드 순서를 재귀적으로 채우기
  private fillStandardSeedOrder(positions: number[], start: number, end: number, index: number): void {
    if (start > end) return;

    const length = end - start + 1;
    if (length === 1) {
      positions[index] = start;
      return;
    }

    const mid = Math.floor((start + end) / 2);
    positions[index] = start;  // 1번 시드
    positions[index + length - 1] = end;  // 마지막 시드

    if (length > 2) {
      // 재귀적으로 나머지 부분 채우기
      this.fillStandardSeedOrder(positions, start + 1, mid, index + 2);
      this.fillStandardSeedOrder(positions, mid + 1, end - 1, index + length / 2);
    }
  }

  // 중복 플레이어 제거
  private getUniquePlayers(players: User[]): User[] {
    const uniquePlayerMap = new Map<number, User>();
    
    for (const player of players) {
      if (!uniquePlayerMap.has(player.id)) {
        uniquePlayerMap.set(player.id, player);
      }
    }
    
    return Array.from(uniquePlayerMap.values());
  }

  private async getRankedPlayersFromPreliminary(stage: Stage): Promise<User[]> {
    const previousStage = await this.getPreviousStage(stage);
    if (!previousStage) {
      console.error(`이전 스테이지를 찾을 수 없습니다. (스테이지 ID: ${stage.id})`);
      return [];
    }

    console.log(`이전 스테이지: ID ${previousStage.id}, 이름: ${previousStage.name}, 타입: ${previousStage.type}`);

    // 예선 그룹 조회
    let groups = await this.groupRepository.find({
      where: { stage: { id: previousStage.id } },
      relations: ['players', 'players.user'],
      order: { number: 'ASC' }, // 조 번호 순서대로 정렬
    });

    // 그룹이 없으면 디버깅 정보 추가
    if (groups.length === 0) {
      console.error(`스테이지 ${previousStage.id}에서 그룹을 찾을 수 없습니다.`);

      // 직접 스테이지 ID로 그룹 찾기 시도
      const allGroups = await this.groupRepository.find();
      console.log(`전체 그룹 수: ${allGroups.length}`);
      
      groups = await this.groupRepository.find({
        relations: ['players', 'players.user', 'stage'],
      });
      
      console.log('그룹 목록:');
      groups.forEach(g => {
        console.log(`그룹 ID: ${g.id}, 이름: ${g.name}, 스테이지 ID: ${g.stage?.id}`);
      });
      
      // 다시 정확한 그룹만 필터링
      groups = groups.filter(g => g.stage?.id === previousStage.id);
      
      if (groups.length === 0) {
        console.error('이전 스테이지에 해당하는 그룹을 찾지 못했습니다.');
        return [];
      }
    }

    const options = stage.options as TournamentOptions;
    const { rankCutoff, minRank = 1, maxRank } = options.seeding.qualificationCriteria;
    
    // 최종 랭크 범위 결정
    const effectiveMaxRank = maxRank || rankCutoff;
    const effectiveMinRank = minRank || 1;
    
    console.log(`예선 그룹 수: ${groups.length}, 랭크 범위: ${effectiveMinRank}-${effectiveMaxRank}`);
    
    // 각 조별 랭킹 수집 및 가공
    const playersByRank: User[][] = [];
    for (let i = 0; i < (effectiveMaxRank - effectiveMinRank + 1); i++) {
      playersByRank.push([]);
    }
    
    // 각 조별로 플레이어 순위 계산 및 분류
    for (const group of groups) {
      console.log(`그룹 ${group.number} 처리 중...`);
      console.log(`플레이어 수: ${group.players.length}`);
      
      // 플레이어 rank 로그 출력
      group.players.forEach(p => {
        console.log(`플레이어 ${p.user.name} (ID: ${p.user.id}), 랭크: ${p.rank}`);
      });
      
      const rankedPlayers = await this.getRankedPlayersInGroup(group);
      console.log(`${group.number}조 전체 플레이어 수: ${rankedPlayers.length}명`);
      
      // 조별 지정된 랭크 범위의 플레이어만 저장
      for (let rank = effectiveMinRank - 1; rank < effectiveMaxRank && rank < rankedPlayers.length; rank++) {
        const rankIndex = rank - (effectiveMinRank - 1); // 0부터 시작하는 배열 인덱스 계산
        
        console.log(`플레이어 랭크 처리: 실제 랭크=${rank+1}, 배열 인덱스=${rankIndex}`);
        
        if (rankedPlayers[rank]) {
          if (rankIndex >= 0 && rankIndex < playersByRank.length) {
            playersByRank[rankIndex].push(rankedPlayers[rank]);
            console.log(`${group.number}조 ${rank+1}등 플레이어 추가: ID ${rankedPlayers[rank].id}, 이름: ${rankedPlayers[rank].name}, 배열 인덱스 ${rankIndex}`);
          } else {
            console.error(`오류: 배열 인덱스(${rankIndex})가 범위를 벗어남 (0-${playersByRank.length-1})`);
          }
        }
      }
      
      console.log(`${group.number}조: 랭크 범위 ${effectiveMinRank}-${effectiveMaxRank} 진출자 추가 완료`);
    }
    
    // 최종 시드 배정 결과 배열
    const seededPlayers: User[] = [];
    
    // 시드 순서대로 플레이어 배열 구성
    // 모든 등수별로 플레이어 수집 (1등부터 rankCutoff등까지)
    for (let rank = 0; rank < playersByRank.length; rank++) {
      if (playersByRank[rank]?.length > 0) {
        console.log(`${rank+effectiveMinRank}등 플레이어 ${playersByRank[rank].length}명 시드 배정`);
        seededPlayers.push(...playersByRank[rank]);
      } else {
        console.log(`${rank+effectiveMinRank}등 플레이어가 없습니다.`);
      }
    }
    
    // 최종 시드 배열 로그
    console.log(`최종 시드 배열: ${seededPlayers.length}명`);
    for (let i = 0; i < seededPlayers.length; i++) {
      const player = seededPlayers[i];
      const origin = player ? this.getPlayerOriginFromGroups(player.id, groups) : null;
      console.log(`Seed ${i + 1}: Player ID ${player?.id || 'unknown'}, 이름: ${player?.name}, ${origin ? `${origin.groupName} ${origin.rank}등` : 'unknown origin'}`);
    }
    
    return seededPlayers;
  }
  
  // 플레이어의 그룹 정보와 순위 가져오기 (로깅용)
  private getPlayerOriginFromGroups(playerId: number, groups: Group[]): { groupName: string, rank: number } | null {
    for (const group of groups) {
      const playerInGroup = group.players.find(p => p.user.id === playerId);
      if (playerInGroup) {
        return {
          groupName: `${group.number}조`,
          rank: playerInGroup.rank
        };
      }
    }
    return null;
  }

  private async getPlayerOrigins(stage: Stage, playerIds: number[]): Promise<Record<number, PlayerOrigin>> {
    const origins: Record<number, PlayerOrigin> = {};
    
    const previousStage = await this.getPreviousStage(stage);
    if (!previousStage) return origins;

    const groups = await this.groupRepository.find({
      where: { stage: { id: previousStage.id } },
      relations: ['players', 'players.user'],
      order: { number: 'ASC' },
    });

    for (const group of groups) {
      const rankedPlayers = await this.getRankedPlayersInGroup(group);
      
      rankedPlayers.forEach((player, index) => {
        if (playerIds.includes(player.id)) {
          origins[player.id] = {
            groupId: group.id,
            groupName: `${group.number}조`,
            rank: index + 1,
            seed: `${group.number}-${index + 1}` // 조-순위 형식 유지 (예: "1-1", "2-1")
          };
        }
      });
    }

    return origins;
  }

  private async getRankedPlayersInGroup(group: Group): Promise<User[]> {
    // PlayerInGroup의 rank 필드를 사용하여 정렬
    console.log(`${group.number}조 순위 계산 방식: PlayerInGroup의 rank 필드 사용`);
    
    // rank 필드로 정렬된 플레이어 목록 반환
    const playersByRank = [...group.players].sort((a, b) => a.rank - b.rank);
    
    // 로그 출력
    playersByRank.forEach(player => {
      console.log(`${group.number}조 ${player.rank}등: ${player.user.name} (ID: ${player.user.id})`);
    });
    
    return playersByRank.map(p => p.user);
  }

  private async getPreviousStage(stage: Stage): Promise<Stage | null> {
    // 토너먼트 타입이면 예선(GROUP) 스테이지를 찾음
    if (stage.type === StageType.TOURNAMENT) {
      return await this.stageRepository.findOne({
        where: {
          league: { id: stage.league.id },
          type: StageType.GROUP
        },
      });
    }
    
    // 기존 로직 (order 기반)
    return await this.stageRepository.findOne({
      where: {
        league: { id: stage.league.id },
        order: stage.order - 1,
      },
    });
  }

  async getAdvancingPlayers(stage: Stage): Promise<User[]> {
    // 토너먼트의 경우 결승전 승자가 우승자
    const finalMatch = await this.matchRepository.findOne({
      where: { stage: { id: stage.id } },
      relations: ['result', 'result.winner'],
      order: { id: 'DESC' },
    });

    return finalMatch?.result?.winner ? [finalMatch.result.winner] : [];
  }

  async updateMatchResult(match: Match, winnerId: number): Promise<void> {
    const currentStatus = match.status;
    match.status = MatchStatus.COMPLETED;
    await this.matchRepository.save(match);

    // 부전승 매치는 건너뛰기
    if (currentStatus === MatchStatus.BYE) {
      return;
    }

    // 다음 라운드 매치가 있는 경우 승자를 자동으로 배정
    if (match.nextMatch) {
      console.log(`매치 ${match.id}의 승자(ID: ${winnerId})를 다음 라운드 매치 ${match.nextMatch.id}로 진출시킵니다.`);
      
      const nextMatch = await this.matchRepository.findOne({
        where: { id: match.nextMatch.id },
        relations: ['player1', 'player2'],
      });

      if (nextMatch) {
        const winner = { id: winnerId } as User;
        // 승자의 출신 정보(Origin) 복사
        const winnerOrigin = match.player1?.id === winnerId ? match.player1Origin : match.player2Origin;
        
        console.log(`다음 매치 ${nextMatch.id}의 포지션: ${match.nextMatchPosition || '미설정'}`);
        
        // nextMatchPosition을 확인하여 적절한 위치에 승자 배정
        if (match.nextMatchPosition === 1) {
          console.log(`매치 ${nextMatch.id}의 player1에 승자(ID: ${winnerId}) 배정`);
          nextMatch.player1 = winner;
          nextMatch.player1Origin = winnerOrigin;
        } else if (match.nextMatchPosition === 2) {
          console.log(`매치 ${nextMatch.id}의 player2에 승자(ID: ${winnerId}) 배정`);
          nextMatch.player2 = winner;
          nextMatch.player2Origin = winnerOrigin;
        } else {
          // 위치가 미지정된 경우 빈 슬롯에 배정
          if (!nextMatch.player1) {
            console.log(`매치 ${nextMatch.id}의 player1이 비어있어 승자(ID: ${winnerId}) 배정`);
            nextMatch.player1 = winner;
            nextMatch.player1Origin = winnerOrigin;
          } else if (!nextMatch.player2) {
            console.log(`매치 ${nextMatch.id}의 player2가 비어있어 승자(ID: ${winnerId}) 배정`);
            nextMatch.player2 = winner;
            nextMatch.player2Origin = winnerOrigin;
          } else {
            console.log(`경고: 매치 ${nextMatch.id}의 양쪽 자리가 모두 차있습니다.`);
          }
        }
        
        // 다음 매치의 양쪽 플레이어가 모두 배정되었는지 확인
        if (nextMatch.player1 && nextMatch.player2) {
          console.log(`매치 ${nextMatch.id}의 양쪽 플레이어가 모두 배정되어 상태를 SCHEDULED로 변경합니다.`);
          nextMatch.status = MatchStatus.SCHEDULED;
        }
        
        await this.matchRepository.save(nextMatch);
        console.log(`매치 ${nextMatch.id} 업데이트 완료`);
      } else {
        console.log(`다음 매치(ID: ${match.nextMatch.id})를 찾을 수 없습니다.`);
      }
    } else {
      console.log(`매치 ${match.id}에는 다음 라운드 매치가 설정되어 있지 않습니다.`);
    }
  }

  // 필요한 토너먼트 라운드 수 계산 (8명 = 3라운드, 16명 = 4라운드)
  private calculateRequiredRounds(playerCount: number): number {
    if (playerCount <= 0) return 1; // 기본값 설정
    
    // 다음으로 큰 2의 제곱수를 찾기
    return Math.ceil(Math.log2(playerCount));
  }

  // 예선 진출자 수 계산
  private async calculateQualifiedPlayerCount(stage: Stage): Promise<number> {
    const previousStage = await this.getPreviousStage(stage);
    if (!previousStage) return 0;

    const groups = await this.groupRepository.find({
      where: { stage: { id: previousStage.id } },
      relations: ['players'],
    });

    const options = stage.options as TournamentOptions;
    const { rankCutoff } = options.seeding.qualificationCriteria;
    
    // 각 조별 진출자 수를 합산
    let totalPlayerCount = 0;
    for (const group of groups) {
      // 실제 선수 수와 진출 커트라인 중 작은 값 사용
      const playersInGroup = group.players.length;
      const advancingPlayersFromGroup = Math.min(playersInGroup, rankCutoff);
      totalPlayerCount += advancingPlayersFromGroup;
    }
    
    return totalPlayerCount;
  }

  // 부전승으로 인한 자동 진출 처리
  private async processAutomaticAdvancement(
    allMatches: Match[],
    byeMatchIndices: number[]
  ): Promise<Match[]> {
    // 변경된 다음 라운드 매치들
    const updatedNextMatches: Match[] = [];
    
    // 다음 라운드 매치 매핑
    const nextMatchMap = new Map<number, Match>();
    
    // 다음 라운드 매치 정보 구성
    for (const match of allMatches) {
      if (match.nextMatch) {
        nextMatchMap.set(match.nextMatch.id, match.nextMatch);
      }
    }
    
    // 부전승 매치 처리 - 모든 매치 확인
    const byeMatches = allMatches.filter(match => 
      match.status === MatchStatus.BYE || 
      (!match.player1 && match.player2) || 
      (match.player1 && !match.player2));
    
    console.log(`부전승 매치 찾기: ${byeMatches.length}개 발견`);
    
    for (const byeMatch of byeMatches) {
      // 매치를 부전승 상태로 표시
      byeMatch.status = MatchStatus.BYE;
      
      if (!byeMatch.nextMatch) continue;
      
      // 승자 결정 (실제 선수만)
      let winner: User | undefined = undefined;
      let winnerOrigin: PlayerOrigin | undefined = undefined;
      
      if (byeMatch.player1 && !byeMatch.player2) {
        winner = byeMatch.player1;
        winnerOrigin = byeMatch.player1Origin;
      } else if (!byeMatch.player1 && byeMatch.player2) {
        winner = byeMatch.player2;
        winnerOrigin = byeMatch.player2Origin;
      } else {
        // 둘 다 있거나 둘 다 없는 경우는 건너뛰기
        continue;
      }
      
      // 다음 라운드 매치 찾기
      const nextMatch = nextMatchMap.get(byeMatch.nextMatch.id);
      if (!nextMatch) continue;
      
      // 승자를 다음 라운드에 배정
      if (byeMatch.nextMatchPosition === 1) {
        nextMatch.player1 = { id: winner.id } as User;
        nextMatch.player1Origin = winnerOrigin;
      } else {
        nextMatch.player2 = { id: winner.id } as User;
        nextMatch.player2Origin = winnerOrigin;
      }
      
      console.log(`부전승: ${winner.id}가 매치 ${nextMatch.id}로 자동 진출`);
      
      // 변경된 매치 추가 (부전승 매치와 다음 라운드 매치)
      if (!updatedNextMatches.includes(byeMatch)) {
        updatedNextMatches.push(byeMatch);
      }
      
      if (!updatedNextMatches.includes(nextMatch)) {
        updatedNextMatches.push(nextMatch);
      }
    }
    
    // byeMatchIndices를 기반으로 추가적인 첫 라운드 매치 처리
    for (let i = 0; i < byeMatchIndices.length; i++) {
      const matchIndex = byeMatchIndices[i];
      
      // 첫 라운드 매치 찾기
      const firstRoundMatches = allMatches.filter(match => 
        Math.log2(allMatches.length) === match.round);
      
      if (matchIndex >= firstRoundMatches.length) continue;
      
      const byeMatch = firstRoundMatches[matchIndex];
      
      if (!byeMatch || !byeMatch.nextMatch || byeMatch.status === MatchStatus.BYE) continue;
      
      // 이미 위에서 처리했으면 건너뛰기
      if (updatedNextMatches.includes(byeMatch)) continue;
      
      // 상태가 BYE가 아니라면 설정
      byeMatch.status = MatchStatus.BYE;
      
      // 승자 결정 (player1이 있으면 player1, 없으면 player2)
      let winner: User | undefined = undefined;
      let winnerOrigin: PlayerOrigin | undefined = undefined;
      
      if (byeMatch.player1) {
        winner = byeMatch.player1;
        winnerOrigin = byeMatch.player1Origin;
      } else if (byeMatch.player2) {
        winner = byeMatch.player2;
        winnerOrigin = byeMatch.player2Origin;
      } else {
        continue;
      }
      
      // 다음 라운드 매치 찾기
      const nextMatch = nextMatchMap.get(byeMatch.nextMatch.id);
      if (!nextMatch) continue;
      
      // 승자를 다음 라운드에 배정
      if (byeMatch.nextMatchPosition === 1) {
        nextMatch.player1 = { id: winner.id } as User;
        nextMatch.player1Origin = winnerOrigin;
      } else {
        nextMatch.player2 = { id: winner.id } as User;
        nextMatch.player2Origin = winnerOrigin;
      }
      
      console.log(`부전승(인덱스): ${winner.id}가 매치 ${nextMatch.id}로 자동 진출`);
      
      // 변경된 매치 추가 (부전승 매치와 다음 라운드 매치)
      updatedNextMatches.push(byeMatch);
      
      if (!updatedNextMatches.includes(nextMatch)) {
        updatedNextMatches.push(nextMatch);
      }
    }
    
    return updatedNextMatches;
  }
} 