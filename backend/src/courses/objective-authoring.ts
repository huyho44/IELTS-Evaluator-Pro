import { BadRequestException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service.js';
import { integer, object, text, uuid } from '../auth/validation.js';

function lines(value: unknown, label: string, max: number) {
  if (!Array.isArray(value) || !value.length || value.length > max) throw new BadRequestException('Invalid '+label);
  const values = value.map(v => text(v,label,1000));
  if (new Set(values).size !== values.length) throw new BadRequestException('Duplicate '+label);
  return values;
}
function parseQuestion(value: unknown) {
  const q = object(value);
  const promptText = text(q.prompt,'question',4000);
  const type = q.type;
  if (type === 'SHORT_ANSWER') return { type, promptText, answers: lines(q.answers,'accepted answers',20) } as const;
  if (type !== 'SINGLE_CHOICE' && type !== 'MULTIPLE_CHOICE') throw new BadRequestException('Invalid question type');
  const options = lines(q.options,'options',20);
  if (options.length < 2 || !Array.isArray(q.correct) || !q.correct.length) throw new BadRequestException('Choose correct answers from at least two options');
  const correct = q.correct.map(i=>integer(i,'correct option',0,options.length-1));
  if (new Set(correct).size !== correct.length || (type === 'SINGLE_CHOICE' ? correct.length !== 1 : correct.length < 2))
    throw new BadRequestException('Check the number of correct choices');
  return {type,promptText,options,correct} as const;
}
export async function publishObjective(db: PrismaService, courseId: string, authorId: string, input: unknown, audio?: {buffer: Buffer; mimetype: string}) {
  const dto = object(input);
  const area = dto.skillArea;
  if (area !== 'READING' && area !== 'LISTENING') throw new BadRequestException('Choose Reading or Listening');
  if (area === 'LISTENING' ? !audio?.buffer.length : !!audio) throw new BadRequestException('Attach a recording for Listening only');
  if (audio && !['audio/wav','audio/x-wav','audio/webm','audio/mp4','audio/mpeg','audio/ogg'].includes(audio.mimetype)) throw new BadRequestException('Unsupported audio format');
  const title = text(dto.title,'title',240), promptText = text(dto.prompt,'passage or prompt',60000), instructions = text(dto.instructions,'instructions');
  const position = integer(dto.position,'position',1);
  if (!Array.isArray(dto.questions) || !dto.questions.length || dto.questions.length > 40) throw new BadRequestException('Provide 1–40 questions');
  const questions = dto.questions.map(parseQuestion);
  const publishedAt = new Date();
  return db.$transaction(async tx => {
    const chapterId = dto.sectionId ? uuid(dto.sectionId,'sectionId') : null;
    if (chapterId && !await tx.chapter.findFirst({where:{id:chapterId,courseId}})) throw new BadRequestException('Section must belong to this course');
    const digest = audio && createHash('sha256').update(audio.buffer).digest('hex');
    const asset = audio && digest ? await tx.fileAsset.create({data:{ownerId:authorId,storageKey:'listening/'+randomUUID(),originalName:title,mimeType:audio.mimetype,byteSize:audio.buffer.length,contentHash:digest,audioContent:{create:{bytes:new Uint8Array(audio.buffer)}}},select:{id:true}}) : null;
    const item = await tx.learningItem.create({data:{courseId,chapterId,kind:'PRACTICE',title,position,status:'PUBLISHED',practiceActivity:{create:{creatorId:authorId,skillArea:area,responseMode:'OBJECTIVE'}}}});
    const version = await tx.activityVersion.create({data:{activityId:item.id,versionNo:1,promptText,instructions,difficulty:integer(dto.difficulty ?? 2,'difficulty',1,5),expectedMinutes:integer(dto.minutes ?? 15,'minutes',1,240),publishedAt,contentHash:createHash('sha256').update(JSON.stringify({promptText,instructions,questions,digest})).digest('hex')}});
    const key = await tx.answerKeyVersion.create({data:{activityVersionId:version.id,versionNo:1,publishedAt}});
    for (const [i,q] of questions.entries()) {
      const question = await tx.question.create({data:{authorId,skillArea:area,title:q.promptText.slice(0,200)}});
      const questionVersion = await tx.questionVersion.create({data:{questionId:question.id,versionNo:1,questionType:q.type,promptText:q.promptText,stimulusAssetId:asset?.id,publishedAt}});
      const assessment = await tx.assessmentItem.create({data:{activityVersionId:version.id,questionVersionId:questionVersion.id,position:i+1,maxMarks:1}});
      const entry = await tx.answerKeyEntry.create({data:{answerKeyVersionId:key.id,assessmentItemId:assessment.id,acceptedTextsJson:q.answers,gradingRuleJson:q.type === 'SHORT_ANSWER' ? {method:'TEXT_EXACT',trim:true,caseSensitive:false,collapseSpaces:true} : {method:'EXACT_OPTION_SET',partialCredit:false}}});
      if (q.options) {
        const options = q.options.map((contentText,index)=>({id:randomUUID(),questionVersionId:questionVersion.id,contentText,position:index+1,optionCode:String.fromCharCode(65+index)}));
        await tx.questionOption.createMany({data:options});
        await tx.answerKeyOption.createMany({data:q.correct.map(index=>({entryId:entry.id,optionId:options[index].id}))});
      }
    }
    return { activityVersionId:version.id };
  }, {timeout:30000});
}
