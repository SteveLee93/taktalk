import { Injectable, NotFoundException, UnauthorizedException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { League } from '../../entities/league.entity';
import { User } from '../../entities/user.entity';
import { LeagueOperator } from '../../entities/league-operator.entity';
import { LeagueParticipant, ParticipantStatus } from '../../entities/league-participant.entity';
import { LeagueTemplate } from '../../entities/league-template.entity';
import { CreateLeagueDto, AddOperatorDto, UpdateParticipantStatusDto, ParticipateLeagueDto, SearchLeagueDto } from './dto/league.dto';
import { CreateLeagueTemplateDto, LeagueTemplateDto } from './dto/league-template.dto';

@Injectable()
export class LeaguesService {
  constructor(
    @InjectRepository(League)
    private leagueRepository: Repository<League>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(LeagueOperator)
    private operatorRepository: Repository<LeagueOperator>,
    @InjectRepository(LeagueParticipant)
    private participantRepository: Repository<LeagueParticipant>,
    @InjectRepository(LeagueTemplate)
    private leagueTemplateRepository: Repository<LeagueTemplate>,
  ) {}

  async createLeague(createLeagueDto: CreateLeagueDto, userId: number): Promise<League> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const league = this.leagueRepository.create({
      ...createLeagueDto,
      creator: user,
    });
    
    return await this.leagueRepository.save(league);
  }

  async addOperator(leagueId: number, addOperatorDto: AddOperatorDto, userId: number): Promise<void> {
    const league = await this.leagueRepository.findOne({
      where: { id: leagueId },
      relations: ['operators'],
    });

    if (!league) {
      throw new NotFoundException('리그를 찾을 수 없습니다.');
    }

    // 현재 사용자가 운영자인지 확인
    const isOperator = await this.operatorRepository.findOne({
      where: { league: { id: leagueId }, user: { id: userId } },
    });

    if (!isOperator) {
      throw new UnauthorizedException('리그 운영자만 다른 운영자를 추가할 수 있습니다.');
    }

    // 닉네임으로 사용자 찾기
    const newOperator = await this.userRepository.findOne({
      where: { nickname: addOperatorDto.nickname },
    });

    if (!newOperator) {
      throw new NotFoundException('해당 닉네임의 사용자를 찾을 수 없습니다.');
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

    if (league.participants.length >= league.maxPlayers) {
      throw new ConflictException('최대 참가자 수를 초과했습니다.');
    }

    const participant = this.participantRepository.create({
      league,
      user,
      status: ParticipantStatus.PENDING,
      skillLevel: dto.skillLevel,
    });

    await this.participantRepository.save(participant);
  }

  async updateParticipantStatus(
    leagueId: number,
    participantId: number,
    dto: UpdateParticipantStatusDto,
    userId: number,
  ): Promise<void> {
    // 운영자 권한 확인
    const isOperator = await this.operatorRepository.findOne({
      where: { league: { id: leagueId }, user: { id: userId } },
    });

    if (!isOperator) {
      throw new UnauthorizedException('리그 운영자만 참가 상태를 변경할 수 있습니다.');
    }

    const participant = await this.participantRepository.findOne({
      where: { id: participantId, league: { id: leagueId } },
    });

    if (!participant) {
      throw new NotFoundException('참가 신청 정보를 찾을 수 없습니다.');
    }

    // 상태 변경
    participant.status = dto.status;
    await this.participantRepository.save(participant);
  }

  async getLeague(id: number): Promise<League> {
    const league = await this.leagueRepository.findOne({
      where: { id },
      relations: ['creator', 'operators', 'participants'],
    });

    if (!league) {
      throw new NotFoundException('리그를 찾을 수 없습니다.');
    }

    return league;
  }

  async getLeagues(): Promise<League[]> {
    return this.leagueRepository.find({
      relations: ['creator', 'operators', 'participants'],
    });
  }

  async searchLeagues(searchDto: SearchLeagueDto): Promise<League[]> {
    const queryBuilder = this.leagueRepository.createQueryBuilder('league')
      .leftJoinAndSelect('league.creator', 'creator')
      .leftJoinAndSelect('league.operators', 'operators')
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

    return queryBuilder.getMany();
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
} 