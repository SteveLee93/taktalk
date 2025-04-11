import { Controller, Post, Body, Param, UseGuards, Request, Put, Get, Query, Delete, UseInterceptors, ClassSerializerInterceptor, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LeaguesService } from './leagues.service';
import { CreateLeagueDto, AddOperatorDto, UpdateParticipantStatusDto, ParticipateLeagueDto, SearchLeagueDto, UpdateLeagueStatusDto } from './dto/league.dto';
import { CreateLeagueTemplateDto, LeagueTemplateDto } from './dto/league-template.dto';
import { League } from '../../entities/league.entity';

@ApiTags('리그')
@Controller('leagues')
@ApiBearerAuth()
@UseInterceptors(ClassSerializerInterceptor)
export class LeaguesController {
  constructor(private readonly leaguesService: LeaguesService) {}

  @Post()
  @ApiOperation({ summary: '리그 생성' })
  @ApiResponse({ 
    status: 201, 
    description: '리그 생성 성공',
    type: League 
  })
  @UseGuards(JwtAuthGuard)
  async createLeague(
    @Body() createLeagueDto: CreateLeagueDto,
    @Request() req,
  ): Promise<League> {
    return this.leaguesService.createLeague(createLeagueDto, req.user.id);
  }

  @Post(':id/operators')
  @ApiOperation({ summary: '리그 운영자 추가' })
  @ApiResponse({ status: 201, description: '운영자 추가 성공' })
  @UseGuards(JwtAuthGuard)
  async addOperator(
    @Param('id') id: number,
    @Body() addOperatorDto: AddOperatorDto,
    @Request() req,
  ): Promise<void> {
    return this.leaguesService.addOperator(id, addOperatorDto, req.user.id);
  }

  @Post(':id/participate')
  @ApiOperation({ summary: '리그 참가 신청' })
  @ApiResponse({ status: 201, description: '참가 신청 성공' })
  @UseGuards(JwtAuthGuard)
  async participateLeague(
    @Param('id') id: number,
    @Request() req,
    @Body() dto: ParticipateLeagueDto,
  ) {
    return this.leaguesService.participateLeague(id, req.user.id, dto);
  }

  @Put(':id/participants/:participantId')
  @ApiOperation({ summary: '참가 신청 상태 변경' })
  @ApiResponse({ status: 200, description: '상태 변경 성공' })
  @UseGuards(JwtAuthGuard)
  async updateParticipantStatus(
    @Param('id') id: number,
    @Param('participantId') participantId: number,
    @Body() updateParticipantStatusDto: UpdateParticipantStatusDto,
    @Request() req,
  ): Promise<void> {
    return this.leaguesService.updateParticipantStatus(
      id,
      participantId,
      updateParticipantStatusDto,
      req.user.id,
    );
  }

  @Get('search')
  @ApiOperation({ summary: '리그 검색' })
  @ApiResponse({
    status: 200,
    description: '검색 조건에 맞는 리그 목록',
    type: [League],
  })
  async searchLeagues(@Query() searchDto: SearchLeagueDto): Promise<League[]> {
    return this.leaguesService.searchLeagues(searchDto);
  }

  // 템플릿 관련 API
  @Get('templates')
  @ApiOperation({ summary: '템플릿 목록 조회' })
  @ApiQuery({ name: 'userId', required: true, description: '조회할 사용자 ID' })
  @UseGuards(JwtAuthGuard)
  async getTemplates(
    @Query('userId') userId: string
  ): Promise<LeagueTemplateDto[]> {
    return this.leaguesService.findTemplatesByUserId(parseInt(userId));
  }

  @Post('templates')
  @ApiOperation({ summary: '템플릿 저장' })
  @ApiQuery({ name: 'userId', required: false, description: '템플릿을 저장할 사용자 ID (쿼리 파라미터)' })
  @UseGuards(JwtAuthGuard)
  async createTemplate(
    @Body() createTemplateDto: CreateLeagueTemplateDto,
    @Query('userId') queryUserId: string,
    @Request() req
  ): Promise<LeagueTemplateDto> {
    // 요청 본문의 userId가 있으면 사용, 없으면 쿼리 파라미터, 없으면 현재 로그인한 사용자 ID 사용
    const userId = createTemplateDto.userId || (queryUserId ? parseInt(queryUserId) : req.user.id);
    console.log('템플릿 저장 요청:', { templateName: createTemplateDto.name, userId });
    return this.leaguesService.createTemplate(createTemplateDto, userId);
  }

  @Delete('templates/:id')
  @ApiOperation({ summary: '템플릿 삭제' })
  @ApiQuery({ name: 'userId', required: true, description: '템플릿 소유자 ID' })
  @UseGuards(JwtAuthGuard)
  async deleteTemplate(
    @Param('id') id: string,
    @Query('userId') userId: string
  ): Promise<void> {
    return this.leaguesService.deleteTemplate(parseInt(id), parseInt(userId));
  }

  @Get(':id')
  @ApiOperation({ summary: '리그 상세 정보 조회' })
  @ApiResponse({ 
    status: 200, 
    description: '리그 정보 조회 성공',
    type: League 
  })
  async getLeague(@Param('id') id: number): Promise<League> {
    return this.leaguesService.getLeague(id);
  }

  @Get()
  @ApiOperation({ summary: '리그 목록 조회' })
  @ApiResponse({ 
    status: 200, 
    description: '리그 목록 조회 성공',
    type: [League] 
  })
  async getLeagues(): Promise<League[]> {
    return this.leaguesService.getLeagues();
  }

  @Delete(':id/operators/:operatorId')
  @ApiOperation({ summary: '리그 운영자 삭제' })
  @ApiResponse({ status: 200, description: '운영자 삭제 성공' })
  @UseGuards(JwtAuthGuard)
  async removeOperator(
    @Param('id') id: number,
    @Param('operatorId') operatorId: number,
    @Request() req,
  ): Promise<void> {
    return this.leaguesService.removeOperator(id, operatorId, req.user.id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: '리그 상태 변경' })
  @ApiResponse({ status: 200, description: '상태 변경 성공' })
  @UseGuards(JwtAuthGuard)
  async updateLeagueStatus(
    @Param('id') id: number,
    @Body() updateLeagueStatusDto: UpdateLeagueStatusDto,
    @Request() req,
  ): Promise<void> {
    return this.leaguesService.updateLeagueStatus(
      id,
      updateLeagueStatusDto,
      req.user.id,
    );
  }
} 