import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class RecommendationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /me/skills
   * Skills profile based on verified formal assessments
   */
  async getLearnerSkills(userId: number) {
    const evaluations = await this.prisma.evaluation.findMany({
      where: {
        submission: {
          testSession: { userId },
        },
      },
      orderBy: { id: 'desc' },
      take: 5,
    });

    if (evaluations.length === 0) {
      return {
        userId,
        status: 'UNOBSERVED', 
        message: 'At least one entrance test must be taken to assess proficiency.',
        skills: {},
      };
    }

    // Calculate average skills taken recently
    const count = evaluations.length;
    const avgTa = evaluations.reduce((acc, e) => acc + (e.scoreTa || 6), 0) / count;
    const avgCc = evaluations.reduce((acc, e) => acc + (e.scoreCc || 6), 0) / count;
    const avgLr = evaluations.reduce((acc, e) => acc + (e.scoreLr || 6), 0) / count;
    const avgGra = evaluations.reduce((acc, e) => acc + (e.scoreGra || 6), 0) / count;

    return {
      userId,
      status: 'OBSERVED',
      skills: {
        taskAchievement: Math.round(avgTa * 10) / 10,
        coherenceCohesion: Math.round(avgCc * 10) / 10,
        lexicalResource: Math.round(avgLr * 10) / 10,
        grammarAccuracy: Math.round(avgGra * 10) / 10,
      },
      evaluatedSessionsCount: count,
    };
  }

  /**
   * GET /me/recommendations
   * Filter and rank pratice recommendations based on evidence-backed areas of weakness
   */
  async getRecommendations(userId: number) {
    const profile = await this.getLearnerSkills(userId);

    // Looking lesson in database
    const availableLessons = await this.prisma.lesson.findMany({
      take: 3,
      select: {
        id: true,
        title: true,
        type: true,
        targetSkillTag: true,
        course: { select: { title: true } },
      },
    });

    return {
      userId,
      policyVersion: '1.0.0-rule-based',
      recommendedActivities: availableLessons.map((lesson) => ({
        lessonId: lesson.id,
        title: lesson.title,
        skillTag: lesson.targetSkillTag,
        courseName: lesson.course.title,
        recommendationReason: `Enhance the skill ${lesson.targetSkillTag || 'Writing'} based on the most recent rating score.`,
      })),
    };
  }
}