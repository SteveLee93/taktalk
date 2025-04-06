import { Controller, Post, Body, UseGuards, Param, Put, ParseIntPipe, Get, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StagesService } from './stages.service';
import { CreateStageDto } from './dto/create-stage.dto';
import { UpdateStageDto } from './dto/update-stage.dto';
import { Stage } from '../../entities/stage.entity';
import { ConfirmGroupsDto } from './dto/confirm-groups.dto';

@ApiTags('stages')
@Controller('stages')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StagesController {
  constructor(private readonly stagesService: StagesService) {}

  @Get(':id')
  @ApiOperation({
    summary: '단계 조회',
    description: '특정 단계의 상세 정보를 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '단계 정보를 성공적으로 조회했습니다.',
    type: Stage,
  })
  @ApiResponse({
    status: 404,
    description: '단계를 찾을 수 없습니다.',
  })
  async getStage(@Param('id', ParseIntPipe) id: number): Promise<Stage> {
    return this.stagesService.getStage(id);
  }

  @Post()
  @ApiOperation({
    summary: '단계 생성',
    description: `
      리그의 새로운 단계를 생성합니다.
      
      # 예선 단계 생성 예시
      \`\`\`json
      {
        "leagueId": 1,
        "name": "예선 1조",
        "order": 1,
        "type": "GROUP",
        "options": {
          "matchFormat": {
            "gamesRequired": 5,  // 5판
            "setsRequired": 3    // 3선승
          },
          "groupCount": 4,           // 4개 조
          "playersPerGroup": 4,      // 조당 4명
          "advancingPlayersCount": 2  // 조별 2명 진출
        }
      }
      \`\`\`

      # 본선 단계 생성 예시
      \`\`\`json
      {
        "leagueId": 1,
        "name": "8강",
        "order": 2,
        "type": "TOURNAMENT",
        "options": {
          "matchFormat": {
            "gamesRequired": 7,  // 7판
            "setsRequired": 4    // 4선승
          },
          "type": "single",           // 단판 토너먼트
          "playerCount": 16,          // 16명 참가
          "seeding": {
            "type": "group_rank",     // 조별 순위 기반 시드 배정
            "groupRankWeights": [1, 0.7, 0.5, 0.3]  // 조별 순위별 가중치
          }
        }
      }
      \`\`\`
    `,
  })
  @ApiResponse({
    status: 201,
    description: '단계가 성공적으로 생성되었습니다.',
    type: Stage,
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 요청 (예: 잘못된 단계 설정)',
  })
  @ApiResponse({
    status: 404,
    description: '리그를 찾을 수 없습니다.',
  })
  async createStage(@Body() createStageDto: CreateStageDto): Promise<Stage> {
    return this.stagesService.createStage(createStageDto);
  }

  @Put(':id')
  @ApiOperation({
    summary: '단계 수정',
    description: `
      기존 단계의 정보를 수정합니다.
      단계가 시작되지 않은 경우에만 수정이 가능합니다.
      
      # 예선 단계 수정 예시
      \`\`\`json
      {
        "name": "예선 A조",
        "order": 1,
        "options": {
          "matchFormat": {
            "gamesRequired": 5,
            "setsRequired": 3
          },
          "groupCount": 3,
          "playersPerGroup": 5,
          "advancingPlayersCount": 2
        }
      }
      \`\`\`

      # 본선 단계 수정 예시
      \`\`\`json
      {
        "name": "4강",
        "order": 2,
        "options": {
          "matchFormat": {
            "gamesRequired": 9,
            "setsRequired": 5
          },
          "type": "double",
          "playerCount": 8,
          "seeding": {
            "type": "manual"
          }
        }
      }
      \`\`\`
    `,
  })
  @ApiResponse({
    status: 200,
    description: '단계가 성공적으로 수정되었습니다.',
    type: Stage,
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 요청 (예: 이미 시작된 단계 수정 시도)',
  })
  @ApiResponse({
    status: 404,
    description: '단계를 찾을 수 없습니다.',
  })
  async updateStage(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStageDto: UpdateStageDto,
  ): Promise<Stage> {
    return this.stagesService.updateStage(id, updateStageDto);
  }

  @Put(':id/confirm-groups')
  @ApiOperation({
    summary: '조 편성 확정',
    description: '예선 단계의 조 편성을 확정합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '조 편성이 성공적으로 확정되었습니다.',
    type: Stage,
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 요청 (예: 잘못된 조 편성)',
  })
  @ApiResponse({
    status: 404,
    description: '단계를 찾을 수 없습니다.',
  })
  async confirmGroups(
    @Param('id', ParseIntPipe) id: number,
    @Body() confirmGroupsDto: ConfirmGroupsDto,
  ): Promise<Stage> {
    return this.stagesService.confirmGroups(id, confirmGroupsDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '스테이지 삭제' })
  async removeStage(@Param('id') id: number): Promise<void> {
    return this.stagesService.removeStage(id);
  }
} 