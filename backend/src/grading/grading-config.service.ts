import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service.js';
import { AccessService } from '../auth/access.service.js';
import type { Actor } from '../auth/auth.service.js';
import { integer, object, text, uuid } from '../auth/validation.js';
@Injectable()
export class GradingConfigService {
  // Inject required services.
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}
  // Create and publish a rubric.
  async rubric(input: unknown, actor: Actor) {
    this.access.role(actor, 'INSTRUCTOR');
    const dto = object(input);
    const taskType = text(dto.taskType, 'taskType', 60);
    if (!['WRITING_TASK_1', 'WRITING_TASK_2', 'SPEAKING'].includes(taskType))
      throw new BadRequestException('Unsupported rubric task type');
    if (!Array.isArray(dto.criteria) || dto.criteria.length !== 4)
      throw new BadRequestException('Provide four rubric criteria');
    const required =
      taskType === 'SPEAKING'
        ? ['FC', 'LR', 'GRA', 'PR']
        : [taskType === 'WRITING_TASK_1' ? 'TA' : 'TR', 'CC', 'LR', 'GRA'];
    const criteria = dto.criteria.map((value) => {
      const c = object(value),
        code = text(c.code, 'code', 30);
      if (!required.includes(code))
        throw new BadRequestException('Criterion does not match task type');
      return {
        code,
        name: text(c.name, 'name', 140),
        definition: text(c.definition, 'definition'),
        weight: 0.25,
        maxScore: 9,
      };
    });
    if (new Set(criteria.map((c) => c.code)).size !== 4)
      throw new BadRequestException('Duplicate criterion');
    return this.prisma.rubricVersion.create({
      data: {
        rubricCode: text(dto.rubricCode, 'rubricCode', 60),
        versionNo: integer(dto.versionNo, 'versionNo', 1),
        title: text(dto.title, 'title', 240),
        taskType,
        publishedAt: new Date(),
        rubricCriterions: { create: criteria },
      },
      include: { rubricCriterions: true },
    });
  }
  // Create an AI grading configuration.
  async config(input: unknown, actor: Actor) {
    this.access.role(actor, 'ADMIN');
    const dto = object(input),
      rubricVersionId = uuid(dto.rubricVersionId, 'rubricVersionId');
    const rubric = await this.prisma.rubricVersion.findUnique({
      where: { id: rubricVersionId },
    });
    if (
      !rubric?.publishedAt ||
      rubric.publishedAt > new Date() ||
      !rubric.taskType.startsWith('WRITING')
    )
      throw new NotFoundException('Published Writing rubric required');
    return this.prisma.gradingConfig.create({
      data: {
        provider: 'JSON_HTTP',
        modelId: text(dto.modelId, 'modelId', 120),
        settingsJson: object(dto.settingsJson ?? {}) as Prisma.InputJsonObject,
        rubricVersion: { connect: { id: rubricVersionId } },
        promptVersion: {
          create: {
            promptCode: text(dto.promptCode, 'promptCode', 60),
            versionNo: integer(dto.promptVersionNo, 'promptVersionNo', 1),
            instructions: text(dto.instructions, 'instructions', 50000),
            outputSchemaJson: object(
              dto.outputSchemaJson,
            ) as Prisma.InputJsonObject,
          },
        },
      },
    });
  }
}
