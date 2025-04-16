import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StageStrategy } from './stage-strategy.interface';
import { Stage } from '../../../entities/stage.entity';
import { Match, MatchStatus, PlayerOrigin } from '../../../entities/match.entity';
import { User } from '../../../entities/user.entity';
import { Group } from '../../../entities/group.entity';
import { TournamentOptions } from '../../../common/types/stage-options.type';
import { StageType } from '../../../common/enums/stage-type.enum';
import { LeagueParticipant } from '../../../entities/league-participant.entity';
import { PlayerInGroup } from '../../../entities/player-in-group.entity';
import { In } from 'typeorm';

@Injectable()
export class TournamentStageStrategy implements StageStrategy {
  constructor(
    @InjectRepository(Match)
    private matchRepository: Repository<Match>,
    @InjectRepository(Group)
    private groupRepository: Repository<Group>,
    @InjectRepository(Stage)
    private stageRepository: Repository<Stage>,
    @InjectRepository(LeagueParticipant)
    private participantRepository: Repository<LeagueParticipant>,
  ) {}

  async createGroups(stage: Stage, players: User[]): Promise<void> {
    // 토너먼트는 그룹이 없음
    return;
  }

  async createMatches(stage: Stage): Promise<void> {
    console.log(`====== 매치 생성 시작: 스테이지 ID ${stage.id} ======`);
    
    // 1. 기존 매치가 있는지 확인하고 있으면 완전히 삭제
    const existingMatches = await this.matchRepository.find({
      where: { stage: { id: stage.id } },
      relations: ['nextMatch']
    });
    
    if (existingMatches.length > 0) {
      console.log(`기존 매치 ${existingMatches.length}개 삭제 시작`);
      // 먼저 관계 제거 (외래 키 제약조건 오류 방지)
      for (const match of existingMatches) {
        match.nextMatch = undefined;
        match.nextMatchPosition = undefined;
      }
      await this.matchRepository.save(existingMatches);
      
      // 이제 매치 삭제
      const deleteResult = await this.matchRepository.delete(existingMatches.map(m => m.id));
      console.log(`기존 매치 삭제 완료: ${deleteResult.affected || 0}개 삭제됨`);
    }
    
    // 2. 진출자 수를 기반으로 토너먼트 크기 결정
    const playerCount = await this.calculateQualifiedPlayerCount(stage);
    console.log(`진출자 수 계산 결과: ${playerCount}명`);
    
    // 플레이어 수가 0인 경우 기본값 설정 (최소 2명으로 처리)
    const effectivePlayerCount = Math.max(2, playerCount);
    
    console.log(`진출자 예상: ${playerCount}명, 실제 설정값: ${effectivePlayerCount}명`);
    
    // 예상 진출자가 없는 경우, 경고 표시
    if (playerCount === 0) {
      console.warn('예상 진출자가 없습니다. 최소 2명으로 매치를 생성합니다.');
    }
    
    // 3. 토너먼트 라운드 수 계산 
    const requiredRounds = this.calculateRequiredRounds(effectivePlayerCount);
    console.log(`라운드 수 계산 결과: ${requiredRounds}라운드`);
    
    // 특수 로직: 6명 이상인 경우 강제로 8강(3라운드)으로 진행
    let finalRounds = requiredRounds;
    if (effectivePlayerCount >= 5 && effectivePlayerCount <= 8 && finalRounds < 3) {
      console.log(`플레이어 수가 ${effectivePlayerCount}명이지만 계산된 라운드가 ${finalRounds}입니다. 강제로 3라운드(8강)으로 설정합니다.`);
      finalRounds = 3;
    }
    
    const totalSlots = Math.pow(2, finalRounds);
    console.log(`최종 라운드 수: ${finalRounds}, 총 슬롯: ${totalSlots}`);
    
    const options = stage.options as TournamentOptions;
    
    // 4. 매치 생성 시작
    const matches: Partial<Match>[] = [];
    const matchesByRound: Partial<Match>[][] = [];
    
    // 모든 라운드에 대한 빈 배열 준비
    for (let i = 0; i < finalRounds; i++) {
      matchesByRound.push([]);
    }
    
    // 5. 첫 경기 라운드(마지막 라운드) 매치 생성 
    const firstRound = finalRounds;
    const firstRoundMatchCount = Math.pow(2, firstRound - 1);
    const roundName = this.getRoundName(firstRound);
    
    // 실제 선수 배정이 필요한 매치 수 계산 (부전승 고려)
    const matchesNeeded = Math.ceil(effectivePlayerCount / 2);
    const byeCount = totalSlots - effectivePlayerCount;
    
    console.log(`첫 라운드(${roundName}) 매치 수: ${firstRoundMatchCount}, 실제 필요 매치: ${matchesNeeded}, 부전승: ${byeCount}`);
    console.log(`매치 생성 시작: ${finalRounds} 라운드, 첫 라운드 매치 ${firstRoundMatchCount}개`);
    
    // 첫 라운드 매치 생성
    for (let i = 0; i < firstRoundMatchCount; i++) {
      const match: Partial<Match> = {
        stage,
        round: firstRound,
        groupNumber: i + 1,
        description: `${roundName} ${i + 1}경기`,
        order: i + 1, 
        status: MatchStatus.SCHEDULED
      };
      matches.push(match);
      matchesByRound[firstRound - 1].push(match);
    }
    
    // 6. 이전 라운드들 생성 (결승부터 시작해서 역순으로)
    for (let round = firstRound - 1; round >= 1; round--) {
      const matchesInRound = Math.pow(2, round - 1);
      const roundName = this.getRoundName(round);
      
      console.log(`${round}라운드(${roundName}) 매치 ${matchesInRound}개 생성`);
      
      for (let i = 0; i < matchesInRound; i++) {
        const match: Partial<Match> = {
          stage,
          round,
          groupNumber: i + 1,
          description: `${roundName} ${i + 1}경기`,
          order: i + 1,
          status: MatchStatus.SCHEDULED
        };
        matches.push(match);
        matchesByRound[round - 1].push(match);
      }
    }
    
    // 7. 매치 연결 설정 (하위 라운드에서 상위 라운드로)
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
            console.log(`매치 연결: ${currentRoundMatches[i].description} -> ${nextMatch.description} (위치 1)`);
          }
          
          // 두 번째 매치 연결
          if (i + 1 < currentRoundMatches.length) {
            currentRoundMatches[i + 1].nextMatch = nextMatch as Match;
            currentRoundMatches[i + 1].nextMatchPosition = 2;
            console.log(`매치 연결: ${currentRoundMatches[i+1].description} -> ${nextMatch.description} (위치 2)`);
          }
        }
      }
    }
    
    // 8. 매치 저장
    const savedMatches = await this.matchRepository.save(matches);
    console.log(`토너먼트용 매치 ${savedMatches.length}개 생성 완료 (${finalRounds} 라운드)`);
    
    // 최종 매치 요약 로그
    const matchesByRoundCount = {};
    for (const match of savedMatches) {
      matchesByRoundCount[match.round] = (matchesByRoundCount[match.round] || 0) + 1;
    }
    
    Object.keys(matchesByRoundCount).forEach(round => {
      console.log(`${round}라운드: ${matchesByRoundCount[round]}개 매치`);
    });
    
    console.log(`====== 매치 생성 완료: 스테이지 ID ${stage.id} ======`);
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
    console.log(`====== 시드 배정 시작: 스테이지 ID ${stage.id} ======`);
    
    // 1. 예선 순위에 따라 플레이어 배열 구성
    console.log(`예선 플레이어 정보 조회 시작`);
    let rankedPlayers = await this.getRankedPlayersFromPreliminary(stage);
    
    // 플레이어 정보 로깅 (간단하게)
    console.log(`플레이어 정보 조회 결과: ${rankedPlayers.length}명`);
    if (rankedPlayers.length > 0) {
      console.log('처음 10명 플레이어:', rankedPlayers.slice(0, 10).map(p => ({
        id: p.id,
        userId: p.userId,
        name: p.name
      })));
    }
    
    if (!rankedPlayers.length) {
      console.error('시드 배정할 플레이어가 없습니다.');
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
    
    // 특수 로직: 6명 이상인 경우 강제로 8강(3라운드)으로 진행
    let finalRounds = requiredRounds;
    if (rankedPlayers.length >= 5 && rankedPlayers.length <= 8 && finalRounds < 3) {
      console.log(`플레이어 수가 ${rankedPlayers.length}명이지만 계산된 라운드가 ${finalRounds}입니다. 강제로 3라운드(8강)으로 설정합니다.`);
      finalRounds = 3;
    }
    
    const tournamentSize = Math.pow(2, finalRounds);
    
    console.log(`토너먼트 구성: 플레이어 ${rankedPlayers.length}명, 라운드 ${finalRounds}개, 총 슬롯 ${tournamentSize}개`);
    
    // 3. 모든 매치 가져오기
    const allMatches = await this.matchRepository.find({
      where: { stage: { id: stage.id } },
      relations: ['player1', 'player2', 'nextMatch'],
      order: { round: 'DESC', order: 'ASC' }
    });
    console.log('조회된 매치 수:', allMatches.length);
    
    // 매치 수에 문제가 있는지 확인
    if (allMatches.length === 0) {
      console.error('할당할 매치가 없습니다! createMatches를 먼저 실행해야 합니다.');
      return;
    }
    
    // 4. 각 라운드별 매치 정리
    const matchesByRound: Match[][] = [];
    for (let i = 1; i <= finalRounds; i++) {
      const roundMatches = allMatches.filter(match => match.round === i);
      matchesByRound.push(roundMatches);
      console.log(`${i}라운드(${this.getRoundName(i)}) 매치 수:`, roundMatches.length);
    }
    
    // 실제 가장 높은 라운드 찾기
    const highestRound = Math.max(...allMatches.map(m => m.round));
    console.log(`실제 가장 높은 라운드: ${highestRound} (${this.getRoundName(highestRound)})`);
    
    // 5. 첫 라운드 매치 (가장 높은 라운드)
    const firstRoundMatches = allMatches.filter(match => match.round === highestRound);
    console.log(`첫 라운드(${this.getRoundName(highestRound)}) 매치 수: ${firstRoundMatches.length}`);
    
    if (firstRoundMatches.length === 0) {
      console.error('첫 라운드 매치를 찾을 수 없습니다!');
      return;
    }
    
    // 매치 수가 충분한지 확인하고, 충분하지 않으면 매치 재생성
    if (firstRoundMatches.length * 2 < rankedPlayers.length) {
      console.error(`현재 매치 수(${firstRoundMatches.length})로는 모든 선수(${rankedPlayers.length}명)를 배정할 수 없습니다!`);
      console.log('매치를 다시 생성합니다...');
      
      // 기존 매치 삭제 후 새로 생성
      await this.recreateMatches(stage, rankedPlayers.length);
      
      // 재귀 호출 (무한 루프 방지를 위해 한 번만 재시도)
      console.log('매치 재생성 후 시드 배정 다시 시도');
      const hasRetry = stage.options as any;
      
      if (!hasRetry.seedRetry) {
        hasRetry.seedRetry = true;
        return this.assignSeeds(stage);
      } else {
        console.error('이미 한 번 재시도했습니다. 매치 생성에 문제가 있습니다.');
        return;
      }
    }
    
    // 6. 플레이어 출신 정보 가져오기
    console.log(`플레이어 출신 정보 조회 시작 (${rankedPlayers.length}명)`);
    const playerOrigins = await this.getPlayerOrigins(stage, rankedPlayers.map(p => p.userId));
    console.log(`플레이어 출신 정보 조회 완료: ${Object.keys(playerOrigins).length}/${rankedPlayers.length}명`);
    
    // 모든 플레이어의 출신 정보 확인
    const missingOrigins = rankedPlayers.filter(p => !playerOrigins[p.userId]);
    if (missingOrigins.length > 0) {
      console.warn(`${missingOrigins.length}명의 플레이어 출신 정보가 없습니다:`);
      missingOrigins.forEach(p => {
        console.warn(`- ${p.name}(ID: ${p.userId})`);
        // 기본 출신 정보 추가
        playerOrigins[p.userId] = {
          groupId: 0,
          groupName: '정보없음',
          rank: 0,
          seed: '?'
        };
      });
    }
    
    // 7. 토너먼트 시드 배정 계획 작성
    console.log(`시드 배정 계획 작성 시작: 플레이어 ${rankedPlayers.length}명, 매치 ${firstRoundMatches.length}개`);
    const {
      matchAssignments,
      matchesWithByes
    } = this.createTournamentSeedPlan(rankedPlayers, playerOrigins, firstRoundMatches.length);
    
    console.log(`시드 배정 계획 완료: 매치 ${matchAssignments.length}개, 부전승 ${matchesWithByes.length}개`);
    
    if (matchAssignments.length === 0) {
      console.error('매치 배정 계획이 없습니다!');
      return;
    }
    
    // 매치 배정 계획 디버깅 로그
    matchAssignments.forEach((assignment, idx) => {
      console.log(`매치 ${idx+1}: ${assignment.player1?.name || 'None'} vs ${assignment.player2?.name || 'None'} (부전승: ${assignment.isBye})`);
    });
    
    // 8. 계획에 따라 실제 매치에 선수 배정
    const processedMatches: Match[] = [];
    
    // 선수 배정 전 매치 상태 확인
    console.log('선수 배정 전 매치 상태:');
    for (const match of firstRoundMatches) {
      console.log(`매치 ID ${match.id}: player1=${match.player1?.name || 'none'}, player2=${match.player2?.name || 'none'}`);
    }
    
    // 배정 진행
    for (let i = 0; i < firstRoundMatches.length; i++) {
      if (i >= matchAssignments.length) {
        console.warn(`매치 인덱스 ${i}에 대한 배정 정보가 없습니다. 건너뜁니다.`);
        continue;
      }
      
      const match = firstRoundMatches[i];
      const assignment = matchAssignments[i];
      
      if (!assignment) {
        console.log(`매치 ${i}에 대한 배정 정보가 없습니다.`);
        continue;
      }
      
      console.log(`매치 ${i+1} 배정 처리 중 (ID: ${match.id}):`);
      
      // 플레이어 1 배정
      if (assignment.player1) {
        match.player1 = assignment.player1;
        match.player1Origin = assignment.player1Origin;
        console.log(`- 플레이어1: ${assignment.player1.name} (ID: ${assignment.player1.id})`);
      } else {
        match.player1 = undefined;
        match.player1Origin = undefined;
        console.log(`- 플레이어1: 없음`);
      }
      
      // 플레이어 2 배정
      if (assignment.player2) {
        match.player2 = assignment.player2;
        match.player2Origin = assignment.player2Origin;
        console.log(`- 플레이어2: ${assignment.player2.name} (ID: ${assignment.player2.id})`);
      } else {
        match.player2 = undefined;
        match.player2Origin = undefined;
        console.log(`- 플레이어2: 없음`);
      }
      
      // 부전승 처리
      if (assignment.isBye || 
          (assignment.player1 && !assignment.player2) || 
          (!assignment.player1 && assignment.player2)) {
        match.status = MatchStatus.BYE;
        console.log(`- 매치 ${match.id}: 부전승 처리됨`);
      }
      
      processedMatches.push(match);
    }
    
    // 9. 첫 라운드 매치 저장
    if (processedMatches.length > 0) {
      console.log(`${processedMatches.length}개의 첫 라운드 매치 저장 시작`);
      const savedMatches = await this.matchRepository.save(processedMatches);
      console.log('저장된 매치:', savedMatches.map(m => ({
        id: m.id,
        player1: m.player1 ? `${m.player1.name} (${m.player1.id})` : 'none',
        player2: m.player2 ? `${m.player2.name} (${m.player2.id})` : 'none',
        status: m.status
      })));
    }
    
    // 10. 부전승으로 인한 다음 라운드 진출 처리
    const nextRoundMatches = await this.processAutomaticAdvancement(allMatches, matchesWithByes);
    
    // 11. 다음 라운드 매치 저장
    if (nextRoundMatches.length > 0) {
      console.log(`부전승으로 인한 ${nextRoundMatches.length}개의 다음 라운드 매치 업데이트 시작`);
      const savedNextMatches = await this.matchRepository.save(nextRoundMatches);
      console.log('업데이트된 다음 라운드 매치:', savedNextMatches.map(m => ({
        id: m.id,
        player1: m.player1 ? `${m.player1.name} (${m.player1.id})` : 'none',
        player2: m.player2 ? `${m.player2.name} (${m.player2.id})` : 'none',
        status: m.status
      })));
    }
  }

  // 필요한 토너먼트 라운드 수 계산 (8명 = 3라운드, 16명 = 4라운드)
  private calculateRequiredRounds(playerCount: number): number {
    // 입력값 로깅
    console.log(`====== 토너먼트 라운드 계산 시작: 플레이어 수 = ${playerCount} ======`);
    
    if (playerCount <= 0) {
      console.log('플레이어 수가 0 이하입니다. 기본값 1 반환');
      return 1;
    }
    
    // 명시적인 케이스 처리 (더 안전함)
    let requiredRounds: number;
    
    if (playerCount <= 2) {
      requiredRounds = 1; // 결승전만
      console.log('1-2명: 1라운드(결승)');
    } else if (playerCount <= 4) {
      requiredRounds = 2; // 4강
      console.log('3-4명: 2라운드(4강)');
    } else if (playerCount <= 8) {
      requiredRounds = 3; // 8강
      console.log('5-8명: 3라운드(8강)');
    } else if (playerCount <= 16) {
      requiredRounds = 4; // 16강
      console.log('9-16명: 4라운드(16강)');
    } else if (playerCount <= 32) {
      requiredRounds = 5; // 32강
      console.log('17-32명: 5라운드(32강)');
    } else if (playerCount <= 64) {
      requiredRounds = 6; // 64강
      console.log('33-64명: 6라운드(64강)');
    } else {
      // 일반적인 케이스 처리 (드문 경우)
      requiredRounds = Math.ceil(Math.log2(playerCount));
      console.log(`${playerCount}명: 계산된 라운드 수 = ${requiredRounds}`);
    }
    
    // 결과 로깅: 라운드 수와 토너먼트 크기
    const tournamentSize = Math.pow(2, requiredRounds);
    console.log(`최종 라운드 수: ${requiredRounds} (토너먼트 크기: ${tournamentSize}명)`);
    console.log(`1라운드는 결승, ${requiredRounds}라운드는 ${Math.pow(2, requiredRounds-1) * 2}강`);
    console.log(`====== 토너먼트 라운드 계산 완료 ======`);
    
    return requiredRounds;
  }

  // 중복 플레이어 제거
  private getUniquePlayers(players: LeagueParticipant[]): LeagueParticipant[] {
    const uniquePlayerMap = new Map<string, LeagueParticipant>();
    
    for (const player of players) {
      if (!uniquePlayerMap.has(player.userId)) {
        uniquePlayerMap.set(player.userId, player);
      }
    }
    
    return Array.from(uniquePlayerMap.values());
  }

  private async getRankedPlayersFromPreliminary(stage: Stage): Promise<LeagueParticipant[]> {
    console.log('getRankedPlayersFromPreliminary 시작 - 스테이지 ID:', stage.id);
    
    const previousStage = await this.getPreviousStage(stage);
    if (!previousStage) {
      console.error(`이전 스테이지를 찾을 수 없습니다. (스테이지 ID: ${stage.id})`);
      return [];
    }

    console.log(`이전 스테이지 정보:`, {
      id: previousStage.id,
      name: previousStage.name,
      type: previousStage.type,
      leagueId: previousStage.league?.id
    });

    try {
      // 예선 그룹 조회 - 더 많은 관계 포함
      let groups = await this.groupRepository.find({
        where: { stage: { id: previousStage.id } },
        relations: ['players', 'players.user', 'stage', 'stage.league'],
        order: { number: 'ASC' }, // 조 번호 순서대로 정렬
      });
  
      console.log(`조회된 그룹 수: ${groups.length}`);
      groups.forEach(group => {
        console.log(`그룹 ${group.number} 정보:`, {
          id: group.id,
          name: group.name,
          playerCount: group.players.length,
          players: group.players.map(p => ({
            id: p.user.id,
            name: p.user.name,
            rank: p.rank
          }))
        });
      });
  
      // 그룹이 없으면 디버깅 정보 추가
      if (groups.length === 0) {
        console.error(`스테이지 ${previousStage.id}에서 그룹을 찾을 수 없습니다.`);
  
        // 직접 스테이지 ID로 그룹 찾기 시도
        const allGroups = await this.groupRepository.find({
          relations: ['players', 'players.user', 'stage', 'stage.league'],
        });
        console.log(`전체 그룹 수: ${allGroups.length}`);
        console.log('전체 그룹 목록:', allGroups.map(g => ({
          id: g.id,
          name: g.name,
          stageId: g.stage?.id,
          playerCount: g.players.length
        })));
        
        groups = allGroups.filter(g => g.stage?.id === previousStage.id);
        
        if (groups.length === 0) {
          console.error('이전 스테이지에 해당하는 그룹을 찾지 못했습니다.');
          return [];
        }
      }
  
      const options = stage.options as TournamentOptions;
      const qualificationCriteria = options.seeding?.qualificationCriteria || { rankCutoff: 2, minRank: 1 };
      const { rankCutoff = 2, minRank = 1, maxRank } = qualificationCriteria;
      
      // 최종 랭크 범위 결정
      const effectiveMaxRank = maxRank || rankCutoff;
      const effectiveMinRank = minRank || 1;
      
      console.log(`랭크 설정:`, {
        rankCutoff,
        minRank,
        maxRank,
        effectiveMinRank,
        effectiveMaxRank
      });
      
      // 각 조별 랭킹 수집 및 가공
      const playersByRank: LeagueParticipant[][] = [];
      for (let i = 0; i < (effectiveMaxRank - effectiveMinRank + 1); i++) {
        playersByRank.push([]);
      }
      
      // 리그 참가자 정보 미리 조회 (성능 향상)
      const allPlayers = await this.participantRepository.find();
      console.log(`전체 리그 참가자 수: ${allPlayers.length}명`);
      
      // 플레이어ID - LeagueParticipant 매핑
      const playerMap = new Map<string, LeagueParticipant>();
      for (const player of allPlayers) {
        playerMap.set(player.userId, player);
      }
      
      // 각 조별로 플레이어 순위 계산 및 분류
      for (const group of groups) {
        console.log(`그룹 ${group.number} 처리 시작`);
        
        const rankedPlayers = await this.getRankedPlayersInGroup(group, playerMap);
        console.log(`${group.number}조 전체 플레이어 수: ${rankedPlayers.length}명`);
        
        if (rankedPlayers.length === 0) {
          console.error(`${group.number}조에서 플레이어 정보를 찾을 수 없습니다.`);
          continue;
        }
        
        // 조별 지정된 랭크 범위의 플레이어만 저장 (수정된 부분)
        for (let rank = effectiveMinRank; rank <= effectiveMaxRank; rank++) {
          const rankIndex = rank - effectiveMinRank; // 0부터 시작하는 배열 인덱스 계산
          const playerIndex = rank - 1; // 0부터 시작하는 배열에서 해당 랭크 인덱스 (1등은 인덱스 0)
          
          // 플레이어가 있는 경우만 추가 (없으면 해당 랭크는 비어있음)
          if (playerIndex >= 0 && playerIndex < rankedPlayers.length) {
            const player = rankedPlayers[playerIndex];
            if (player) {
              if (rankIndex >= 0 && rankIndex < playersByRank.length) {
                playersByRank[rankIndex].push(player);
                console.log(`${group.number}조 ${rank}등 플레이어 추가:`, {
                  id: player.id,
                  userId: player.userId,
                  name: player.name,
                  rankIndex
                });
              } else {
                console.error(`오류: 배열 인덱스(${rankIndex})가 범위를 벗어남 (0-${playersByRank.length-1})`);
              }
            } else {
              console.log(`${group.number}조 ${rank}등 플레이어가 없습니다.`);
            }
          } else {
            console.log(`${group.number}조 ${rank}등 플레이어가 없습니다 (인덱스 범위 초과).`);
          }
        }
        
        console.log(`${group.number}조: 랭크 범위 ${effectiveMinRank}-${effectiveMaxRank} 진출자 추가 완료`);
      }
      
      // 최종 시드 배정 결과 배열
      const seededPlayers: LeagueParticipant[] = [];
      
      // 시드 순서대로 플레이어 배열 구성 (각 랭크 그룹 내에서 조 번호순)
      for (let rank = 0; rank < playersByRank.length; rank++) {
        const playersInRank = playersByRank[rank];
        if (playersInRank?.length > 0) {
          // 동일 랭크 내 선수는 조 번호순 정렬
          console.log(`${rank+effectiveMinRank}등 플레이어 ${playersInRank.length}명 시드 배정`);
          seededPlayers.push(...playersInRank);
        } else {
          console.log(`${rank+effectiveMinRank}등 플레이어가 없습니다.`);
        }
      }
      
      // 최종 시드 배열 로그
      console.log(`최종 시드 배열 (${seededPlayers.length}명):`, seededPlayers.map((p, i) => ({
        seedNumber: i + 1,
        id: p.id,
        userId: p.userId,
        name: p.name
      })));
      
      return seededPlayers;
    } catch (error) {
      console.error('플레이어 정보 처리 중 오류:', error);
      return [];
    }
  }
  
  private async getRankedPlayersInGroup(
    group: Group,
    playerMap?: Map<string, LeagueParticipant>
  ): Promise<LeagueParticipant[]> {
    // PlayerInGroup의 rank 필드를 사용하여 정렬
    console.log(`${group.number}조 순위 계산 방식: PlayerInGroup의 rank 필드 사용`);
    
    // rank 필드로 정렬된 플레이어 목록 반환
    const playersByRank = [...group.players].sort((a, b) => a.rank - b.rank);
    
    // playerMap이 제공되지 않은 경우에만 DB 조회
    if (!playerMap) {
      // 각 PlayerInGroup을 LeagueParticipant로 변환
      const participants = await this.participantRepository.find({
        where: {
          userId: In(playersByRank.map(p => p.user.userId)),
        }
      });
      
      // PlayerInGroup의 순서를 유지하면서 LeagueParticipant 매핑
      const sortedParticipants = playersByRank.map(pig => 
        participants.find(p => p.userId === pig.user.userId)
      ).filter((p): p is LeagueParticipant => p !== undefined);
      
      // 로그 출력
      sortedParticipants.forEach((participant, index) => {
        console.log(`${group.number}조 ${index + 1}등: ${participant.name} (ID: ${participant.userId})`);
      });
      
      return sortedParticipants;
    } else {
      // 미리 조회한 playerMap 사용
      const sortedParticipants = playersByRank
        .map(pig => playerMap.get(pig.user.userId))
        .filter((p): p is LeagueParticipant => p !== undefined);
      
      // 로그 출력
      sortedParticipants.forEach((participant, index) => {
        console.log(`${group.number}조 ${index + 1}등: ${participant.name} (ID: ${participant.userId})`);
      });
      
      return sortedParticipants;
    }
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

  private async getPlayerOrigins(stage: Stage, playerIds: string[]): Promise<Record<string, PlayerOrigin>> {
    try {
      const origins: Record<string, PlayerOrigin> = {};
      
      if (!playerIds || playerIds.length === 0) {
        console.log('플레이어 ID가 제공되지 않았습니다.');
        return origins;
      }
      
      console.log(`${playerIds.length}명의 플레이어 출신 정보 검색 중...`);
      
      const previousStage = await this.getPreviousStage(stage);
      if (!previousStage) {
        console.error('이전 스테이지를 찾을 수 없습니다.');
        return origins;
      }
  
      const groups = await this.groupRepository.find({
        where: { stage: { id: previousStage.id } },
        relations: ['players', 'players.user'],
        order: { number: 'ASC' },
      });
      
      console.log(`${groups.length}개 그룹 정보 조회 완료`);
  
      // 모든 플레이어 정보 미리 맵으로 구성
      const playerInGroupMap = new Map<string, { group: Group, rank: number }>();
      
      for (const group of groups) {
        // 먼저 플레이어별 랭킹 정보 계산
        const rankedPlayers = [...group.players].sort((a, b) => a.rank - b.rank);
        
        // 각 플레이어를 맵에 추가
        rankedPlayers.forEach((player, index) => {
          const userId = player.user.userId;
          playerInGroupMap.set(userId, {
            group: group,
            rank: index + 1  // 0-인덱스를 1-인덱스 랭크로 변환
          });
        });
      }
      
      // 각 요청된 플레이어 ID에 대해 출신 정보 채우기
      for (const userId of playerIds) {
        const playerInfo = playerInGroupMap.get(userId);
        
        if (playerInfo) {
          const { group, rank } = playerInfo;
          origins[userId] = {
            groupId: group.id,
            groupName: `${group.number}조`,
            rank: rank,
            seed: `${group.number}-${rank}`
          };
        } else {
          console.error(`플레이어 ID ${userId}의 그룹 정보를 찾을 수 없습니다.`);
        }
      }
      
      console.log(`${Object.keys(origins).length}/${playerIds.length}명의 플레이어 출신 정보 검색 완료`);
      return origins;
    } catch (error) {
      console.error('플레이어 출신 정보 검색 중 오류:', error);
      return {};
    }
  }

  private async getPreviousStage(stage: Stage): Promise<Stage | null> {
    console.log('getPreviousStage 시작:', {
      currentStageId: stage.id,
      currentStageType: stage.type,
      leagueId: stage.league?.id
    });
    
    // 토너먼트 타입이면 예선(GROUP) 스테이지를 찾음
    if (stage.type === StageType.TOURNAMENT) {
      const groupStage = await this.stageRepository.findOne({
        where: {
          league: { id: stage.league?.id },
          type: StageType.GROUP
        },
        relations: ['league']
      });
      
      console.log('예선 스테이지 조회 결과:', groupStage ? {
        id: groupStage.id,
        name: groupStage.name,
        type: groupStage.type,
        leagueId: groupStage.league?.id
      } : 'not found');
      
      return groupStage;
    }
    
    // 기존 로직 (order 기반)
    const previousStage = await this.stageRepository.findOne({
      where: {
        league: { id: stage.league.id },
        order: stage.order - 1,
      },
      relations: ['league']
    });
    
    console.log('이전 스테이지 조회 결과 (order 기반):', previousStage ? {
      id: previousStage.id,
      name: previousStage.name,
      type: previousStage.type,
      order: previousStage.order,
      leagueId: previousStage.league?.id
    } : 'not found');
    
    return previousStage;
  }

  async getAdvancingPlayers(stage: Stage): Promise<User[]> {
    // 토너먼트의 경우 결승전 승자가 우승자
    const finalMatch = await this.matchRepository.findOne({
      where: { stage: { id: stage.id } },
      relations: ['result', 'result.winner', 'result.winner.user'],
      order: { id: 'DESC' },
    });

    return finalMatch?.result?.winner ? [finalMatch.result.winner.user] : [];
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
        // 승자의 LeagueParticipant 정보 가져오기
        const winner = match.player1?.id === winnerId ? match.player1 : match.player2;
        
        if (!winner) {
          console.error(`승자(ID: ${winnerId})의 참가자 정보를 찾을 수 없습니다.`);
          return;
        }
        
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

  // 예선 진출자 수 계산
  private async calculateQualifiedPlayerCount(stage: Stage): Promise<number> {
    console.log(`====== 진출자 수 계산 시작: 스테이지 ID ${stage.id} ======`);
    
    const previousStage = await this.getPreviousStage(stage);
    if (!previousStage) {
      console.warn('이전 스테이지가 없습니다. 진출자 수 0 반환');
      return 0;
    }

    console.log(`이전 스테이지 정보: ID=${previousStage.id}, 이름=${previousStage.name}, 타입=${previousStage.type}`);

    const groups = await this.groupRepository.find({
      where: { stage: { id: previousStage.id } },
      relations: ['players'],
    });

    if (groups.length === 0) {
      console.warn('예선 그룹이 없습니다. 진출자 수 0 반환');
      return 0;
    }
    
    console.log(`총 ${groups.length}개 그룹이 조회됨`);
    // 각 그룹 정보 출력
    groups.forEach(group => {
      console.log(`그룹 ${group.number || '번호없음'}: ${group.players.length}명 플레이어`);
    });

    const options = stage.options as TournamentOptions;
    if (!options || !options.seeding) {
      console.warn('토너먼트 시딩 옵션이 없습니다. 기본값 사용');
    }
    
    const qualificationCriteria = options?.seeding?.qualificationCriteria || { rankCutoff: 2, minRank: 1 };
    const { rankCutoff = 2, minRank = 1, maxRank } = qualificationCriteria;
    
    // 최종 진출자 커트라인 결정 (maxRank가 있으면 우선 적용, 없으면 rankCutoff 사용)
    const effectiveMaxRank = maxRank || rankCutoff;
    const effectiveMinRank = minRank || 1;
    const effectiveRankCount = effectiveMaxRank - effectiveMinRank + 1;
    
    console.log(`진출자 커트라인 설정:`, {
      rankCutoff,
      minRank,
      maxRank,
      effectiveMinRank,
      effectiveMaxRank,
      effectiveRankCount,
      groupCount: groups.length
    });
    
    // 각 조별 진출자 수를 합산
    let totalPlayerCount = 0;
    const detailedCounts: Array<{
      group: string | number,
      total: number,
      advancing: number,
      rankRange: string
    }> = [];
    
    for (const group of groups) {
      // 실제 선수 수와 진출 커트라인 중 작은 값 사용
      const playersInGroup = group.players.length;
      const advancingPlayersFromGroup = Math.min(playersInGroup, effectiveRankCount);
      totalPlayerCount += advancingPlayersFromGroup;
      
      detailedCounts.push({
        group: group.number || '번호없음',
        total: playersInGroup,
        advancing: advancingPlayersFromGroup,
        rankRange: `${effectiveMinRank}~${effectiveMaxRank}`
      });
      
      console.log(`그룹 ${group.number || '미지정'}: 전체 ${playersInGroup}명 중 ${advancingPlayersFromGroup}명 진출 (랭크 ${effectiveMinRank}-${effectiveMaxRank})`);
    }
    
    console.log(`진출자 수 상세:`, detailedCounts);
    console.log(`최종 진출 예상 인원: ${totalPlayerCount}명`);
    console.log(`====== 진출자 수 계산 완료 ======`);
    
    // 무효한 값을 방지하기 위한 안전장치
    if (totalPlayerCount <= 0) {
      console.warn('계산된 진출자 수가 0명 이하입니다. 기본값 2 사용');
      return 2;
    }
    
    return totalPlayerCount;
  }

  // 부전승으로 인한 자동 진출 처리
  private async processAutomaticAdvancement(
    allMatches: Match[],
    byeMatchIndices: number[]
  ): Promise<Match[]> {
    const updatedNextMatches: Match[] = [];
    const nextMatchMap = new Map<number, Match>();
    const processedMatchIds = new Set<number>(); // 처리된 매치 ID 추적
    
    for (const match of allMatches) {
      if (match.nextMatch) {
        nextMatchMap.set(match.nextMatch.id, match.nextMatch);
      }
    }
    
    // 자동 부전승 대상 매치 찾기 (한 선수만 있거나, 아예 선수가 없는 매치)
    const byeMatches = allMatches.filter(match => 
      match.status === MatchStatus.BYE || 
      (!match.player1 && match.player2) || 
      (match.player1 && !match.player2) ||
      (!match.player1 && !match.player2) // 모든 선수가 없는 경우 추가 (실제로는 처리되지 않음)
    );
    
    console.log(`부전승 매치 찾기: ${byeMatches.length}개 발견`);
    
    // 반복적으로 부전승 처리 (재귀 대신 반복문 사용)
    let pendingMatches = [...byeMatches];
    const maxIterations = 10; // 최대 반복 횟수 제한
    let iteration = 0;
    
    while (pendingMatches.length > 0 && iteration < maxIterations) {
      iteration++;
      console.log(`부전승 처리 반복 ${iteration}, 처리할 매치 ${pendingMatches.length}개`);
      
      const nextPendingMatches: Match[] = [];
      
      for (const byeMatch of pendingMatches) {
        // 이미 처리한 매치는 건너뛰기
        if (processedMatchIds.has(byeMatch.id)) {
          continue;
        }
        
        // 처리된 것으로 표시
        processedMatchIds.add(byeMatch.id);
        
        // 부전승 상태로 설정
        byeMatch.status = MatchStatus.BYE;
        
        // 다음 매치가 없으면 건너뛰기
        if (!byeMatch.nextMatch) {
          console.log(`매치 ${byeMatch.id}는 다음 매치가 없습니다.`);
          continue;
        }
        
        // 승리자 결정
        let winner: LeagueParticipant | undefined = undefined;
        let winnerOrigin: PlayerOrigin | undefined = undefined;
        
        if (byeMatch.player1 && !byeMatch.player2) {
          // player1만 있는 경우
          winner = byeMatch.player1;
          winnerOrigin = byeMatch.player1Origin;
          console.log(`부전승: 매치 ${byeMatch.id}에서 ${winner.name}(ID: ${winner.id}) 자동 승리 (상대 없음)`);
        } else if (!byeMatch.player1 && byeMatch.player2) {
          // player2만 있는 경우
          winner = byeMatch.player2;
          winnerOrigin = byeMatch.player2Origin;
          console.log(`부전승: 매치 ${byeMatch.id}에서 ${winner.name}(ID: ${winner.id}) 자동 승리 (상대 없음)`);
        } else if (!byeMatch.player1 && !byeMatch.player2) {
          // 양쪽 다 플레이어가 없는 경우 (이 경우 실제로 진출할 플레이어가 없음)
          console.log(`매치 ${byeMatch.id}: 양쪽 모두 플레이어가 없습니다. 매치는 비어 있는 상태로 유지됩니다.`);
          continue;
        } else {
          // 양쪽 다 플레이어가 있지만 부전승으로 표시된 경우 (이상 상황)
          console.log(`경고: 매치 ${byeMatch.id}는 양쪽 플레이어가 모두 있는데 부전승으로 표시되어 있습니다.`);
          continue;
        }
        
        // 승자가 없으면 건너뛰기
        if (!winner) {
          console.log(`매치 ${byeMatch.id}: 부전승 처리할 승자가 없습니다.`);
          continue;
        }
        
        // 다음 매치에 승자 배정
        const nextMatch = nextMatchMap.get(byeMatch.nextMatch.id);
        if (!nextMatch) {
          console.log(`매치 ${byeMatch.id}의 다음 매치(ID: ${byeMatch.nextMatch.id})를 찾을 수 없습니다.`);
          continue;
        }
        
        // 다음 매치가 이미 처리된 경우 건너뛰기
        if (processedMatchIds.has(nextMatch.id)) {
          console.log(`매치 ${nextMatch.id}는 이미 처리되었습니다.`);
          continue;
        }
        
        // 승자를 다음 매치에 배정
        let wasUpdated = false;
        
        if (byeMatch.nextMatchPosition === 1) {
          nextMatch.player1 = winner;
          nextMatch.player1Origin = winnerOrigin;
          wasUpdated = true;
          console.log(`매치 ${byeMatch.id}의 승자(${winner.name})를 다음 매치 ${nextMatch.id}의 player1 위치에 배정`);
        } else if (byeMatch.nextMatchPosition === 2) {
          nextMatch.player2 = winner;
          nextMatch.player2Origin = winnerOrigin;
          wasUpdated = true;
          console.log(`매치 ${byeMatch.id}의 승자(${winner.name})를 다음 매치 ${nextMatch.id}의 player2 위치에 배정`);
        } else {
          console.log(`매치 ${byeMatch.id}의 nextMatchPosition이 설정되어 있지 않습니다.`);
          
          // 빈 슬롯에 배정
          if (!nextMatch.player1) {
            nextMatch.player1 = winner;
            nextMatch.player1Origin = winnerOrigin;
            wasUpdated = true;
            console.log(`매치 ${byeMatch.id}의 승자(${winner.name})를 다음 매치 ${nextMatch.id}의 빈 player1 위치에 배정`);
          } else if (!nextMatch.player2) {
            nextMatch.player2 = winner;
            nextMatch.player2Origin = winnerOrigin;
            wasUpdated = true;
            console.log(`매치 ${byeMatch.id}의 승자(${winner.name})를 다음 매치 ${nextMatch.id}의 빈 player2 위치에 배정`);
          } else {
            console.log(`경고: 다음 매치 ${nextMatch.id}의 양쪽 자리가 모두 차있습니다.`);
          }
        }
        
        // 다음 매치의 양쪽 플레이어가 모두 배정되었는지 확인
        if (nextMatch.player1 && nextMatch.player2) {
          console.log(`다음 매치 ${nextMatch.id}의 양쪽 플레이어 모두 배정 완료`);
          nextMatch.status = MatchStatus.SCHEDULED;
        } else if ((!nextMatch.player1 && nextMatch.player2) || (nextMatch.player1 && !nextMatch.player2)) {
          // 한쪽만 플레이어가 있는 경우 부전승 조건이 될 수 있음
          console.log(`다음 매치 ${nextMatch.id}에 한쪽 플레이어만 배정되었습니다. 다음 반복에서 부전승 처리 검토.`);
          nextMatch.status = MatchStatus.WAITING;
          nextPendingMatches.push(nextMatch); // 다음 반복에서 처리할 매치로 추가
        } else if (!nextMatch.player1 && !nextMatch.player2) {
          // 양쪽 다 플레이어가 없는 경우 부전승 조건이 될 수 있음
          console.log(`다음 매치 ${nextMatch.id}에 플레이어가 배정되지 않았습니다. 빈 상태로 유지됩니다.`);
          nextMatch.status = MatchStatus.BYE;
        }
        
        if (wasUpdated && !updatedNextMatches.includes(nextMatch)) {
          updatedNextMatches.push(nextMatch);
        }
        
        // 현재 매치 추가
        if (!updatedNextMatches.includes(byeMatch)) {
          updatedNextMatches.push(byeMatch);
        }
      }
      
      // 다음 반복에서 처리할 매치 설정 (중복 제거)
      pendingMatches = nextPendingMatches.filter(match => !processedMatchIds.has(match.id));
      
      if (pendingMatches.length === 0) {
        console.log('더 이상 처리할 부전승 매치가 없습니다.');
        break;
      }
    }
    
    // 이미 처리한 매치를 제외하고 지정된 부전승 인덱스 처리
    const firstRoundMatches = allMatches.filter(match => 
      Math.log2(allMatches.length) === match.round);
    
    for (let i = 0; i < byeMatchIndices.length; i++) {
      const matchIndex = byeMatchIndices[i];
      
      if (matchIndex >= firstRoundMatches.length) {
        console.log(`인덱스 ${matchIndex}가 첫 라운드 매치 수(${firstRoundMatches.length})를 초과합니다.`);
        continue;
      }
      
      const byeMatch = firstRoundMatches[matchIndex];
      
      // 이미 처리된 매치 건너뛰기
      if (!byeMatch || byeMatch.status === MatchStatus.BYE || processedMatchIds.has(byeMatch.id)) {
        continue;
      }
      
      // 부전승 처리
      processedMatchIds.add(byeMatch.id);
      byeMatch.status = MatchStatus.BYE;
      
      // 승자 결정 로직
      let winner: LeagueParticipant | undefined = undefined;
      let winnerOrigin: PlayerOrigin | undefined = undefined;
      
      if (byeMatch.player1 && !byeMatch.player2) {
        winner = byeMatch.player1;
        winnerOrigin = byeMatch.player1Origin;
      } else if (!byeMatch.player1 && byeMatch.player2) {
        winner = byeMatch.player2;
        winnerOrigin = byeMatch.player2Origin;
      } else if (byeMatch.player1 && byeMatch.player2) {
        // 양쪽 모두 플레이어가 있지만 부전승으로 처리된 경우
        console.log(`경고: 매치 ${byeMatch.id}는 양쪽 플레이어가 모두 있는데 부전승으로 처리됩니다.`);
        continue;
      } else {
        // 양쪽 모두 플레이어가 없는 경우
        console.log(`매치 ${byeMatch.id}에는 플레이어가 없습니다. 부전승 처리를 건너뜁니다.`);
        continue;
      }
      
      // 승자가 없으면 건너뛰기
      if (!winner) {
        console.log(`매치 ${byeMatch.id}: 부전승 처리할 승자가 없습니다.`);
        continue;
      }
      
      // 다음 매치에 승자 배정
      if (!byeMatch.nextMatch) {
        console.log(`매치 ${byeMatch.id}는 다음 매치가 없습니다.`);
        continue;
      }
      
      const nextMatch = nextMatchMap.get(byeMatch.nextMatch.id);
      if (!nextMatch) {
        console.log(`매치 ${byeMatch.id}의 다음 매치(ID: ${byeMatch.nextMatch.id})를 찾을 수 없습니다.`);
        continue;
      }
      
      if (byeMatch.nextMatchPosition === 1) {
        nextMatch.player1 = winner;
        nextMatch.player1Origin = winnerOrigin;
        console.log(`매치 ${byeMatch.id}의 승자(${winner.name})를 다음 매치 ${nextMatch.id}의 player1 위치에 배정`);
      } else if (byeMatch.nextMatchPosition === 2) {
        nextMatch.player2 = winner;
        nextMatch.player2Origin = winnerOrigin;
        console.log(`매치 ${byeMatch.id}의 승자(${winner.name})를 다음 매치 ${nextMatch.id}의 player2 위치에 배정`);
      } else {
        // 빈 슬롯에 배정
        if (!nextMatch.player1) {
          nextMatch.player1 = winner;
          nextMatch.player1Origin = winnerOrigin;
          console.log(`매치 ${byeMatch.id}의 승자(${winner.name})를 다음 매치 ${nextMatch.id}의 빈 player1 위치에 배정`);
        } else if (!nextMatch.player2) {
          nextMatch.player2 = winner;
          nextMatch.player2Origin = winnerOrigin;
          console.log(`매치 ${byeMatch.id}의 승자(${winner.name})를 다음 매치 ${nextMatch.id}의 빈 player2 위치에 배정`);
        } else {
          console.log(`경고: 다음 매치 ${nextMatch.id}의 양쪽 자리가 모두 차있습니다.`);
        }
      }
      
      // 다음 매치의 양쪽 플레이어가 모두 배정되었는지 확인
      if (nextMatch.player1 && nextMatch.player2) {
        console.log(`다음 매치 ${nextMatch.id}의 양쪽 플레이어 모두 배정 완료`);
        nextMatch.status = MatchStatus.SCHEDULED;
      }
      
      // 업데이트된 매치 추적
      updatedNextMatches.push(byeMatch);
      
      if (!updatedNextMatches.includes(nextMatch)) {
        updatedNextMatches.push(nextMatch);
      }
    }
    
    return updatedNextMatches;
  }

  /**
   * 스테이지 삭제 로직 - 외래 키 제약 조건 오류 방지를 위한 처리 포함
   * @param stageId 삭제할 스테이지 ID
   */
  async deleteStage(stageId: number): Promise<void> {
    console.log(`토너먼트 스테이지 ID ${stageId} 삭제 시작`);
    
    // 1. 스테이지의 모든 매치 조회
    const matches = await this.matchRepository.find({
      where: { stage: { id: stageId } },
      relations: ['nextMatch'],
    });
    
    console.log(`스테이지 ID ${stageId}에서 ${matches.length}개의 매치 조회됨`);
    
    if (matches.length === 0) {
      console.log(`스테이지 ID ${stageId}에 매치가 없어 스테이지만 삭제합니다.`);
      // 스테이지만 삭제
      await this.stageRepository.delete(stageId);
      return;
    }
    
    // 2. 먼저 모든 매치의 nextMatch 참조 제거
    console.log('매치 간 참조 관계 제거 시작');
    
    for (const match of matches) {
      if (match.nextMatch) {
        // nextMatch 참조 제거
        match.nextMatch = undefined;
        match.nextMatchPosition = undefined;
      }
    }
    
    // 업데이트된 매치 저장 (참조 관계 제거)
    await this.matchRepository.save(matches);
    console.log('모든 매치의 nextMatch 참조 제거 완료');
    
    // 3. 이제 모든 매치를 개별적으로 삭제
    try {
      // 직접적인 쿼리를 사용하지 않고 엔티티를 통해 삭제
      console.log('개별 매치 삭제 시작');
      
      // QueryRunner를 사용하여 트랜잭션 내에서 처리
      const queryRunner = this.matchRepository.manager.connection.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      
      try {
        // 매치 ID 목록 수집
        const matchIds = matches.map(match => match.id);
        
        // 매치 결과 먼저 삭제 (있는 경우)
        await queryRunner.manager.query(
          `DELETE FROM match_result WHERE match_id IN (?)`,
          [matchIds]
        );
        console.log('매치 결과 삭제 완료');
        
        // 다음 매치 연결 먼저 끊기 (외래 키 참조)
        await queryRunner.manager.query(
          `UPDATE \`match\` SET next_match_id = NULL WHERE stage_id = ?`,
          [stageId]
        );
        console.log('매치 참조 관계 끊기 완료');
        
        // 이제 매치 삭제
        await queryRunner.manager.query(
          `DELETE FROM \`match\` WHERE stage_id = ?`,
          [stageId]
        );
        console.log(`스테이지 ID ${stageId}의 모든 매치 삭제 완료`);
        
        // 트랜잭션 커밋
        await queryRunner.commitTransaction();
      } catch (error) {
        // 오류 발생시 롤백
        await queryRunner.rollbackTransaction();
        console.error('매치 삭제 중 오류 발생:', error);
        throw error;
      } finally {
        // QueryRunner 해제
        await queryRunner.release();
      }
    } catch (error) {
      console.error('매치 삭제 중 오류 발생:', error);
      throw error;
    }
    
    // 4. 마지막으로 스테이지 삭제
    await this.stageRepository.delete(stageId);
    console.log(`스테이지 ID ${stageId} 삭제 완료`);
  }

  // 토너먼트 시드 배정 계획 생성
  private createTournamentSeedPlan(
    players: LeagueParticipant[],
    playerOrigins: Record<string, PlayerOrigin>,
    matchCount: number
  ): {
    matchAssignments: {
      player1?: LeagueParticipant,
      player1Origin?: PlayerOrigin,
      player2?: LeagueParticipant,
      player2Origin?: PlayerOrigin,
      isBye: boolean
    }[],
    matchesWithByes: number[]
  } {
    console.log(`====== 토너먼트 시드 배정 계획 생성 시작 ======`);
    console.log(`플레이어 수: ${players.length}, 매치 수: ${matchCount}`);
    
    const totalPlayers = players.length;
    const totalSlots = matchCount * 2;
    const byeCount = totalSlots - totalPlayers;
    const tournamentSize = Math.pow(2, Math.ceil(Math.log2(totalPlayers)));
    
    console.log(`토너먼트 시드 배정 계획:`, {
      totalPlayers,
      matchCount,
      totalSlots,
      byeCount,
      tournamentSize
    });
    
    if (matchCount === 0) {
      console.error('오류: 매치 수가 0입니다.');
      return { matchAssignments: [], matchesWithByes: [] };
    }
    
    if (totalSlots < totalPlayers) {
      console.error(`오류: 현재 매치 수(${matchCount})로는 모든 선수(${totalPlayers}명)를 배정할 수 없습니다.`);
      console.error(`필요한 최소 매치 수: ${Math.ceil(totalPlayers / 2)}, 필요한 최소 라운드 수: ${Math.ceil(Math.log2(totalPlayers))}`);
      return { matchAssignments: [], matchesWithByes: [] };
    }
    
    // 결과 배열 초기화
    const matchAssignments: {
      player1?: LeagueParticipant,
      player1Origin?: PlayerOrigin,
      player2?: LeagueParticipant,
      player2Origin?: PlayerOrigin,
      isBye: boolean
    }[] = [];
    
    // 모든 매치 기본 데이터 초기화
    for (let i = 0; i < matchCount; i++) {
      matchAssignments.push({
        player1: undefined,
        player1Origin: undefined,
        player2: undefined,
        player2Origin: undefined,
        isBye: false
      });
    }
    
    // 표준 토너먼트 시드 순서 가져오기
    const seedOrder = this.getStandardSeedOrderFor(totalSlots);
    console.log(`시드 순서 생성 완료 (처음 10개): ${seedOrder.slice(0, 10).join(', ')}`);
    
    // 플레이어 정보 로깅 및 확인
    console.log(`플레이어 정보 확인:`);
    for (let i = 0; i < Math.min(5, players.length); i++) {
      const player = players[i];
      const origin = playerOrigins[player.userId];
      console.log(`${i+1}번 플레이어: ${player.name} (${origin ? `${origin.groupName} ${origin.rank}등` : '정보 없음'})`);
    }
    
    // 시드 순서에 따라 플레이어 배정
    const assignedPlayers = new Set<number>(); // 이미 배정된 플레이어 ID 추적
    
    // 플레이어를 표준 시드 순서에 맞게 배정
    for (let i = 0; i < Math.min(players.length, totalSlots); i++) {
      const seedNumber = i + 1; // 시드 번호 (1부터 시작)
      const seedPosition = seedOrder[i] - 1; // 배치 위치 (0부터 시작)
      const player = players[i];
      
      if (!player) {
        console.warn(`${seedNumber}번 시드 플레이어가 없습니다.`);
        continue;
      }
      
      if (assignedPlayers.has(player.id)) {
        console.warn(`플레이어 ${player.name}(ID: ${player.id})가 이미 배정되어 있습니다.`);
        continue;
      }
      
      // 해당 슬롯의 매치 인덱스와 위치(1 또는 2) 계산
      const matchIndex = Math.floor(seedPosition / 2);
      const position = (seedPosition % 2) + 1; // 1 또는 2
      
      if (matchIndex >= matchAssignments.length) {
        console.error(`오류: 계산된 매치 인덱스(${matchIndex})가 할당 가능한 매치 수(${matchAssignments.length})를 초과합니다.`);
        continue;
      }
      
      // 플레이어 출신 정보 가져오기
      const origin = playerOrigins[player.userId];
      
      // 플레이어 배정
      if (position === 1) {
        matchAssignments[matchIndex].player1 = player;
        matchAssignments[matchIndex].player1Origin = origin;
      } else {
        matchAssignments[matchIndex].player2 = player;
        matchAssignments[matchIndex].player2Origin = origin;
      }
      
      assignedPlayers.add(player.id);
      
      // 로그 출력
      console.log(`${seedNumber}번 시드 ${player.name} -> 매치 ${matchIndex + 1}의 플레이어${position} 위치에 배정`);
    }
    
    // 부전승 매치 처리
    const matchesWithByes: number[] = [];
    
    // 한 쪽만 플레이어가 있는 매치는 부전승 처리
    for (let i = 0; i < matchAssignments.length; i++) {
      const assignment = matchAssignments[i];
      const hasBye = (!assignment.player1 && assignment.player2) || 
                   (assignment.player1 && !assignment.player2);
      
      if (hasBye) {
        assignment.isBye = true;
        matchesWithByes.push(i);
        console.log(`매치 ${i + 1}: 부전승 처리 (${assignment.player1 ? `${assignment.player1.name} 혼자 참가` : `${assignment.player2!.name} 혼자 참가`})`);
      }
    }
    
    console.log(`부전승 처리된 매치: ${matchesWithByes.length}개`);
    console.log(`====== 토너먼트 시드 배정 계획 생성 완료 ======`);
    
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
    // 로그 출력
    console.log(`크기 ${size}의 토너먼트 시드 패턴 생성 중`);

    // 미리 정의된 패턴 (8, 16, 32명)
    if (size === 2) {
      return [1, 2];
    } else if (size === 4) {
      return [1, 4, 2, 3];
    } else if (size === 8) {
      return [1, 8, 5, 4, 3, 6, 7, 2];
    } else if (size === 16) {
      return [1, 16, 9, 8, 5, 12, 13, 4, 3, 14, 11, 6, 7, 10, 15, 2];
    } else if (size === 32) {
      return [
        1, 32, 17, 16, 9, 24, 25, 8, 5, 28, 21, 12, 13, 20, 29, 4,
        3, 30, 19, 14, 11, 22, 27, 6, 7, 26, 23, 10, 15, 18, 31, 2
      ];
    }

    // 다른 크기의 토너먼트는 표준 알고리즘으로 생성
    const result = new Array<number>(size);
    let power = 1;
    while (power < size) {
      power *= 2;
    }

    // 토너먼트 표준 패턴 생성
    // 1. 초기화
    for (let i = 0; i < size; i++) {
      result[i] = 0;
    }
    
    // 2. 패턴 생성
    result[0] = 1;  // 1번 시드
    if (size > 1) result[1] = 2;  // 2번 시드
    
    let pos = 2;
    for (let currentSize = 2; pos < size; currentSize *= 2) {
      for (let i = 0; i < currentSize && pos < size; i++) {
        // 기존 패턴 뒤집어서 붙이기
        result[pos++] = 2 * currentSize + 1 - result[i];
      }
    }
    
    // 결과 검증을 위한 로그
    console.log(`생성된 시드 패턴(${size}): ${result.slice(0, 16).join(',')}`);
    
    return result;
  }

  /**
   * 기존 매치를 삭제하고 플레이어 수에 맞게 매치를 다시 생성합니다.
   * @param stage 스테이지 정보
   * @param playerCount 플레이어 수
   */
  private async recreateMatches(stage: Stage, playerCount: number): Promise<void> {
    console.log(`매치 재생성 시작: 스테이지 ID ${stage.id}, 선수 수 ${playerCount}명`);
    
    // 1. 기존 매치 모두 삭제
    const existingMatches = await this.matchRepository.find({
      where: { stage: { id: stage.id } }
    });
    
    if (existingMatches.length > 0) {
      console.log(`${existingMatches.length}개의 기존 매치 삭제 중...`);
      
      // 매치 간 참조 관계 제거 (외래 키 제약조건 오류 방지)
      for (const match of existingMatches) {
        match.nextMatch = undefined;
        match.nextMatchPosition = undefined;
      }
      
      await this.matchRepository.save(existingMatches);
      await this.matchRepository.delete(existingMatches.map(m => m.id));
      console.log('기존 매치 삭제 완료');
    }
    
    // 2. 새 매치 생성 (플레이어 수 기반)
    console.log(`플레이어 수 ${playerCount}명에 맞게 새 매치 생성 중...`);
    
    // 토너먼트 라운드 수 계산
    const requiredRounds = this.calculateRequiredRounds(playerCount);
    const totalSlots = Math.pow(2, requiredRounds);
    
    console.log(`필요한 라운드 수: ${requiredRounds}, 총 슬롯: ${totalSlots}`);
    
    const newMatches: Partial<Match>[] = [];
    const matchesByRound: Partial<Match>[][] = [];
    
    // 라운드별 빈 배열 초기화
    for (let i = 0; i < requiredRounds; i++) {
      matchesByRound.push([]);
    }
    
    // 첫 라운드(마지막 라운드) 매치 생성
    const firstRound = requiredRounds;
    const firstRoundMatchCount = Math.pow(2, firstRound - 1);
    const roundName = this.getRoundName(firstRound);
    
    console.log(`첫 라운드(${roundName}) 매치 ${firstRoundMatchCount}개 생성`);
    
    // 첫 라운드 매치 생성
    for (let i = 0; i < firstRoundMatchCount; i++) {
      const match: Partial<Match> = {
        stage,
        round: firstRound,
        groupNumber: i + 1,
        description: `${roundName} ${i + 1}경기`,
        order: i + 1,
        status: MatchStatus.SCHEDULED
      };
      newMatches.push(match);
      matchesByRound[firstRound - 1].push(match);
    }
    
    // 이전 라운드 매치 생성 (결승부터 시작해서 역순으로)
    for (let round = firstRound - 1; round >= 1; round--) {
      const matchesInRound = Math.pow(2, round - 1);
      const roundName = this.getRoundName(round);
      
      console.log(`${roundName} 매치 ${matchesInRound}개 생성`);
      
      for (let i = 0; i < matchesInRound; i++) {
        const match: Partial<Match> = {
          stage,
          round,
          groupNumber: i + 1,
          description: `${roundName} ${i + 1}경기`,
          order: i + 1,
          status: MatchStatus.SCHEDULED
        };
        newMatches.push(match);
        matchesByRound[round - 1].push(match);
      }
    }
    
    // 일단 모든 매치를 먼저 저장하여 ID를 얻어옴
    const savedMatches = await this.matchRepository.save(newMatches);
    
    // 매치를 라운드별로 정리
    const savedMatchesByRound: Match[][] = [];
    for (let i = 0; i < requiredRounds; i++) {
      savedMatchesByRound.push([]);
    }
    
    // 저장된 매치들을 라운드별로 분류
    for (const match of savedMatches) {
      if (match.round && match.round <= requiredRounds) {
        savedMatchesByRound[match.round - 1].push(match);
      }
    }
    
    // 매치 연결 설정
    const matchesToUpdate: Match[] = [];
    
    for (let round = firstRound; round > 1; round--) {
      const currentRoundMatches = savedMatchesByRound[round - 1];
      const previousRoundMatches = savedMatchesByRound[round - 2];
      
      for (let i = 0; i < currentRoundMatches.length; i += 2) {
        const nextMatchIndex = Math.floor(i / 2);
        if (nextMatchIndex < previousRoundMatches.length) {
          const nextMatch = previousRoundMatches[nextMatchIndex];
          
          // 첫 번째 매치 연결
          if (i < currentRoundMatches.length) {
            const match = currentRoundMatches[i];
            match.nextMatch = nextMatch;
            match.nextMatchPosition = 1;
            matchesToUpdate.push(match);
          }
          
          // 두 번째 매치 연결
          if (i + 1 < currentRoundMatches.length) {
            const match = currentRoundMatches[i + 1];
            match.nextMatch = nextMatch;
            match.nextMatchPosition = 2;
            matchesToUpdate.push(match);
          }
        }
      }
    }
    
    // 업데이트된 매치들 저장
    if (matchesToUpdate.length > 0) {
      await this.matchRepository.save(matchesToUpdate);
    }
    
    console.log(`${savedMatches.length}개의 새 매치 생성 완료, ${matchesToUpdate.length}개의 매치 연결 설정`);
  }
} 