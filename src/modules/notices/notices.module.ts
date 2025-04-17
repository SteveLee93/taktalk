import { Notice } from "src/entities/notice.entity";
import { NoticesService } from "./notices.service";
import { NoticesController } from "./notices.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Module } from "@nestjs/common";
@Module({
  imports: [TypeOrmModule.forFeature([Notice])],
  controllers: [NoticesController],
  providers: [NoticesService],
})
export class NoticesModule {}

