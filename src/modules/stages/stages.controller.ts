import { Controller, Get, Post, Body, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { StagesService } from './stages.service';
import { CreateStageDto } from './dto/stage.dto';
import { Stage } from '../../entities/stage.entity';

@ApiTags('stages')
@Controller('stages')
export class StagesController {
  constructor(private readonly stagesService: StagesService) {}

  @Post()
  @ApiOperation({
    summary: '단계 생성',
    description: `
      리그의 새로운 단계를 생성합니다.
      
      # 예선 단계 생성 예시
      \`\`\`json
      {
        "leagueId": 1,
        "name": "예선",
        "order": 1,
        "type": "GROUP",
        "options": {
          "matchFormat": {
            "gamesRequired": 5,
            "setsRequired": 3
          }
        },
        "groups": [
          {
            "participants": [
              {
                "userId": "player1",
                "skillLevel": "4"
              },
              {
                "userId": "player2",
                "skillLevel": "5"
              },
              {
                "userId": "player3",
                "skillLevel": "6"
              },
              {
                "userId": "player4",
                "skillLevel": "7"
              }
            ]
          },
          {
            "participants": [
              {
                "userId": "player5",
                "skillLevel": "4"
              },
              {
                "userId": "player6",
                "skillLevel": "5"
              },
              {
                "userId": "player7",
                "skillLevel": "6"
              },
              {
                "userId": "player8",
                "skillLevel": "7"
              }
            ]
          }
        ]
      }
      \`\`\`

      # 본선 단계 생성 예시
      \`\`\`json
      {
        "leagueId": 1,
        "name": "본선",
        "order": 2,
        "type": "TOURNAMENT",
        "options": {
          "matchFormat": {
            "gamesRequired": 5,
            "setsRequired": 3
          },
          "bracketType": "SINGLE_ELIMINATION",
          "seeding": {
            "type": "GROUP_RANK",
            "qualificationCriteria": {
              "rankCutoff": 2,    // 각 조에서 상위 2명까지 진출
              "minRank": 1,       // 1등부터
              "maxRank": 2        // 2등까지 진출
            }
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
  async createStage(@Body() createStageDto: CreateStageDto): Promise<Stage> {
    return this.stagesService.createStage(createStageDto);
  }

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

  @Delete(':id')
  @ApiOperation({
    summary: '단계 삭제',
    description: '특정 단계를 삭제합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '단계가 성공적으로 삭제되었습니다.',
  })
  @ApiResponse({
    status: 404,
    description: '단계를 찾을 수 없습니다.',
  })
  async removeStage(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.stagesService.removeStage(id);
  }
} 