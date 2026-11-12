import type { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export async function seedAudioPractice(tx: Prisma.TransactionClient, courseId: string, creatorId: string, id: (n:number)=>string) {
  const publishedAt = new Date('2026-10-20T09:00:00Z');
  for (const skillArea of ['LISTENING','SPEAKING'] as const) {
    const listening = skillArea === 'LISTENING';
    const n = listening ? 8400 : 8500;
    if (await tx.assignmentVersion.findUnique({where:{id:id(n+4)}})) continue;
    const title = listening ? '[Demo] Listen to a library announcement' : '[Demo] Describe a place to study';
    const promptText = listening ? 'Listen to the announcement and answer the question.' : 'Describe a place where you enjoy studying. Explain what helps you concentrate there.';
    await tx.learningItem.create({data:{id:id(n),courseId,kind:'PRACTICE',title,status:'PUBLISHED',position:n}});
    await tx.practiceActivity.create({data:{id:id(n),kind:'PRACTICE',creatorId,skillArea,responseMode:listening?'OBJECTIVE':'SPEAKING'}});
    await tx.activityVersion.create({data:{id:id(n+1),activityId:id(n),versionNo:1,promptText,instructions:listening?'Select both correct answers.':'Record a one-minute response.',difficulty:1,expectedMinutes:3,publishedAt,contentHash:createHash('sha256').update(promptText).digest('hex')}});
    if (listening) {
      const bytes = await readFile(new URL('./library-announcement.wav',import.meta.url));
      await tx.fileAsset.create({data:{id:id(n+5),ownerId:creatorId,storageKey:'demo/library-announcement.wav',originalName:'library-announcement.wav',mimeType:'audio/wav',byteSize:bytes.length,contentHash:createHash('sha256').update(bytes).digest('hex'),audioContent:{create:{bytes:new Uint8Array(bytes)}}}});
      await tx.question.create({data:{id:id(n+6),authorId:creatorId,skillArea,title:'Documents required'}});
      await tx.questionVersion.create({data:{id:id(n+7),questionId:id(n+6),versionNo:1,questionType:'MULTIPLE_CHOICE',promptText:'Which two items should you bring?',stimulusAssetId:id(n+5),publishedAt}});
      for(const [i,contentText] of ['Student card','Photograph','Passport'].entries()) {
        await tx.questionOption.create({data:{id:id(n+10+i),questionVersionId:id(n+7),position:i+1,optionCode:String.fromCharCode(65+i),contentText}});
      }
      await tx.assessmentItem.create({data:{id:id(n+15),activityVersionId:id(n+1),questionVersionId:id(n+7),position:1,maxMarks:1}});
      await tx.answerKeyVersion.create({data:{id:id(n+16),activityVersionId:id(n+1),versionNo:1,publishedAt}});
      await tx.answerKeyEntry.create({data:{id:id(n+17),answerKeyVersionId:id(n+16),assessmentItemId:id(n+15),gradingRuleJson:{method:'EXACT_OPTION_SET',partialCredit:false}}});
      await tx.answerKeyOption.createMany({data:[10,11].map(offset=>({entryId:id(n+17),optionId:id(n+offset)}))});
    }
    await tx.assignment.create({data:{id:id(n+3),activityId:id(n),courseId,creatorId,title}});
    await tx.assignmentVersion.create({data:{id:id(n+4),assignmentId:id(n+3),activityId:id(n),activityVersionId:id(n+1),versionNo:1,mode:'PRACTICE',maxAttempts:10,maxRevisions:1,allowLate:false,releasePolicyJson:{releaseMode:listening?'IMMEDIATE':'MANUAL'},publishedAt}});
  }
}
