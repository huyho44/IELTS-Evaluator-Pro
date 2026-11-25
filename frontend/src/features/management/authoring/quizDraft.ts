export type QuestionType = "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "SHORT_ANSWER";

export type DraftQuestion = {
  type: QuestionType;
  prompt: string;
  marks: number;
  options: { text: string; correct: boolean }[];
  /** One accepted answer per line. */
  acceptedAnswers: string;
  maxWords: string;
};

export type QuizDraft = {
  title: string;
  skillArea: "READING" | "LISTENING";
  position: number;
  sectionId: string;
  promptText: string;
  instructions: string;
  difficulty: number;
  expectedMinutes: number;
  skillIds: string[];
  questions: DraftQuestion[];
};

export function newQuestion(type: QuestionType = "SINGLE_CHOICE"): DraftQuestion {
  return {
    type,
    prompt: "",
    marks: 1,
    options:
      type === "SHORT_ANSWER"
        ? []
        : [
            { text: "", correct: true },
            { text: "", correct: false },
          ],
    acceptedAnswers: "",
    maxWords: "",
  };
}

// Switching type keeps the prompt; single choice keeps at most one answer.
export function changeType(question: DraftQuestion, type: QuestionType) {
  if (type === "SHORT_ANSWER") return { ...newQuestion(type), prompt: question.prompt, marks: question.marks };
  const options = question.options.length
    ? question.options
    : newQuestion(type).options;
  let seen = false;
  return {
    ...question,
    type,
    options:
      type === "SINGLE_CHOICE"
        ? options.map((option) => {
            const correct = option.correct && !seen;
            if (correct) seen = true;
            return { ...option, correct };
          })
        : options,
  };
}

// Problems shown before submitting; the server validates again.
export function quizProblems(draft: QuizDraft): string[] {
  const problems: string[] = [];
  if (!draft.skillIds.length) problems.push("Choose at least one skill.");
  if (!draft.questions.length) problems.push("Add at least one question.");
  draft.questions.forEach((question, index) => {
    const label = `Question ${index + 1}`;
    if (!question.prompt.trim()) problems.push(`${label} needs a prompt.`);
    if (question.type === "SHORT_ANSWER") {
      if (!acceptedAnswers(question).length)
        problems.push(`${label} needs at least one accepted answer.`);
      return;
    }
    if (question.options.some((option) => !option.text.trim()))
      problems.push(`${label} has an empty option.`);
    const correct = question.options.filter((option) => option.correct).length;
    if (question.type === "SINGLE_CHOICE" && correct !== 1)
      problems.push(`${label} needs exactly one correct option.`);
    if (question.type === "MULTIPLE_CHOICE" && correct < 1)
      problems.push(`${label} needs at least one correct option.`);
  });
  return problems;
}

function acceptedAnswers(question: DraftQuestion) {
  return question.acceptedAnswers
    .split(/\r?\n/)
    .map((answer) => answer.trim())
    .filter(Boolean);
}

// Request body for POST /courses/:id/quizzes.
export function quizPayload(draft: QuizDraft) {
  return {
    title: draft.title.trim(),
    skillArea: draft.skillArea,
    position: draft.position,
    ...(draft.sectionId ? { sectionId: draft.sectionId } : {}),
    promptText: draft.promptText.trim(),
    instructions: draft.instructions.trim(),
    difficulty: draft.difficulty,
    expectedMinutes: draft.expectedMinutes,
    skillIds: draft.skillIds,
    questions: draft.questions.map((question) =>
      question.type === "SHORT_ANSWER"
        ? {
            type: question.type,
            prompt: question.prompt.trim(),
            marks: question.marks,
            acceptedAnswers: acceptedAnswers(question),
            ...(question.maxWords ? { maxWords: Number(question.maxWords) } : {}),
          }
        : {
            type: question.type,
            prompt: question.prompt.trim(),
            marks: question.marks,
            options: question.options.map((option) => ({
              text: option.text.trim(),
              correct: option.correct,
            })),
          },
    ),
  };
}
