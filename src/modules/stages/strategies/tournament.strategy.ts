import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StageStrategy } from './stage-strategy.interface';
import { Stage } from '../../../entities/stage.entity';
import { Match, MatchStatus, PlayerOrigin } from '../../../entities/match.entity';
import { User } from '../../../entities/user.entity';
import { Group } from '../../../entities/group.entity';
import { TournamentOptions, BracketType } from '../../../common/types/stage-options.type';

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
    const options = stage.options as TournamentOptions;
    const seedOrder = this.calculateSeedOrder(options.startRound);
    const matches: Partial<Match>[] = [];

    // 첫 라운드 매치 생성
    for (let i = 0; i < seedOrder.length; i += 2) {
      matches.push({
        stage,
        order: this.calculateMatchOrder(options.bracketType, options.startRound, i / 2),
        round: options.startRound,
        status: MatchStatus.SCHEDULED,
      });
    }

    // 이후 라운드 매치 생성
    let currentRound = options.startRound - 1;
    let matchesInRound = seedOrder.length / 4;
    let previousRoundMatches = matches.length;
    let currentRoundStart = matches.length;

    while (currentRound > 0) {
      for (let i = 0; i < matchesInRound; i++) {
        matches.push({
          stage,
          order: this.calculateMatchOrder(options.bracketType, currentRound, i),
          round: currentRound,
          status: MatchStatus.SCHEDULED,
        });
      }

      // 이전 라운드 매치들과 다음 라운드 매치 연결
      for (let i = 0; i < previousRoundMatches; i += 2) {
        const nextMatchIndex = currentRoundStart + Math.floor(i / 2);
        
        // 이전 라운드의 두 매치를 다음 라운드 매치와 연결
        matches[i].nextMatch = matches[nextMatchIndex] as Match;
        matches[i].nextMatchPosition = 1;
        
        matches[i + 1].nextMatch = matches[nextMatchIndex] as Match;
        matches[i + 1].nextMatchPosition = 2;
      }

      previousRoundMatches = matchesInRound;
      currentRoundStart += matchesInRound;
      matchesInRound = Math.floor(matchesInRound / 2);
      currentRound--;
    }

    await this.matchRepository.save(matches);
  }

  private calculateSeedOrder(round: number): number[] {
    const totalPlayers = Math.pow(2, round);
    const seeds: number[] = [];
    
    // 표준 시드 배정 순서 계산
    for (let i = 0; i < totalPlayers / 2; i++) {
      // 상위 시드
      seeds.push(i + 1);
      // 하위 시드
      seeds.push(totalPlayers - i);
    }

    return seeds;
  }

  private calculateMatchOrder(bracketType: BracketType, round: number, matchInRound: number): number {
    const baseOrder = Math.pow(2, round - 1) - 1; // 해당 라운드 이전의 총 매치 수
    const bracketOffset = bracketType === 'UPPER' ? 0 : Math.pow(2, round); // 하위부 토너먼트의 경우 오프셋 적용
    
    return baseOrder + matchInRound + bracketOffset;
  }

  async assignSeeds(stage: Stage, playerIds: number[]): Promise<void> {
    const options = stage.options as TournamentOptions;
    const seedOrder = this.calculateSeedOrder(options.startRound);
    const totalSlots = Math.pow(2, options.startRound);
    
    // 첫 라운드 매치들을 order로 정렬하여 가져옴
    const firstRoundMatches = await this.matchRepository.find({
      where: { stage: { id: stage.id }, round: options.startRound },
      order: { order: 'ASC' },
    });

    // 플레이어 출신 정보 가져오기
    const playerOrigins = await this.getPlayerOrigins(stage, playerIds);

    // 시드 순서대로 선수 배정 및 부전승 처리
    for (let i = 0; i < firstRoundMatches.length; i++) {
      const match = firstRoundMatches[i];
      const player1Index = seedOrder[i * 2] - 1;
      const player2Index = seedOrder[i * 2 + 1] - 1;

      // 플레이어 1 배정
      if (player1Index < playerIds.length) {
        match.player1 = { id: playerIds[player1Index] } as User;
        match.player1Origin = playerOrigins[playerIds[player1Index]];
        match.player1Origin.seed = seedOrder[i * 2];
      }

      // 플레이어 2 배정
      if (player2Index < playerIds.length) {
        match.player2 = { id: playerIds[player2Index] } as User;
        match.player2Origin = playerOrigins[playerIds[player2Index]];
        match.player2Origin.seed = seedOrder[i * 2 + 1];
      }

      // 부전승 처리
      if (!match.player2) {
        match.status = MatchStatus.BYE;
      }
    }

    await this.matchRepository.save(firstRoundMatches);
  }

  private async getPlayerOrigins(stage: Stage, playerIds: number[]): Promise<Record<number, PlayerOrigin>> {
    const origins: Record<number, PlayerOrigin> = {};
    
    // 이전 단계(예선)의 그룹들 가져오기
    const previousStage = await this.getPreviousStage(stage);
    if (!previousStage) return origins;

    const groups = await this.groupRepository.find({
      where: { stage: { id: previousStage.id } },
      relations: ['players', 'players.user'],
    });

    // 각 그룹의 플레이어 순위 정보 수집
    for (const group of groups) {
      const rankedPlayers = await this.getRankedPlayersInGroup(group);
      
      rankedPlayers.forEach((player, index) => {
        if (playerIds.includes(player.id)) {
          origins[player.id] = {
            groupId: group.id,
            groupName: group.name,
            rank: index + 1,
          };
        }
      });
    }

    return origins;
  }

  private async getRankedPlayersInGroup(group: Group): Promise<User[]> {
    // 실제 구현에서는 그룹 내 플레이어들의 순위를 계산
    // 여기서는 임시로 그룹에 있는 순서대로 반환
    return group.players.map(p => p.user);
  }

  private async getPreviousStage(stage: Stage): Promise<Stage | null> {
    return await this.stageRepository.findOne({
      where: {
        league: { id: stage.league.id },
        order: stage.order - 1,
      },
    });
  }

  private getPlayerRank(player: User, stage: Stage): number {
    // 실제 구현에서는 이전 스테이지의 순위 정보를 가져와야 함
    return 1;
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

  private async getQualifiedPlayers(stage: Stage): Promise<User[]> {
    // 이전 스테이지의 진출자 가져오기
    const previousStage = await this.getPreviousStage(stage);
    if (!previousStage) {
      return []; // 실제로는 예외 처리 필요
    }

    const strategy = this.getStrategyForStage(previousStage);
    return strategy.getAdvancingPlayers(previousStage);
  }

  private getStrategyForStage(stage: Stage): StageStrategy {
    // 실제 구현에서는 stage type에 따라 적절한 strategy 반환
    return this;
  }

  async updateMatchResult(match: Match, winnerId: number): Promise<void> {
    // 매치 상태 업데이트
    match.status = MatchStatus.COMPLETED;
    await this.matchRepository.save(match);

    // 다음 라운드 매치가 있는 경우 승자를 자동으로 배정
    if (match.nextMatch) {
      const nextMatch = await this.matchRepository.findOne({
        where: { id: match.nextMatch.id },
        relations: ['player1', 'player2'],
      });

      if (nextMatch) {
        const winner = { id: winnerId } as User;
        const winnerOrigin = match.player1.id === winnerId ? match.player1Origin : match.player2Origin;

        if (match.nextMatchPosition === 1) {
          nextMatch.player1 = winner;
          nextMatch.player1Origin = winnerOrigin;
        } else {
          nextMatch.player2 = winner;
          nextMatch.player2Origin = winnerOrigin;
        }

        // 양쪽 선수가 모두 배정되었고, 한 쪽이 부전승인 경우 자동으로 다음 라운드 진출
        if (nextMatch.player1 && nextMatch.player2) {
          const previousMatches = await this.matchRepository.find({
            where: [
              { nextMatch: { id: nextMatch.id }, nextMatchPosition: 1 },
              { nextMatch: { id: nextMatch.id }, nextMatchPosition: 2 },
            ],
            relations: ['result'],
          });

          const byeMatch = previousMatches.find(m => m.status === MatchStatus.BYE);
          if (byeMatch) {
            const otherMatch = previousMatches.find(m => m.id !== byeMatch.id);
            if (otherMatch && otherMatch.result) {
              // 부전승이 아닌 매치의 승자를 다음 라운드로 자동 진출
              await this.updateMatchResult(nextMatch, otherMatch.result.winner.id);
            }
          }
        }

        await this.matchRepository.save(nextMatch);
      }
    }
  }
} 