import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StageStrategy } from './stage-strategy.interface';
import { Stage } from '../../../entities/stage.entity';
import { Group } from '../../../entities/group.entity';
import { PlayerInGroup } from '../../../entities/player-in-group.entity';
import { Match } from '../../../entities/match.entity';
import { User } from '../../../entities/user.entity';
import { MatchStatus } from '../../../entities/match.entity';
import { GroupStageOptions } from '../../../common/types/stage-options.type';
import { MatchResult } from '../../../entities/match-result.entity';
import { SetScoreDto } from '../dto/match.dto';
import { EntityManager } from 'typeorm';
import { LeagueParticipant } from '../../../entities/league-participant.entity';
import { In } from 'typeorm';

@Injectable()
export class GroupStageStrategy implements StageStrategy {
  constructor(
    @InjectRepository(Group)
    private groupRepository: Repository<Group>,
    @InjectRepository(PlayerInGroup)
    private playerInGroupRepository: Repository<PlayerInGroup>,
    @InjectRepository(Match)
    private matchRepository: Repository<Match>,
    @InjectRepository(MatchResult)
    private readonly matchResultRepository: Repository<MatchResult>,
    @InjectRepository(LeagueParticipant)
    private readonly participantRepository: Repository<LeagueParticipant>,
  ) {}

  async createGroups(stage: Stage, players: User[]): Promise<void> {
    const { groupCount = 1 } = stage.options as GroupStageOptions;
    const playersPerGroup = Math.ceil(players.length / groupCount);

    // 플레이어를 무작위로 섞기
    const shuffledPlayers = players.sort(() => Math.random() - 0.5);

    // 그룹 생성 및 플레이어 배정
    for (let i = 0; i < groupCount; i++) {
      const groupNumber = i + 1;
      const group = this.groupRepository.create({
        stage,
        name: `${groupNumber}조`, // 1조, 2조, 3조, ...
        number: groupNumber, // 그룹 번호 설정 (1부터 시작)
      });
      await this.groupRepository.save(group);

      // 현재 그룹에 배정될 플레이어들
      const groupPlayers = shuffledPlayers.slice(
        i * playersPerGroup,
        Math.min((i + 1) * playersPerGroup, players.length),
      );

      // 플레이어를 그룹에 추가
      for (let j = 0; j < groupPlayers.length; j++) {
        const player = groupPlayers[j];
        const playerInGroup = this.playerInGroupRepository.create({
          group,
          user: player,
          rank: j + 1, // 초기 순위 설정 (1부터 시작)
          orderNumber: j + 1, // 표시 순서도 설정 (1부터 시작)
        });
        await this.playerInGroupRepository.save(playerInGroup);
        console.log(`그룹 ${groupNumber}에 ${player.name}(${player.id}) 추가, 초기 순위: ${j + 1}, 순서: ${j + 1}`);
      }
    }
  }

  private getMatchPattern(n: number): [number, number][] {
    console.log(`그룹의 플레이어 수: ${n}명, 매치 패턴을 생성합니다.`);
    
    switch (n) {
      case 2:
        console.log('2명 매치 패턴 사용');
        return [[1,2]];
      case 3:
        console.log('3명 매치 패턴 사용');
        return [[1,2], [1,3], [2,3]];
      case 4:
        return [[1,4], [2,3], [1,3], [2,4], [1,2], [3,4]];
      case 5:
        return [[1,5], [2,4], [1,3], [2,5], [3,4], [1,2], [3,5], [1,4], [2,3], [4,5]];
      case 6:
        return [[1,6], [2,5], [3,4], [1,5], [4,6], [2,3], [1,4], [3,5], [2,6], [1,3], [2,4], [5,6], [1,2], [3,6], [4,5]];
      case 7:
        return [[1,7], [2,6], [3,5], [1,4], [2,7], [3,6], [4,5], [1,2], [3,7], [4,6], [1,5], [2,3], [4,7], [5,6], [1,3], [2,4], [5,7], [1,6], [3,4], [2,5], [6,7]];
      case 8:
        return [[1,8], [2,7], [3,6], [4,5], [1,7], [6,8], [2,5], [3,4], [1,6], [5,7], [4,8], [2,3], [1,5], [4,6], [3,7], [2,8], [1,4], [3,5], [2,6], [7,8], [1,3], [2,4], [5,8], [6,7], [1,2], [3,8], [4,7], [5,6]];
      case 9:
        return [[1,9], [2,8], [3,7], [4,6], [1,5], [2,9], [3,8], [4,7], [5,6], [1,2], [3,9], [4,8], [5,7], [1,6], [2,3], [4,9], [5,8], [6,7], [1,3], [2,4], [5,9], [6,8], [1,7], [3,4], [2,5], [6,9], [7,8], [1,4], [3,5], [2,6], [7,9], [1,8], [4,5], [3,6], [2,7], [8,9]];
      case 10:
        return [[1,10], [2,9], [3,8], [4,7], [5,6], [1,9], [8,10], [2,7], [3,6], [4,5], [1,8], [7,9], [6,10], [2,5], [3,4], [1,7], [6,8], [5,9], [4,10], [2,3], [1,6], [5,7], [4,8], [3,9], [2,10], [1,5], [4,6], [3,7], [2,8], [9,10], [1,4], [3,5], [2,6], [7,10], [8,9], [1,3], [2,4], [5,10], [6,9], [7,8], [1,2], [3,10], [4,9], [5,8], [6,7]];
      case 11:
        return [[1,11], [2,10], [3,9], [4,8], [5,7], [1,6], [2,11], [3,10], [4,9], [5,8], [6,7], [1,2], [3,11], [4,10], [5,9], [6,8], [1,7], [2,3], [4,11], [5,10], [6,9], [7,8], [1,3], [2,4], [5,11], [6,10], [7,9], [1,8], [3,4], [2,5], [6,11], [7,10], [8,9], [1,4], [3,5], [2,6], [7,11], [8,10], [1,9], [4,5], [3,6], [2,7], [8,11], [9,10], [1,5], [4,6], [3,7], [2,8], [9,11], [1,10], [5,6], [4,7], [3,8], [2,9], [10,11]];
      case 12:
        return [[1,12], [2,11], [3,10], [4,9], [5,8], [6,7], [1,11], [10,12], [2,9], [3,8], [4,7], [5,6], [1,10], [9,11], [8,12], [2,7], [3,6], [4,5], [1,9], [8,10], [7,11], [6,12], [2,5], [3,4], [1,8], [7,9], [6,10], [5,11], [4,12], [2,3], [1,7], [6,8], [5,9], [4,10], [3,11], [2,12], [1,6], [5,7], [4,8], [3,9], [2,10], [11,12], [1,5], [4,6], [3,7], [2,8], [9,12], [10,11], [1,4], [3,5], [2,6], [7,12], [8,11], [9,10], [1,3], [2,4], [5,12], [6,11], [7,10], [8,9], [1,2], [3,12], [4,11], [5,10], [6,9], [7,8]];
      default:
        // 기본 패턴: 모든 플레이어가 서로 한 번씩 대전
        console.log(`기본 패턴 생성 (${n}명)`);
        const pattern: [number, number][] = [];
        for (let i = 1; i <= n; i++) {
          for (let j = i + 1; j <= n; j++) {
            pattern.push([i, j]);
          }
        }
        console.log('생성된 패턴:', pattern);
        return pattern;
    }
  }

  async createMatches(stage: Stage): Promise<void> {
    const groups = await this.groupRepository.find({
      where: { stage: { id: stage.id } },
      relations: ['players', 'players.user', 'stage', 'stage.league'],
      order: { number: 'ASC' }  // 조 순서대로 처리
    });

    console.log(`스테이지 ${stage.id}의 그룹 수: ${groups.length}`);

    for (const group of groups) {
      console.log(`그룹 ${group.id}(${group.name}) 매치 생성 시작`);
      
      // 각 그룹의 플레이어를 orderNumber 순으로 정렬
      if (group.players) {
        group.players.sort((a, b) => a.orderNumber - b.orderNumber);
      }
      
      // 그룹의 플레이어 ID 목록 추출 (orderNumber 순서 유지)
      const playerIds = group.players.map(p => p.user.id);
      console.log(`그룹 ${group.id}의 플레이어 ID 순서:`, playerIds);
      
      // 플레이어 정보 조회 (ID 순서 유지)
      const players: LeagueParticipant[] = [];
      for (const userId of playerIds) {
        const participant = await this.participantRepository.findOne({
          where: {
            league: { id: group.stage.league.id },
            user: { id: userId }
          }
        });
        if (participant) {
          players.push(participant);
        }
      }
      
      console.log(`그룹 ${group.id}의 플레이어 수: ${players.length}`);
      if (players.length < 2) {
        console.log(`그룹 ${group.id}의 플레이어가 2명 미만이라 매치를 생성하지 않습니다.`);
        continue;
      }
      
      const n = players.length;

      // 매치 순서 패턴 정의
      const matchPattern = this.getMatchPattern(n);
      console.log(`생성할 매치 수: ${matchPattern.length}`);
      
      let matchOrder = 1;

      for (const [p1, p2] of matchPattern) {
        // 플레이어 인덱스는 1부터 시작하므로 -1 해서 0부터 시작하는 배열 인덱스로 변환
        console.log(`매치 생성: ${p1}번 플레이어 vs ${p2}번 플레이어`);
        
        if (p1 - 1 >= players.length || p2 - 1 >= players.length) {
          console.log(`유효하지 않은 플레이어 인덱스: ${p1}, ${p2}`);
          continue;
        }
        
        const match = this.matchRepository.create({
          stage,
          group,
          player1: players[p1 - 1],
          player2: players[p2 - 1],
          status: MatchStatus.SCHEDULED,
          order: matchOrder,
          groupNumber: group.number,
          description: `${group.name} ${matchOrder}경기`,
          round: 1
        });
        await this.matchRepository.save(match);
        console.log(`매치 저장 완료: ID ${match.id}`);
        matchOrder++;
      }

      console.log(`그룹 ${group.id}의 매치 생성 완료`);
    }
  }

  async getAdvancingPlayers(stage: Stage): Promise<User[]> {
    const { advancingPlayersCount = 1 } = stage.options as GroupStageOptions;
    const groups = await this.groupRepository.find({
      where: { stage: { id: stage.id } },
      relations: ['players', 'players.user', 'matches', 'matches.result'],
    });

    const advancingPlayers: User[] = [];

    for (const group of groups) {
      const playerStats = new Map<number, {
        wins: number;
        setsWon: number;
        setsLost: number;
        position: number;
        headToHead: Map<number, boolean>;
      }>();

      // 초기화
      group.players.forEach((pig, index) => {
        playerStats.set(pig.user.id, {
          wins: 0,
          setsWon: 0,
          setsLost: 0,
          position: index + 1, // 초기 위치 저장
          headToHead: new Map(),
        });
      });

      // 경기 결과로 통계 계산
      for (const match of group.matches) {
        if (match.result) {
          const player1Id = match.player1.id;
          const player2Id = match.player2.id;
          const winnerId = match.result.winner.id;
          const sets = match.result.scoreDetails.sets;

          let player1Sets = 0;
          let player2Sets = 0;

          // 세트 수 계산
          sets.forEach(set => {
            if (set.player1Score > set.player2Score) player1Sets++;
            else if (set.player2Score > set.player1Score) player2Sets++;
          });

          // 승자의 승리 수 증가
          const winnerStats = playerStats.get(winnerId);
          if (winnerStats) {
            winnerStats.wins++;
            winnerStats.setsWon += winnerId === player1Id ? player1Sets : player2Sets;
            winnerStats.setsLost += winnerId === player1Id ? player2Sets : player1Sets;
            winnerStats.headToHead.set(
              winnerId === player1Id ? player2Id : player1Id,
              true
            );
          }

          // 패자의 세트 기록 업데이트
          const loserId = winnerId === player1Id ? player2Id : player1Id;
          const loserStats = playerStats.get(loserId);
          if (loserStats) {
            loserStats.setsWon += winnerId === player1Id ? player2Sets : player1Sets;
            loserStats.setsLost += winnerId === player1Id ? player1Sets : player2Sets;
          }
        }
      }

      // 순위 결정
      const sortedPlayers = [...playerStats.entries()].sort((a, b) => {
        // 1. 승수 비교
        if (a[1].wins !== b[1].wins) {
          return b[1].wins - a[1].wins;
        }

        // 2. 동률자들끼리 상대 전적 비교
        if (a[1].wins === b[1].wins) {
          if (a[1].headToHead.has(b[0])) {
            return a[1].headToHead.get(b[0]) ? -1 : 1;
          }
        }

        // 3. 세트 승률 비교
        const aRatio = a[1].setsWon / (a[1].setsWon + a[1].setsLost);
        const bRatio = b[1].setsWon / (b[1].setsWon + b[1].setsLost);
        if (Math.abs(aRatio - bRatio) > 0.001) {
          return bRatio - aRatio;
        }

        // 4. 초기 위치가 빠른 순
        return a[1].position - b[1].position;
      });

      // 상위 N명 선발
      const groupAdvancing = sortedPlayers
        .slice(0, advancingPlayersCount)
        .map(([playerId]) => 
          group.players.find(pig => pig.user.id === playerId)?.user
        )
        .filter((user): user is User => user !== undefined);

      advancingPlayers.push(...groupAdvancing);
    }

    return advancingPlayers;
  }

  async updateMatchResult(match: Match, setScores: SetScoreDto[]): Promise<void> {
    await this.matchRepository.manager.transaction(async transactionalEntityManager => {
      // 승자 결정
      const player1Sets = setScores.filter(
        set => set.player1Score > set.player2Score
      ).length;
      const player2Sets = setScores.filter(
        set => set.player2Score > set.player1Score
      ).length;

      if (!match.player1 || !match.player2) {
        throw new Error('매치에 플레이어가 설정되지 않았습니다.');
      }

      const winner = player1Sets > player2Sets ? match.player1 : match.player2;

      // 기존 결과가 있으면 삭제
      const existingResult = await transactionalEntityManager
        .getRepository(MatchResult)
        .findOne({
          where: { match: { id: match.id } },
        });

      if (existingResult) {
        await transactionalEntityManager
          .getRepository(MatchResult)
          .remove(existingResult);
        
        // 매치의 result 관계도 제거
        match.result = null as any;
        await transactionalEntityManager
          .getRepository(Match)
          .save(match);
      }

      // 새로운 결과 생성
      const matchResultRepo = transactionalEntityManager.getRepository(MatchResult);
      const result = new MatchResult();
      result.match = match;
      result.winner = winner;
      
      // 세트 스코어 계산
      result.scoreDetails = {
        sets: setScores.map(score => ({
          player1Score: score.player1Score,
          player2Score: score.player2Score,
        })),
        finalScore: {
          player1Sets,
          player2Sets,
        }
      };

      // 결과 저장
      const savedResult = await matchResultRepo.save(result);

      // 매치 상태 업데이트
      match.status = MatchStatus.COMPLETED;
      match.result = savedResult;
      await transactionalEntityManager
        .getRepository(Match)
        .save(match);
        
      // 그룹 내 플레이어 순위 재계산
      if (match.groupNumber) {
        await this.recalculateGroupRanks(match.stage.id, match.groupNumber, transactionalEntityManager);
      }
    });
  }
  
  // 그룹 내 플레이어 순위 재계산
  private async recalculateGroupRanks(
    stageId: number, 
    groupNumber: number, 
    entityManager?: EntityManager
  ): Promise<void> {
    const repo = entityManager ? entityManager.getRepository(Group) : this.groupRepository;
    
    // 그룹 정보 로드
    const group = await repo.findOne({
      where: { stage: { id: stageId }, number: groupNumber },
      relations: ['players', 'players.user']
    });
    
    if (!group) {
      console.error(`그룹을 찾을 수 없음: 스테이지 ${stageId}, 그룹 ${groupNumber}`);
      return;
    }
    
    // 그룹의 모든 매치 가져오기
    const matchRepo = entityManager ? entityManager.getRepository(Match) : this.matchRepository;
    const matches = await matchRepo.find({
      where: { stage: { id: stageId }, groupNumber },
      relations: ['result', 'result.winner', 'player1', 'player2']
    });
    
    // 승리 수 계산
    const playerWins = new Map<number, number>();
    group.players.forEach(p => playerWins.set(p.user.id, 0));
    
    matches.forEach(match => {
      if (match.result?.winner) {
        const currentWins = playerWins.get(match.result.winner.id) || 0;
        playerWins.set(match.result.winner.id, currentWins + 1);
      }
    });
    
    // 각 플레이어의 승리 수에 따라 등수 결정 (원본 배열은 수정하지 않음)
    const playerRanks = new Map<number, number>();
    
    // 승리 수 기준으로 정렬된 플레이어 ID 배열 생성
    const sortedPlayerIds = [...playerWins.entries()]
      .sort((a, b) => b[1] - a[1]) // 승리 많은 순으로 정렬
      .map(entry => entry[0]);
      
    // 각 플레이어에게 등수 할당
    sortedPlayerIds.forEach((playerId, index) => {
      playerRanks.set(playerId, index + 1);
    });
    
    // 원본 플레이어 순서는 유지하고 rank만 업데이트
    const playerInGroupRepo = entityManager 
      ? entityManager.getRepository(PlayerInGroup) 
      : this.playerInGroupRepository;
      
    for (const player of group.players) {
      const newRank = playerRanks.get(player.user.id) || 0;
      console.log(`플레이어 ${player.user.name}의 순위 업데이트: ${player.rank} -> ${newRank}등`);
      
      // rank 값만 변경하고 저장
      if (player.rank !== newRank) {
        player.rank = newRank;
        await playerInGroupRepo.save(player);
      }
    }
  }
} 