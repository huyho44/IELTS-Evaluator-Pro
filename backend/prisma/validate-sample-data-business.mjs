// Read-only checks for this project's illustrative row dataset.
// Structural schema types, PKs, unique keys and FKs are checked by the companion
// validator. These additional checks do not connect to a database or run SQL.
// Quotes use JavaScript offsets, with an exclusive end; the sample text is ASCII.
export function validateBusinessData(dataset) {
  const tables = dataset?.tables ?? {};
  const rows = name => Array.isArray(tables[name]) ? tables[name] : [];
  const maps = new Map();
  const errors = [];
  let checks = 0;
  const has = value => value !== null && value !== undefined;
  const number = value => Number(value);
  const time = value => has(value) ? Date.parse(value) : NaN;
  const close = (left, right) => Number.isFinite(number(left))
    && Number.isFinite(number(right)) && Math.abs(number(left) - number(right)) <= 0.00011;
  const check = (condition, location, message) => {
    checks += 1;
    if (!condition) errors.push(`${location}: ${message}`);
  };
  const lookup = (name, id) => {
    if (!maps.has(name)) maps.set(name, new Map(rows(name).map(row => [row.id, row])));
    return maps.get(name).get(id);
  };
  const each = (name, callback) => {
    rows(name).forEach((row, index) => {
      const here = `${name}[${index}]`;
      try {
        callback(row, here);
      } catch {
        // Report the location without exposing passwords, hashes or row payloads.
        check(false, here, 'business validation could not inspect this row');
      }
    });
  };
  const uniqueWhere = (name, predicate, key, description) => {
    const seen = new Set();
    each(name, (row, here) => {
      if (!predicate(row)) return;
      const value = key(row);
      check(!seen.has(value), here, description);
      seen.add(value);
    });
  };
  const noCycles = (name, edges, description) => {
    const graph = new Map();
    for (const [from, to] of edges) {
      if (!has(to)) continue;
      if (!graph.has(from)) graph.set(from, []);
      graph.get(from).push(to);
    }
    const complete = new Set();
    const active = new Set();
    const visit = node => {
      if (active.has(node)) return false;
      if (complete.has(node)) return true;
      active.add(node);
      for (const next of graph.get(node) ?? []) if (!visit(next)) return false;
      active.delete(node);
      complete.add(node);
      return true;
    };
    for (const node of graph.keys()) {
      if (!visit(node)) {
        check(false, name, description);
        return;
      }
    }
    check(true, name, description);
  };
  const attemptForRevision = revisionId => {
    const revision = lookup('SubmissionRevision', revisionId);
    return revision ? lookup('Attempt', revision.attemptId) : undefined;
  };
  const assignmentForAttempt = attempt => attempt
    ? lookup('AssignmentVersion', attempt.assignmentVersionId) : undefined;
  const itemForResponse = response => response
    ? lookup('AssessmentItem', response.assessmentItemId) : undefined;
  const sum = values => values.reduce((total, value) => total + number(value), 0);
  const asOf = time(dataset?.metadata?.asOf);
  if (Number.isFinite(asOf)) {
    const eventTimes = new Set(['createdAt', 'submittedAt', 'acceptedAt', 'publishedAt',
      'occurredAt', 'requestedAt', 'resolvedAt', 'reviewedAt', 'claimedAt', 'completedAt',
      'startedAt', 'dispatchedAt', 'readAt', 'editedAt', 'grantedAt', 'assignedAt', 'enrolledAt']);
    for (const model of Object.keys(tables)) {
      each(model, (row, here) => {
        for (const field of eventTimes) {
          if (has(row[field])) check(time(row[field]) <= asOf, `${here}.${field}`, 'recorded event must not occur after the sample snapshot');
        }
      });
    }
  }

  // Total/disjoint specialization and shared primary keys.
  for (const group of [
    { parent: 'LearningItem', kinds: { LESSON: 'Lesson', PRACTICE: 'PracticeActivity' } },
    { parent: 'AssessmentResult', kinds: { AI: 'AiResult', TEACHER: 'TeacherResult', ANSWER_KEY: 'AnswerKeyResult' } },
  ]) {
    each(group.parent, (parent, here) => {
      const children = Object.entries(group.kinds)
        .flatMap(([kind, model]) => rows(model).filter(child => child.id === parent.id).map(child => ({ kind, child })));
      check(children.length === 1 && children[0]?.kind === parent.kind,
        `${here}.kind`, 'must have exactly its declared subtype with the same ID');
      if (children.length === 1) {
        check(children[0].child.kind === parent.kind, `${here}.kind`, 'subtype discriminator must match parent');
        if (group.parent === 'AssessmentResult') {
          check(children[0].child.revisionId === parent.revisionId,
            `${here}.revisionId`, 'subtype must refer to the same revision');
        }
      }
    });
    for (const [kind, model] of Object.entries(group.kinds)) {
      each(model, (child, here) => {
        check(child.kind === kind, `${here}.kind`, 'subtype discriminator has the wrong fixed value');
        check(lookup(group.parent, child.id)?.kind === kind, `${here}.id`, 'shared parent has the wrong kind or is missing');
      });
    }
  }

  // Row-level CHECK expressions that need SQL in the production database.
  each('LessonMaterial', (row, here) => {
    const payload = { TEXT: 'contentText', URL: 'externalUrl', FILE: 'fileAssetId' };
    check(Object.values(payload).filter(field => has(row[field])).length === 1
      && has(row[payload[row.kind]]), here, 'must contain exactly the payload selected by kind');
  });
  each('SubmissionRevision', (row, here) => {
    const valid = (row.responseMode === 'OBJECTIVE' && !has(row.writingText) && !has(row.audioAssetId))
      || (row.responseMode === 'WRITING' && has(row.writingText) && !has(row.audioAssetId))
      || (row.responseMode === 'SPEAKING' && has(row.audioAssetId) && !has(row.writingText));
    check(valid, here, 'payload must match responseMode');
    const attempt = lookup('Attempt', row.attemptId);
    const version = lookup('ActivityVersion', attempt?.activityVersionId);
    const activity = lookup('PracticeActivity', version?.activityId);
    if (activity) check(activity.responseMode === row.responseMode, `${here}.responseMode`, 'must match the activity');
    if (attempt) check(time(row.submittedAt) >= time(attempt.startedAt), `${here}.submittedAt`, 'must not precede attempt start');
  });
  each('RevisionParagraph', (row, here) => {
    check(row.startOffset >= 0 && row.endOffset >= row.startOffset, here, 'invalid paragraph bounds');
    const revision = lookup('SubmissionRevision', row.revisionId);
    if (typeof revision?.writingText === 'string') {
      check(revision.writingText.slice(row.startOffset, row.endOffset) === row.text,
        `${here}.text`, 'must equal the revision slice at the stored bounds');
    }
  });
  each('AssessmentResult', (row, here) => {
    check(row.kind === 'ANSWER_KEY' ? !has(row.rubricVersionId) : has(row.rubricVersionId),
      `${here}.rubricVersionId`, 'rubric presence must match the result kind');
  });
  each('AnswerKeyResult', (row, here) => check(number(row.rawScore) >= 0 && number(row.rawScore) <= number(row.maxScore),
    `${here}.rawScore`, 'raw score must lie between zero and maxScore'));
  each('FindingAnchor', (row, here) => {
    check(row.startOffset >= 0 && row.endOffset > row.startOffset, here, 'invalid anchor bounds');
    const paragraph = lookup('RevisionParagraph', row.paragraphId);
    const finding = lookup('Finding', row.findingId);
    const result = lookup('AssessmentResult', finding?.resultId);
    const revision = lookup('SubmissionRevision', paragraph?.revisionId);
    if (paragraph && result) check(paragraph.revisionId === result.revisionId, here, 'paragraph and finding must share a revision');
    const relative = dataset?.metadata?.offsetConvention === 'PARAGRAPH_RELATIVE';
    if (paragraph && revision && typeof revision.writingText === 'string') {
      const start = relative ? paragraph.startOffset + row.startOffset : row.startOffset;
      const end = relative ? paragraph.startOffset + row.endOffset : row.endOffset;
      check(start >= paragraph.startOffset && end <= paragraph.endOffset, here, 'anchor must remain inside its paragraph');
      check(revision.writingText.slice(start, end) === row.exactQuote,
        `${here}.exactQuote`, 'must equal the declared revision slice');
    }
  });
  each('AcceptedAssessment', (row, here) => {
    check(['TEACHER', 'ANSWER_KEY'].includes(row.resultKind), `${here}.resultKind`, 'AI cannot be an accepted source');
    check(!row.isCurrent || has(row.publishedAt), `${here}.isCurrent`, 'a current source must be published');
    if (has(row.publishedAt)) {
      check(time(row.publishedAt) >= time(row.acceptedAt), `${here}.publishedAt`, 'must not precede acceptance');
      if (has(row.releaseAfter)) check(time(row.publishedAt) >= time(row.releaseAfter), `${here}.publishedAt`, 'must respect releaseAfter');
    }
    if (has(row.supersedesId)) {
      const old = lookup('AcceptedAssessment', row.supersedesId);
      if (old) {
        check(old.id !== row.id && old.revisionId === row.revisionId, `${here}.supersedesId`, 'must refer to a different source of the same revision');
        if (has(row.publishedAt) && has(old.publishedAt)) check(time(row.publishedAt) >= time(old.publishedAt), `${here}.publishedAt`, 'replacement must not precede its old source');
      }
    }
  });
  each('SkillPrerequisite', (row, here) => check(row.skillId !== row.prerequisiteSkillId, here, 'skill cannot require itself'));
  each('RecommendationItem', (row, here) => {
    check(row.rank >= 1 && row.rank <= 3, `${here}.rank`, 'rank must lie between one and three');
    check(has(row.targetActivityVersionId) === has(row.targetAssignmentVersionId), here, 'activity and assignment targets must be both present or both null');
    const item = lookup('LearningItem', row.learningItemId);
    if (item) check(item.kind === 'PRACTICE' ? has(row.targetActivityVersionId) && has(row.targetAssignmentVersionId)
      : !has(row.targetActivityVersionId) && !has(row.targetAssignmentVersionId), here, 'target versions must match lesson/practice kind');
  });
  each('ModerationReport', (row, here) => {
    check(['courseId', 'learningItemId', 'postId'].filter(field => has(row[field])).length === 1, here, 'must have exactly one report target');
    if (row.status === 'RESOLVED') check(has(row.resolverId) && has(row.resolvedAt) && has(row.resolution), here, 'resolved report needs resolver, resolution and time');
  });
  uniqueWhere('InstructorApplication', row => row.status === 'PENDING', row => row.applicantId,
    'there may be only one pending application per applicant');
  uniqueWhere('ReviewCase', row => ['PENDING', 'CLAIMED'].includes(row.status), row => row.revisionId,
    'there may be only one active review per revision');
  uniqueWhere('AcceptedAssessment', row => row.isCurrent, row => row.revisionId,
    'there may be only one current accepted source per revision');
  noCycles('AcceptedAssessment', rows('AcceptedAssessment').map(row => [row.id, row.supersedesId]), 'supersedes must be acyclic');
  noCycles('ReviewDecision', rows('ReviewDecision').map(row => [row.id, row.supersedesId]), 'supersedes must be acyclic');
  noCycles('SkillPrerequisite', rows('SkillPrerequisite').map(row => [row.skillId, row.prerequisiteSkillId]), 'prerequisites must be acyclic');
  noCycles('DiscussionPost', rows('DiscussionPost').map(row => [row.id, row.parentPostId]), 'replies must be acyclic');

  // LMS and opportunity context that cannot be inferred from a single FK.
  each('LessonProgress', (row, here) => {
    const enrollment = lookup('Enrollment', row.enrollmentId);
    const item = lookup('LearningItem', row.lessonId);
    if (enrollment && item) check(enrollment.courseId === item.courseId, here, 'lesson and enrollment must share a course');
  });
  each('Assignment', (row, here) => {
    const item = lookup('LearningItem', row.activityId);
    if (item) check(item.courseId === row.courseId, here, 'assignment activity must belong to its course');
    if (has(row.contextLessonId)) {
      const lessonItem = lookup('LearningItem', row.contextLessonId);
      if (lessonItem) check(lessonItem.courseId === row.courseId, here, 'context lesson must belong to the assignment course');
    }
  });
  each('Attempt', (row, here) => {
    const version = assignmentForAttempt(row);
    const assignment = lookup('Assignment', row.assignmentId);
    if (assignment) check(rows('Enrollment').some(enrollment => enrollment.learnerId === row.learnerId
      && enrollment.courseId === assignment.courseId && enrollment.status === 'ACTIVE'), here, 'learner must have active course enrollment in this sample');
    if (version) {
      check(row.attemptNo >= 1 && row.attemptNo <= version.maxAttempts, `${here}.attemptNo`, 'must respect the assignment attempt quota');
      const revisions = rows('SubmissionRevision').filter(revision => revision.attemptId === row.id);
      check(revisions.length <= version.maxRevisions, here, 'must respect the revision quota');
    }
    if (has(row.recommendationItemId)) {
      const item = lookup('RecommendationItem', row.recommendationItemId);
      const run = lookup('RecommendationRun', item?.runId);
      if (item && run) {
        check(row.learnerId === run.learnerId, `${here}.learnerId`, 'must match the recommendation recipient');
        check(row.assignmentVersionId === item.targetAssignmentVersionId && row.activityVersionId === item.targetActivityVersionId,
          `${here}.recommendationItemId`, 'clicked recommendation must lead to its pinned versions');
        check(time(row.startedAt) >= time(run.createdAt), `${here}.startedAt`, 'must not precede the recommendation');
      }
    }
  });
  each('AttemptDraft', (row, here) => {
    const attempt = lookup('Attempt', row.attemptId);
    if (attempt) check(attempt.status === 'IN_PROGRESS', here, 'sample live draft must belong to an in-progress attempt');
  });

  // Objective answers, keys and score lineage.
  each('AnswerKeyEntry', (row, here) => {
    const key = lookup('AnswerKeyVersion', row.answerKeyVersionId);
    const item = lookup('AssessmentItem', row.assessmentItemId);
    const question = lookup('QuestionVersion', item?.questionVersionId);
    if (key && item) check(key.activityVersionId === item.activityVersionId, here, 'key and item must share an activity version');
    if (question?.questionType === 'SHORT_ANSWER') check(Array.isArray(row.acceptedTextsJson) && row.acceptedTextsJson.length > 0,
      `${here}.acceptedTextsJson`, 'short-answer key needs accepted answer text');
  });
  each('AnswerKeyOption', (row, here) => {
    const entry = lookup('AnswerKeyEntry', row.entryId);
    const item = lookup('AssessmentItem', entry?.assessmentItemId);
    const option = lookup('QuestionOption', row.optionId);
    if (item && option) check(item.questionVersionId === option.questionVersionId, here, 'key option must belong to the entry question');
  });
  each('ItemResponse', (row, here) => {
    const attempt = attemptForRevision(row.revisionId);
    const item = itemForResponse(row);
    const question = lookup('QuestionVersion', item?.questionVersionId);
    const selections = rows('ResponseSelection').filter(selection => selection.responseId === row.id);
    if (attempt && item) check(attempt.activityVersionId === item.activityVersionId, here, 'response item must belong to the attempted version');
    if (question?.questionType === 'SHORT_ANSWER') check(selections.length === 0, here, 'short answer cannot have option selections');
    if (question?.questionType === 'SINGLE_CHOICE') check(selections.length <= 1 && !has(row.textAnswer), here, 'single-choice answer permits at most one selection and no text payload');
    if (question?.questionType === 'MULTIPLE_CHOICE') check(!has(row.textAnswer), here, 'multiple-choice answer uses option selections');
  });
  each('ResponseSelection', (row, here) => {
    const response = lookup('ItemResponse', row.responseId);
    const item = itemForResponse(response);
    const option = lookup('QuestionOption', row.optionId);
    if (item && option) check(item.questionVersionId === option.questionVersionId, here, 'selected option must belong to the response question');
  });
  each('QuestionMark', (row, here) => {
    const result = lookup('AnswerKeyResult', row.answerKeyResultId);
    const response = lookup('ItemResponse', row.responseId);
    const entry = lookup('AnswerKeyEntry', row.keyEntryId);
    const item = itemForResponse(response);
    if (result && response) check(result.revisionId === response.revisionId, here, 'mark response must belong to the result revision');
    if (result && entry) check(result.answerKeyVersionId === entry.answerKeyVersionId, here, 'mark must use the result answer-key version');
    if (response && entry) check(response.assessmentItemId === entry.assessmentItemId, here, 'response and key entry must concern the same item');
    if (item) check(number(row.awardedMarks) >= 0 && number(row.awardedMarks) <= number(item.maxMarks), `${here}.awardedMarks`, 'must respect item marks');
    const rule = entry?.gradingRuleJson;
    if (response && entry && item && rule?.method === 'TEXT_EXACT') {
      const normalize = input => {
        let text = String(input ?? '');
        if (rule.trim !== false) text = text.trim();
        if (rule.collapseSpaces ?? rule.collapse_spaces ?? false) text = text.replace(/\s+/g, ' ');
        if (!(rule.caseSensitive ?? rule.case_sensitive ?? false)) text = text.toLowerCase();
        return text;
      };
      const maxWords = rule.maxWords ?? rule.max_words;
      const actual = normalize(response.textAnswer);
      const withinWordLimit = !has(maxWords) || actual.split(/\s+/).filter(Boolean).length <= number(maxWords);
      const correct = withinWordLimit && Array.isArray(entry.acceptedTextsJson)
        && entry.acceptedTextsJson.some(answer => normalize(answer) === actual);
      check(close(row.awardedMarks, correct ? item.maxMarks : 0), `${here}.awardedMarks`, 'must match the declared exact-text rule');
    }
    if (response && entry && item && rule?.method === 'EXACT_OPTION_SET'
      && !(rule.partialCredit ?? rule.partial_credit ?? false)) {
      const chosen = rows('ResponseSelection').filter(selection => selection.responseId === response.id).map(selection => selection.optionId).sort();
      const expected = rows('AnswerKeyOption').filter(option => option.entryId === entry.id).map(option => option.optionId).sort();
      const correct = expected.length > 0 && JSON.stringify(chosen) === JSON.stringify(expected);
      check(close(row.awardedMarks, correct ? item.maxMarks : 0), `${here}.awardedMarks`, 'must match the declared exact-option-set rule');
    }
  });
  each('AnswerKeyResult', (row, here) => {
    const key = lookup('AnswerKeyVersion', row.answerKeyVersionId);
    const attempt = attemptForRevision(row.revisionId);
    const parent = lookup('AssessmentResult', row.id);
    if (key && attempt) check(key.activityVersionId === attempt.activityVersionId, here, 'result key must belong to the attempted version');
    const marks = rows('QuestionMark').filter(mark => mark.answerKeyResultId === row.id);
    check(close(sum(marks.map(mark => mark.awardedMarks)), row.rawScore), `${here}.rawScore`, 'must equal the sum of QuestionMark');
    if (key) {
      const items = rows('AssessmentItem').filter(item => item.activityVersionId === key.activityVersionId);
      check(close(sum(items.map(item => item.maxMarks)), row.maxScore), `${here}.maxScore`, 'must equal the attempted item maximum');
    }
    if (parent?.scoreScale === 'RAW') check(has(parent.overallScore) && close(parent.overallScore, row.rawScore), here, 'RAW overall score must equal rawScore');
  });

  // AI/manual results preserve rubric and revision provenance.
  each('AiResult', (row, here) => {
    const parent = lookup('AssessmentResult', row.id);
    const run = lookup('GradingRun', row.gradingRunId);
    const config = lookup('GradingConfig', run?.configId);
    if (parent && config) check(parent.rubricVersionId === config.rubricVersionId, here, 'AI result rubric must match its grading configuration');
    if (run) {
      check(run.status === 'COMPLETED', `${here}.gradingRunId`, 'normalized AI result needs a completed run');
      check(rows('ProviderAttempt').some(attempt => attempt.gradingRunId === run.id && attempt.status === 'SUCCESS'), here, 'normalized AI result needs a successful provider attempt');
    }
  });
  each('AssessmentResult', (row, here) => {
    if (row.kind === 'ANSWER_KEY') return;
    const attempt = attemptForRevision(row.revisionId);
    const assignment = assignmentForAttempt(attempt);
    if (has(assignment?.rubricVersionId)) check(assignment.rubricVersionId === row.rubricVersionId, here, 'result must use the assigned rubric');
    const criteria = rows('RubricCriterion').filter(criterion => criterion.rubricVersionId === row.rubricVersionId);
    const scores = rows('CriterionScore').filter(score => score.resultId === row.id);
    check(criteria.length > 0 && scores.length === criteria.length, here, 'sample rubric result must score every configured criterion');
    if (row.scoreScale === 'BAND' && has(row.overallScore)) check(number(row.overallScore) >= 0 && number(row.overallScore) <= 9, `${here}.overallScore`, 'band score must lie between zero and nine');
  });
  each('CriterionScore', (row, here) => {
    const criterion = lookup('RubricCriterion', row.criterionId);
    if (criterion) check(number(row.score) >= 0 && number(row.score) <= number(criterion.maxScore), `${here}.score`, 'must respect criterion scale');
  });
  each('TeacherResult', (row, here) => {
    const decision = lookup('ReviewDecision', row.decisionId);
    const review = lookup('ReviewCase', decision?.reviewCaseId);
    if (review) {
      check(review.status === 'CONFIRMED', here, 'teacher result must follow a confirmed review in the sample');
      if (has(review.assigneeId)) check(review.assigneeId === decision.teacherId, here, 'decision teacher must own the review');
    }
  });
  each('ReviewDecision', (row, here) => {
    const review = lookup('ReviewCase', row.reviewCaseId);
    if (review) {
      check(time(row.decidedAt) >= time(review.createdAt), `${here}.decidedAt`, 'decision must follow review creation');
      if (has(review.claimedAt)) check(time(row.decidedAt) >= time(review.claimedAt), `${here}.decidedAt`, 'decision must follow the review claim');
    }
    if (!has(row.supersedesId)) return;
    const old = lookup('ReviewDecision', row.supersedesId);
    if (old) check(old.id !== row.id && old.revisionId === row.revisionId, `${here}.supersedesId`, 'must replace a different decision of the same revision');
  });
  each('ReviewCase', (row, here) => {
    if (has(row.claimedAt)) check(time(row.claimedAt) >= time(row.createdAt), `${here}.claimedAt`, 'claim must follow review creation');
  });
  each('Appeal', (row, here) => {
    const attempt = attemptForRevision(row.revisionId);
    const accepted = lookup('AcceptedAssessment', row.acceptedId);
    if (attempt) check(attempt.learnerId === row.requesterId, `${here}.requesterId`, 'sample appeal must be requested by the submission owner');
    if (has(accepted?.publishedAt)) check(time(row.requestedAt) >= time(accepted.publishedAt), `${here}.requestedAt`, 'appeal must follow publication');
    if (row.status === 'RESOLVED') {
      check(has(row.resolution) && has(row.resolvedAt), here, 'resolved appeal needs resolution and time');
      check(time(row.resolvedAt) >= time(row.requestedAt), `${here}.resolvedAt`, 'resolution must follow request');
      const review = lookup('ReviewCase', row.reviewCaseId);
      if (review) check(review.status === 'CONFIRMED', `${here}.reviewCaseId`, 'resolved appeal must have a confirmed review');
    }
  });

  // Accepted evidence, profile lineage and optional demonstrative projection math.
  each('SkillEvidence', (row, here) => {
    const accepted = lookup('AcceptedAssessment', row.acceptedId);
    const observation = lookup('SkillObservation', row.observationId);
    if (accepted && observation) {
      check(accepted.resultId === observation.resultId && row.resultId === accepted.resultId, here, 'accepted source and observation must share result');
      check(['TEACHER', 'ANSWER_KEY'].includes(accepted.resultKind) && has(accepted.publishedAt), here, 'evidence needs a published non-AI source');
      check(time(row.createdAt) >= time(accepted.publishedAt), `${here}.createdAt`, 'evidence cannot precede source publication');
    }
  });
  if (dataset?.metadata?.demoPolicy) {
    each('SkillObservation', (row, here) => {
      const result = lookup('AnswerKeyResult', row.resultId);
      if (!result) return;
      const marks = rows('QuestionMark').filter(mark => mark.answerKeyResultId === result.id);
      const weighted = marks.flatMap(mark => {
        const response = lookup('ItemResponse', mark.responseId);
        const item = itemForResponse(response);
        const tag = rows('ItemSkill').find(mapping => mapping.assessmentItemId === item?.id && mapping.skillId === row.skillId);
        if (!item || !tag || !(number(item.maxMarks) > 0)) return [];
        return [{ fraction: number(mark.awardedMarks) / number(item.maxMarks), weight: number(tag.observationWeight) }];
      });
      const denominator = sum(weighted.map(value => value.weight));
      const fraction = denominator > 0 ? sum(weighted.map(value => value.fraction * value.weight)) / denominator : null;
      const expected = fraction === null ? 'NOT_OBSERVED' : fraction <= 0 ? 'NOT_MET' : fraction >= 1 ? 'MET' : 'PARTIAL';
      check(row.outcome === expected, `${here}.outcome`, 'must match the illustrative objective-skill aggregation');
    });
  }
  const latestProfile = new Map();
  for (const profile of rows('LearnerProfileVersion')) {
    const current = latestProfile.get(profile.learnerId);
    if (!current || profile.versionNo > current.versionNo) latestProfile.set(profile.learnerId, profile);
  }
  const contributionByProfileSkill = new Map();
  const opportunityKeys = new Set();
  each('ProfileContribution', (row, here) => {
    const profile = lookup('LearnerProfileVersion', row.profileId);
    const evidence = lookup('SkillEvidence', row.evidenceId);
    const accepted = lookup('AcceptedAssessment', evidence?.acceptedId);
    const observation = lookup('SkillObservation', evidence?.observationId);
    const result = lookup('AssessmentResult', evidence?.resultId);
    const attempt = attemptForRevision(result?.revisionId);
    if (!profile || !evidence || !accepted || !observation || !attempt) return;
    check(profile.learnerId === attempt.learnerId, here, 'profile and contributed evidence must belong to the same learner');
    check(number(row.effectiveWeight) > 0, `${here}.effectiveWeight`, 'sample included contributions require positive weight');
    const key = `${profile.id}|${attempt.id}|${observation.skillId}`;
    check(!opportunityKeys.has(key), here, 'profile must not count several revisions/sources of the same Attempt-Skill');
    opportunityKeys.add(key);
    check(time(evidence.createdAt) <= time(profile.createdAt), here, 'profile cannot precede included evidence');
    const effectiveSources = rows('AcceptedAssessment').filter(source => source.revisionId === accepted.revisionId
      && has(source.publishedAt) && time(source.publishedAt) <= time(profile.createdAt));
    const newestPublication = Math.max(...effectiveSources.map(source => time(source.publishedAt)));
    check(time(accepted.publishedAt) === newestPublication, here, 'source must have been effective when this profile was built');
    if (latestProfile.get(profile.learnerId)?.id === profile.id) check(accepted.isCurrent, here, 'latest sample profile must use current accepted sources');
    const stateKey = `${profile.id}|${observation.skillId}`;
    if (!contributionByProfileSkill.has(stateKey)) contributionByProfileSkill.set(stateKey, []);
    contributionByProfileSkill.get(stateKey).push({ row, observation, attempt });
    check(rows('LearnerSkillState').some(state => state.profileId === profile.id && state.skillId === observation.skillId), here, 'contributed skill needs a profile state');
  });
  const demoPolicy = dataset?.metadata?.demoPolicy;
  const outcomes = demoPolicy?.outcomeValues;
  const target = number(demoPolicy?.targetEvidenceCount ?? demoPolicy?.target ?? 3);
  const threshold = number(demoPolicy?.observedSupportThreshold ?? 0.75);
  each('LearnerSkillState', (row, here) => {
    check(number(row.support) >= 0 && number(row.support) <= 1, `${here}.support`, 'support must lie between zero and one');
    if (has(row.strength)) check(number(row.strength) >= 0 && number(row.strength) <= 1, `${here}.strength`, 'strength must lie between zero and one');
    if (row.observationStatus === 'UNKNOWN') check(!has(row.strength) && number(row.support) === 0 && row.evidenceCount === 0,
      here, 'unknown skill must remain null with zero support and evidence');
    if (!outcomes || !(target > 0)) return;
    const included = (contributionByProfileSkill.get(`${row.profileId}|${row.skillId}`) ?? [])
      .filter(entry => entry.observation.outcome !== 'NOT_OBSERVED' && has(outcomes[entry.observation.outcome]));
    const evidenceCount = new Set(included.map(entry => entry.attempt.id)).size;
    const expectedSupport = Math.min(evidenceCount / target, 1);
    check(row.evidenceCount === evidenceCount, `${here}.evidenceCount`, 'must match independent observed opportunities under the demo policy');
    check(close(row.support, expectedSupport), `${here}.support`, 'must match the declared demo support policy');
    if (included.length === 0) {
      check(!has(row.strength) && row.observationStatus === 'UNKNOWN', here, 'no observed evidence means UNKNOWN, not zero strength');
    } else {
      const weights = sum(included.map(entry => entry.row.effectiveWeight));
      const expectedStrength = sum(included.map(entry => number(entry.row.effectiveWeight) * number(outcomes[entry.observation.outcome]))) / weights;
      check(has(row.strength) && close(row.strength, expectedStrength), `${here}.strength`, 'must match weighted outcome values from the demo policy');
      check(row.observationStatus === (expectedSupport >= threshold ? 'OBSERVED' : 'INSUFFICIENT'), `${here}.observationStatus`, 'must match the demo support threshold');
    }
  });

  // Discussion and outbox state, followed by optional RAG provenance.
  each('DiscussionThread', (row, here) => {
    const item = lookup('LearningItem', row.contextItemId);
    if (item) check(item.courseId === row.courseId, here, 'thread context must belong to the course');
  });
  each('DiscussionPost', (row, here) => {
    const parent = lookup('DiscussionPost', row.parentPostId);
    if (parent) check(parent.id !== row.id && parent.threadId === row.threadId, `${here}.parentPostId`, 'reply must be in the same thread and cannot refer to itself');
  });
  each('OutboxEvent', (row, here) => {
    if (row.status === 'DISPATCHED') check(has(row.dispatchedAt) && time(row.dispatchedAt) >= time(row.createdAt), here, 'dispatched event needs a dispatch time after creation');
    if (row.status === 'PENDING') check(!has(row.dispatchedAt), `${here}.dispatchedAt`, 'pending event must not claim dispatch');
    if (rows(row.aggregateType).length > 0) check(Boolean(lookup(row.aggregateType, row.aggregateId)), `${here}.aggregateId`, 'sample aggregate entity must exist');
    const payloadModels = { acceptedId: 'AcceptedAssessment', acceptedAssessmentId: 'AcceptedAssessment', resultId: 'AssessmentResult', revisionId: 'SubmissionRevision', profileId: 'LearnerProfileVersion', recommendationRunId: 'RecommendationRun', gradingRunId: 'GradingRun', learnerId: 'User' };
    for (const [field, model] of Object.entries(payloadModels)) {
      if (has(row.payloadJson?.[field])) check(Boolean(lookup(model, row.payloadJson[field])), `${here}.payloadJson.${field}`, 'referenced sample entity must exist');
    }
  });
  each('KnowledgeDocument', (row, here) => {
    const item = lookup('LearningItem', row.sourceItemId);
    if (item) check(item.courseId === row.courseId, here, 'document source item must belong to its course');
  });
  each('KnowledgeChunk', (row, here) => {
    const version = lookup('KnowledgeDocumentVersion', row.documentVersionId);
    if (version) check(typeof version.textSnapshot === 'string' && version.textSnapshot.includes(row.text), `${here}.text`, 'chunk must come from the immutable document snapshot');
  });
  each('FeedbackExplanation', (row, here) => {
    const attempt = attemptForRevision(row.revisionId);
    const finding = lookup('Finding', row.findingId);
    const result = lookup('AssessmentResult', finding?.resultId);
    if (attempt) check(attempt.learnerId === row.learnerId, here, 'explanation learner must own the revision');
    if (result && has(row.revisionId)) check(result.revisionId === row.revisionId, here, 'finding must concern the explanation revision');
  });
  each('ExplanationCitation', (row, here) => {
    const explanation = lookup('FeedbackExplanation', row.explanationId);
    const chunk = lookup('KnowledgeChunk', row.chunkId);
    const version = lookup('KnowledgeDocumentVersion', chunk?.documentVersionId);
    const document = lookup('KnowledgeDocument', version?.documentId);
    if (chunk) check(typeof row.exactQuote === 'string' && row.exactQuote.length > 0 && chunk.text.includes(row.exactQuote), `${here}.exactQuote`, 'citation quote must be a literal substring of the chunk');
    if (version && explanation) check(has(version.publishedAt) && time(version.publishedAt) <= time(explanation.createdAt), here, 'citation needs a document version published before explanation');
    if (document && explanation) {
      check(document.status === 'PUBLISHED', here, 'sample retrieved document must be published');
      const attempt = attemptForRevision(explanation.revisionId);
      const assignment = lookup('Assignment', attempt?.assignmentId);
      if (assignment) check(document.courseId === assignment.courseId, here, 'sample cited source must belong to the same course');
      if (document.visibility !== 'PUBLIC') check(rows('Enrollment').some(enrollment => enrollment.learnerId === explanation.learnerId
        && enrollment.courseId === document.courseId && enrollment.status === 'ACTIVE'), here, 'learner needs access to non-public source course');
    }
  });
  return { checks, errors };
}
