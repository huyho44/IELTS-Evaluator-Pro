import { Module } from "@nestjs/common";
import { SubmissionsController } from "./submissions.controller.js";
import { SubmissionsService } from "./submissions.service.js";
import { PrismaService } from "../prisma.service.js";

@Module({
    controllers: [SubmissionsController],
    providers: [SubmissionsService,PrismaService],
    exports: [SubmissionsService]
})
export class SubmissionsModule {}