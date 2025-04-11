import { Injectable, NotFoundException, UnauthorizedException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { League } from '../../entities/league.entity';
import { User } from '../../entities/user.entity';
import { LeagueOperator } from '../../entities/league-operator.entity';
import { LeagueParticipant, ParticipantStatus } from '../../entities/league-participant.entity';
import { LeagueTemplate } from '../../entities/league-template.entity';
import { CreateLeagueDto, AddOperatorDto, UpdateParticipantStatusDto, ParticipateLeagueDto, SearchLeagueDto, UpdateLeagueStatusDto } from './dto/league.dto';
import { CreateLeagueTemplateDto, LeagueTemplateDto } from './dto/league-template.dto';
import { LeagueStatus } from '../../common/enums/league-status.enum';
import { StagesService } from '../stages/stages.service';
import { StageType } from '../../common/enums/stage-type.enum';
import { BracketType, SeedingType } from '../../common/types/stage-options.type';

@Injectable()
export class LeaguesService {
  constructor(
    @InjectRepository(League)
    private readonly leagueRepository: Repository<League>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(LeagueOperator)
    private readonly operatorRepository: Repository<LeagueOperator>,
    @InjectRepository(LeagueParticipant)
    private readonly participantRepository: Repository<LeagueParticipant>,
    @InjectRepository(LeagueTemplate)
    private readonly leagueTemplateRepository: Repository<LeagueTemplate>,
    private readonly stagesService: StagesService,
  ) {}

  async createLeague(createLeagueDto: CreateLeagueDto, userId: number): Promise<League> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const league = this.leagueRepository.create({
      ...createLeagueDto,
      creator: user,
      status: LeagueStatus.ORGANIZING,
    });
    
    const savedLeague = await this.leagueRepository.save(league);

    // 기본 스테이지 생성 (예선 스테이지)
    await this.stagesService.createStage({
      leagueId: savedLeague.id,
      name: '예선',
      order: 1,
      type: StageType.GROUP,
      options: {
        matchFormat: {
          gamesRequired: 5,
          setsRequired: 3
        },
        groupCount: 4,
        playersPerGroup: 4,
        advancingPlayersCount: 2
      },
      groups: []
    });

    // 본선 스테이지 생성
    await this.stagesService.createStage({
      leagueId: savedLeague.id,
      name: '본선',
      order: 2,
      type: StageType.TOURNAMENT,
      options: {
        matchFormat: {
          gamesRequired: 5,
          setsRequired: 3
        },
        bracketType: 'SINGLE_ELIMINATION',
        seeding: {
          type: 'GROUP_RANK',
          qualificationCriteria: {
            rankCutoff: 2
          }
        }
      },
      groups: []
    });

    return this.getLeague(savedLeague.id);
  }

  async addOperator(leagueId: number, addOperatorDto: AddOperatorDto, userId: number): Promise<void> {
    const league = await this.leagueRepository.findOne({
      where: { id: leagueId },
      relations: ['operators', 'creator'],
    });

    if (!league) {
      throw new NotFoundException('리그를 찾을 수 없습니다.');
    }

    // 현재 사용자가 운영자이거나 생성자인지 확인
    const isOperator = await this.operatorRepository.findOne({
      where: { league: { id: leagueId }, user: { id: userId } },
    });
    const isCreator = league.creator.id === userId;

    if (!isOperator && !isCreator) {
      throw new UnauthorizedException('리그 운영자 또는 주최자만 다른 운영자를 추가할 수 있습니다.');
    }

    // username으로 사용자 찾기
    const newOperator = await this.userRepository.findOne({
      where: { userId: addOperatorDto.userId },
    });

    if (!newOperator) {
      throw new NotFoundException('해당 아이디의 사용자를 찾을 수 없습니다.');
    }

    // 이미 운영자인지 확인
    const existingOperator = await this.operatorRepository.findOne({
      where: { league: { id: leagueId }, user: { id: newOperator.id } },
    });

    if (existingOperator) {
      throw new ConflictException('이미 운영자로 등록된 사용자입니다.');
    }

    // 새 운영자 추가
    const operator = this.operatorRepository.create({
      league,
      user: newOperator,
    });
    await this.operatorRepository.save(operator);
  }

  async participateLeague(leagueId: number, userId: number, dto: ParticipateLeagueDto) {
    const league = await this.leagueRepository.findOne({
      where: { id: leagueId },
      relations: ['participants'],
    });

    if (!league) {
      throw new NotFoundException('리그를 찾을 수 없습니다.');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const existingParticipant = await this.participantRepository.findOne({
      where: { league: { id: leagueId }, user: { id: userId } },
    });

    if (existingParticipant) {
      throw new ConflictException('이미 참가 신청한 리그입니다.');
    }

    // 참가자 수 조회하여 신청 순번 결정
    const participantCount = await this.participantRepository.count({
      where: { league: { id: leagueId } }
    });

    const participant = this.participantRepository.create({
      league,
      user,
      userId: user.userId,
      status: ParticipantStatus.PENDING,
      skillLevel: dto.skillLevel,
      name: user.name,
      nickname: dto.name,
      orderNumber: participantCount + 1
    });

    await this.participantRepository.save(participant);
  }

  async updateParticipantStatus(
    leagueId: number,
    participantId: number,
    dto: UpdateParticipantStatusDto,
    userId: number,
  ): Promise<void> {
    const league = await this.leagueRepository.findOne({
      where: { id: leagueId },
      relations: ['creator', 'operators'],
    });

    if (!league) {
      throw new NotFoundException('리그를 찾을 수 없습니다.');
    }

    // 운영자 또는 주최자 권한 확인
    const isOperator = await this.operatorRepository.findOne({
      where: { league: { id: leagueId }, user: { id: userId } },
    });
    const isCreator = league.creator.id === userId;

    if (!isOperator && !isCreator) {
      throw new UnauthorizedException('리그 운영자 또는 주최자만 참가 상태를 변경할 수 있습니다.');
    }

    const participant = await this.participantRepository.findOne({
      where: { id: participantId, league: { id: leagueId } },
    });

    if (!participant) {
      throw new NotFoundException('참가 신청 정보를 찾을 수 없습니다.');
    }

    // 상태 변경
    participant.status = dto.status;
    
    // 부수 변경 (제공된 경우에만)
    if (dto.skillLevel !== undefined) {
      participant.skillLevel = dto.skillLevel;
    }

    await this.participantRepository.save(participant);
  }

  async getLeague(id: number): Promise<League> {
    const league = await this.leagueRepository.findOne({
      where: { id },
      relations: [
        'creator', 
        'operators', 
        'operators.user',
        'participants',
        'participants.user',
        'stages',
        'stages.groups',
        'stages.groups.players',
        'stages.groups.players.user',
        'stages.matches',
        'stages.matches.player1',
        'stages.matches.player2',
        'stages.matches.result',
        'stages.matches.result.winner'
      ],
      order: {
        stages: {
          order: 'ASC',
          matches: {
            order: 'ASC'
          }
        }
      }
    });

    if (!league) {
      throw new NotFoundException('리그를 찾을 수 없습니다.');
    }

    // 운영자 정보 가공
    league.operators = league.operators.map(operator => ({
      ...operator,
      userId: operator.user.userId,
      name: operator.user.name,
      phone: operator.user.phone,
      isCreator: operator.user.id === league.creator.id
    }));

    return league;
  }

  async getLeagues(): Promise<League[]> {
    const leagues = await this.leagueRepository.find({
      relations: [
        'creator', 
        'operators', 
        'operators.user',
        'participants',
        'participants.user',
        'stages',
        'stages.groups',
        'stages.groups.players',
        'stages.groups.players.user',
        'stages.matches',
        'stages.matches.player1',
        'stages.matches.player2',
        'stages.matches.result',
        'stages.matches.result.winner'
      ],
      order: {
        stages: {
          order: 'ASC',
          matches: {
            order: 'ASC'
          }
        }
      }
    });

    // 각 리그의 운영자 정보 가공
    return leagues.map(league => {
      league.operators = league.operators.map(operator => ({
        ...operator,
        userId: operator.user.userId,
        name: operator.user.name,
        phone: operator.user.phone,
        isCreator: operator.user.id === league.creator.id
      }));

      return league;
    });
  }

  async searchLeagues(searchDto: SearchLeagueDto): Promise<League[]> {
    const queryBuilder = this.leagueRepository.createQueryBuilder('league')
      .leftJoinAndSelect('league.creator', 'creator')
      .leftJoinAndSelect('league.operators', 'operators')
      .leftJoinAndSelect('operators.user', 'operatorUser')
      .leftJoinAndSelect('league.participants', 'participants');

    if (searchDto.city) {
      queryBuilder.andWhere('league.city = :city', { city: searchDto.city });
    }

    if (searchDto.district) {
      queryBuilder.andWhere('league.district = :district', { district: searchDto.district });
    }

    if (searchDto.skillLevel) {
      queryBuilder.andWhere('league.minSkillLevel <= :skillLevel', { skillLevel: searchDto.skillLevel })
        .andWhere('league.maxSkillLevel >= :skillLevel', { skillLevel: searchDto.skillLevel });
    }

    const leagues = await queryBuilder.getMany();

    // 각 리그의 운영자 정보 가공
    return leagues.map(league => {
      league.operators = league.operators.map(operator => ({
        ...operator,
        userId: operator.user.userId,
        name: operator.user.name,
        phone: operator.user.phone,
        isCreator: operator.user.id === league.creator.id
      }));
      return league;
    });
  }

  // 템플릿 관련 메서드
  async findTemplatesByUserId(userId: number): Promise<LeagueTemplateDto[]> {
    const templates = await this.leagueTemplateRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    return templates.map(template => ({
      id: template.id,
      name: template.name,
      data: template.data,
      createdAt: template.createdAt,
    }));
  }

  async createTemplate(
    createTemplateDto: CreateLeagueTemplateDto,
    userId: number,
  ): Promise<LeagueTemplateDto> {
    const template = this.leagueTemplateRepository.create({
      name: createTemplateDto.name,
      data: createTemplateDto.data,
      userId,
    });

    const savedTemplate = await this.leagueTemplateRepository.save(template);

    return {
      id: savedTemplate.id,
      name: savedTemplate.name,
      data: savedTemplate.data,
      createdAt: savedTemplate.createdAt,
    };
  }

  async deleteTemplate(id: number, userId: number): Promise<void> {
    const template = await this.leagueTemplateRepository.findOne({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException('템플릿을 찾을 수 없습니다.');
    }

    if (template.userId !== userId) {
      throw new ForbiddenException('다른 사용자의 템플릿을 삭제할 수 없습니다.');
    }

    await this.leagueTemplateRepository.remove(template);
  }

  async removeOperator(leagueId: number, operatorId: number, userId: number): Promise<void> {
    const league = await this.leagueRepository.findOne({
      where: { id: leagueId },
      relations: ['creator', 'operators'],
    });

    if (!league) {
      throw new NotFoundException('리그를 찾을 수 없습니다.');
    }

    // 현재 사용자가 운영자이거나 생성자인지 확인
    const isOperator = await this.operatorRepository.findOne({
      where: { league: { id: leagueId }, user: { id: userId } },
    });
    const isCreator = league.creator.id === userId;

    if (!isOperator && !isCreator) {
      throw new UnauthorizedException('리그 운영자 또는 주최자만 운영자를 삭제할 수 있습니다.');
    }

    // 삭제할 운영자 찾기
    const operatorToRemove = await this.operatorRepository.findOne({
      where: { id: operatorId, league: { id: leagueId } },
      relations: ['user'],
    });

    if (!operatorToRemove) {
      throw new NotFoundException('해당 운영자를 찾을 수 없습니다.');
    }

    // 생성자는 삭제할 수 없음
    if (operatorToRemove.user.id === league.creator.id) {
      throw new ForbiddenException('리그 생성자는 운영자에서 삭제할 수 없습니다.');
    }

    await this.operatorRepository.remove(operatorToRemove);
  }

  async updateLeagueStatus(
    leagueId: number,
    dto: UpdateLeagueStatusDto,
    userId: number
  ): Promise<void> {
    const league = await this.leagueRepository.findOne({
      where: { id: leagueId },
      relations: ['creator', 'operators'],
    });

    if (!league) {
      throw new NotFoundException('리그를 찾을 수 없습니다.');
    }

    // 운영자 또는 생성자 권한 확인
    const isOperator = await this.operatorRepository.findOne({
      where: { league: { id: leagueId }, user: { id: userId } },
    });
    const isCreator = league.creator.id === userId;

    if (!isOperator && !isCreator) {
      throw new UnauthorizedException('리그 운영자 또는 주최자만 상태를 변경할 수 있습니다.');
    }

    // 상태 변경
    league.status = dto.status;
    await this.leagueRepository.save(league);
  }
} 