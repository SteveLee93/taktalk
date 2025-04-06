import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { Stage } from '../../entities/stage.entity';
import { Match } from '../../entities/match.entity';
import { MatchResult } from '../../entities/match-result.entity';
import { League } from '../../entities/league.entity';
import { User } from '../../entities/user.entity';
import { StageType } from '../../common/types/stage-options.type';
import { CreateStageDto, UpdateMatchResultDto } from './dto/stage.dto';
import { GroupStageStrategy } from './strategies/group-stage.strategy';
import { TournamentStageStrategy } from './strategies/tournament.strategy';
import { StageStrategy } from './strategies/stage-strategy.interface';
import { MatchStatus } from '../../entities/match.entity';
import { Group } from '../../entities/group.entity';
import { PlayerInGroup } from '../../entities/player-in-group.entity';
import { ConfirmGroupsDto } from './dto/confirm-groups.dto';
import { BaseStageOptions, GroupStageOptions, TournamentOptions } from '../../common/types/stage-options.type';
import { UpdateStageDto } from './dto/update-stage.dto';
import { MatchService } from './match.service';
import { ParticipantStatus } from '../../entities/league-participant.entity';

@Injectable()
export class StagesService {
  private strategies: Map<StageType, StageStrategy>;

  constructor(
    @InjectRepository(Stage)
    private stageRepository: Repository<Stage>,
    @InjectRepository(Match)
    private matchRepository: Repository<Match>,
    @InjectRepository(MatchResult)
    private matchResultRepository: Repository<MatchResult>,
    @InjectRepository(League)
    private leagueRepository: Repository<League>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Group)
    private groupRepository: Repository<Group>,
    @InjectRepository(PlayerInGroup)
    private playerInGroupRepository: Repository<PlayerInGroup>,
    private groupStageStrategy: GroupStageStrategy,
    private tournamentStageStrategy: TournamentStageStrategy,
    private matchService: MatchService,
  ) {
    this.strategies = new Map<StageType, StageStrategy>([
      [StageType.GROUP, groupStageStrategy],
      [StageType.TOURNAMENT, tournamentStageStrategy],
    ]);
  }

  private getStageStrategy(type: 'GROUP' | 'TOURNAMENT'): StageStrategy {
    switch (type) {
      case 'GROUP':
        return this.groupStageStrategy;
      case 'TOURNAMENT':
        return this.tournamentStageStrategy;
      default:
        throw new BadRequestException('지원하지 않는 단계 타입입니다.');
    }
  }

  async createStage(createStageDto: CreateStageDto): Promise<Stage> {
    const { leagueId, ...stageData } = createStageDto;
    
    // 리그 찾기
    const league = await this.leagueRepository.findOne({
      where: { id: leagueId },
      relations: ['participants', 'participants.user'],
    });
    if (!league) {
      throw new NotFoundException(`League with ID ${leagueId} not found`);
    }

    // 스테이지 생성
    const stage = this.stageRepository.create({
      ...stageData,
      league,
    });
    await this.stageRepository.save(stage);

    // 스테이지 전략 가져오기
    const strategy = this.getStageStrategy(stage.type);

    // 토너먼트인 경우 매치 생성 후 시드 배정
    if (stage.type === 'TOURNAMENT') {
      await strategy.createMatches(stage);
      await (strategy as TournamentStageStrategy).assignSeeds(stage);
    } else {
      // 그룹 스테이지인 경우 기존 로직 수행
      const players = league.participants
        .filter(p => p.status === ParticipantStatus.APPROVED)
        .map(p => p.user);
      await strategy.createGroups(stage, players);
      await strategy.createMatches(stage);
    }

    return stage;
  }

  async getStage(id: number): Promise<Stage> {
    const stage = await this.stageRepository.findOne({
      where: { id },
      relations: [
        'league',
        'groups',
        'groups.players',
        'groups.players.user',
        'matches',
        'matches.player1',
        'matches.player2',
        'matches.result',
        'matches.result.winner',
        'matches.result.match',
        'league.participants',
        'league.participants.user'
      ],
      order: {
        matches: {
          order: 'ASC'
        }
      }
    });

    if (!stage) {
      throw new NotFoundException('단계를 찾을 수 없습니다.');
    }

    return stage;
  }

  async updateStage(id: number, updateStageDto: UpdateStageDto): Promise<Stage> {
    const stage = await this.stageRepository.findOne({
      where: { id },
      relations: ['matches'],
    });

    if (!stage) {
      throw new NotFoundException('단계를 찾을 수 없습니다.');
    }

    // 매치가 있는 경우 수정 불가
    if (stage.matches && stage.matches.length > 0) {
      throw new BadRequestException('이미 시작된 단계는 수정할 수 없습니다.');
    }

    // 동일한 순서의 다른 단계가 있는지 확인
    if (updateStageDto.order) {
      const existingStage = await this.stageRepository.findOne({
        where: {
          league: { id: stage.league.id },
          order: updateStageDto.order,
          id: Not(id),
        },
      });

      if (existingStage) {
        throw new BadRequestException('해당 순서의 단계가 이미 존재합니다.');
      }
    }

    // 업데이트할 필드만 선택적으로 적용
    if (updateStageDto.name) stage.name = updateStageDto.name;
    if (updateStageDto.order) stage.order = updateStageDto.order;
    if (updateStageDto.type) stage.type = updateStageDto.type;
    if (updateStageDto.options) stage.options = updateStageDto.options;

    return this.stageRepository.save(stage);
  }

  async updateMatchResult(
    matchId: number,
    updateMatchResultDto: UpdateMatchResultDto,
  ): Promise<void> {
    // 먼저 매치 조회 (트랜잭션 밖에서)
    const match = await this.matchRepository.findOne({
      where: { id: matchId },
      relations: ['stage', 'player1', 'player2', 'result', 'nextMatch'],
    });
  
    if (!match) {
      throw new NotFoundException('경기를 찾을 수 없습니다.');
    }
  
    if (!match.player1 || !match.player2) {
      throw new BadRequestException('매치에 두 플레이어가 모두 설정되어 있어야 합니다.');
    }
  
    // 세트 스코어 계산 (트랜잭션 밖에서)
    const player1Sets = updateMatchResultDto.scoreDetails.filter(
      set => set.player1Score > set.player2Score
    ).length;
    const player2Sets = updateMatchResultDto.scoreDetails.filter(
      set => set.player2Score > set.player1Score
    ).length;
  
    // 승자 결정
    const winner = player1Sets > player2Sets ? match.player1 : match.player2;
  
    // 결과 저장 트랜잭션 - 간결하게 유지
    await this.matchRepository.manager.transaction(async transactionalEntityManager => {
      // 기존 결과가 있으면 삭제
      if (match.result) {
        await transactionalEntityManager
          .getRepository(MatchResult)
          .delete(match.result.id);
        
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
      
      result.scoreDetails = {
        sets: updateMatchResultDto.scoreDetails.map(score => ({
          player1Score: score.player1Score,
          player2Score: score.player2Score,
        })),
        finalScore: {
          player1Sets,
          player2Sets,
        }
      };
  
      // result 저장
      const savedResult = await matchResultRepo.save(result);
  
      // match 업데이트
      match.status = MatchStatus.COMPLETED;
      match.result = savedResult;
      await transactionalEntityManager
        .getRepository(Match)
        .save(match);
    });
  
    // 트랜잭션 완료 후 별도로 처리
    try {
      // 스테이지 타입에 따른 추가 처리
      if (match.stage.type === StageType.GROUP) {
        // 그룹 스테이지 전략에 매치 결과 업데이트 위임
        await this.groupStageStrategy.updateMatchResult(match, updateMatchResultDto.scoreDetails);
      } else {
        // 토너먼트 스테이지 전략에 매치 결과 업데이트 위임
        await this.tournamentStageStrategy.updateMatchResult(match, winner.id);
      }
    } catch (error) {
      // 오류가 발생해도 주요 결과는 이미 저장되었으므로 로그만 남김
      console.error('추가 처리 중 오류:', error);
    }
  }
  async confirmGroups(id: number, confirmGroupsDto: ConfirmGroupsDto): Promise<Stage> {
    const stage = await this.stageRepository.findOne({
      where: { id },
      relations: ['groups', 'groups.players'],
    });

    if (!stage) {
      throw new NotFoundException('스테이지를 찾을 수 없습니다.');
    }

    if (stage.type !== StageType.GROUP) {
      throw new BadRequestException('예선 단계에서만 조 편성이 가능합니다.');
    }

    // 기존 조 및 참가자 정보 삭제
    if (stage.groups) {
      await Promise.all(
        stage.groups.map(async (group) => {
          await this.playerInGroupRepository.delete({ group: { id: group.id } });
          await this.groupRepository.delete(group.id);
        }),
      );
    }

    // 새로운 조 생성
    await Promise.all(
      confirmGroupsDto.groups.map(async (playerIds, index) => {
        // Group 엔티티 생성
        const group = new Group();
        group.stage = stage;
        group.name = `${index + 1}조`;
        group.number = index + 1;
        
        const savedGroup = await this.groupRepository.save(group);

        // 조별 참가자 등록
        await Promise.all(
          playerIds.map(async (playerId) => {
            const user = await this.userRepository.findOne({
              where: { id: playerId },
            });
            
            if (!user) {
              throw new BadRequestException(`사용자 ID ${playerId}를 찾을 수 없습니다.`);
            }

            const playerInGroup = new PlayerInGroup();
            playerInGroup.group = savedGroup;
            playerInGroup.user = user;
            
            await this.playerInGroupRepository.save(playerInGroup);
          }),
        );

        return savedGroup;
      }),
    );

    // 조별 매치 생성
    const strategy = this.strategies.get(StageType.GROUP);
    if (strategy) {
      await strategy.createMatches(stage);
    }

    // 그룹 순서 설정
    stage.groups.forEach((group, index) => {
      group.number = index + 1;
    });
    await this.groupRepository.save(stage.groups);

    // 업데이트된 스테이지 조회 및 반환
    const updatedStage = await this.stageRepository.findOne({
      where: { id },
      relations: ['groups', 'groups.players', 'groups.players.user'],
    });

    if (!updatedStage) {
      throw new NotFoundException('스테이지를 찾을 수 없습니다.');
    }

    return updatedStage;
  }

  async removeStage(id: number): Promise<void> {
    const stage = await this.getStage(id);
    
    // 스테이지의 모든 매치의 next_match_id를 null로 설정
    const query = `
      UPDATE match 
      SET next_match_id = NULL 
      WHERE stage_id = ?
    `;
    await this.matchRepository.query(query, [id]);
    
    // 이제 스테이지 삭제
    await this.stageRepository.remove(stage);
  }
} 