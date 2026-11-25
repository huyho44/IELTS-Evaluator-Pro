import { useState } from "react";
import { field } from "../managementApi";
import type { AuthoringProps, SkillRow } from "./authoringTypes";
import {
  changeType,
  newQuestion,
  quizPayload,
  quizProblems,
  type DraftQuestion,
  type QuestionType,
  type QuizDraft,
} from "./quizDraft";

const TYPE_LABELS: Record<QuestionType, string> = {
  SINGLE_CHOICE: "One correct option",
  MULTIPLE_CHOICE: "Several correct options",
  SHORT_ANSWER: "Short answer (fill in)",
};

function emptyDraft(position: number): QuizDraft {
  return {
    title: "",
    skillArea: "READING",
    position,
    sectionId: "",
    promptText: "",
    instructions: "Answer all questions.",
    difficulty: 2,
    expectedMinutes: 10,
    skillIds: [],
    questions: [newQuestion()],
  };
}

// A9: instructors build an auto-graded Reading/Listening quiz. Saving creates
// the practice, its questions and a published answer key; it can then be
// published as an assignment in the Assignments tab.
export default function QuizBuilder({
  course,
  busy,
  run,
  skills,
}: AuthoringProps & { skills: SkillRow[] }) {
  const [draft, setDraft] = useState(() =>
    emptyDraft(course.learningItems.length + 1),
  );
  const [showProblems, setShowProblems] = useState(false);
  const problems = quizProblems(draft);
  const areaSkills = skills.filter(
    (skill) => skill.skillArea === draft.skillArea,
  );
  const update = (patch: Partial<QuizDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));
  const setQuestion = (index: number, question: DraftQuestion) =>
    update({
      questions: draft.questions.map((row, i) => (i === index ? question : row)),
    });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setShowProblems(true);
        if (problems.length) return;
        void run("POST", `/courses/${course.id}/quizzes`, quizPayload(draft)).then(
          (ok) => {
            if (ok) {
              setDraft(emptyDraft(course.learningItems.length + 2));
              setShowProblems(false);
            }
          },
        );
      }}
      className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs"
    >
      <div>
        <h2 className="text-base font-bold text-slate-900">
          Create an auto-graded quiz
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Answers are marked automatically from the key you set here. After
          saving, publish it from the Assignments tab so learners can start it.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm font-medium text-slate-800">
          Title
          <input
            required
            maxLength={240}
            value={draft.title}
            onChange={(event) => update({ title: event.target.value })}
            className={`${field} mt-1`}
          />
        </label>
        <label className="block text-sm font-medium text-slate-800">
          Skill area
          <select
            value={draft.skillArea}
            onChange={(event) =>
              update({
                skillArea: event.target.value as QuizDraft["skillArea"],
                skillIds: [],
              })
            }
            className={`${field} mt-1`}
          >
            <option value="READING">Reading</option>
            <option value="LISTENING">Listening (audio added later)</option>
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-800">
          Section
          <select
            value={draft.sectionId}
            onChange={(event) => update({ sectionId: event.target.value })}
            className={`${field} mt-1`}
          >
            <option value="">No section</option>
            {course.chapters.map((chapter) => (
              <option key={chapter.id} value={chapter.id}>
                {chapter.title}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["position", "Order", 1, 9999],
              ["difficulty", "Difficulty", 1, 5],
              ["expectedMinutes", "Minutes", 1, 240],
            ] as const
          ).map(([key, label, min, max]) => (
            <label key={key} className="block text-sm font-medium text-slate-800">
              {label}
              <input
                type="number"
                min={min}
                max={max}
                required
                value={draft[key]}
                onChange={(event) => update({ [key]: Number(event.target.value) })}
                className={`${field} mt-1`}
              />
            </label>
          ))}
        </div>
      </div>
      <label className="block text-sm font-medium text-slate-800">
        {draft.skillArea === "READING" ? "Reading passage" : "Listening transcript or context"}
        <textarea
          required
          rows={5}
          value={draft.promptText}
          onChange={(event) => update({ promptText: event.target.value })}
          className={`${field} mt-1`}
        />
      </label>
      <label className="block text-sm font-medium text-slate-800">
        Instructions
        <input
          required
          value={draft.instructions}
          onChange={(event) => update({ instructions: event.target.value })}
          className={`${field} mt-1`}
        />
      </label>
      <fieldset className="rounded-xl border border-slate-200 p-3">
        <legend className="px-1 text-sm font-medium text-slate-800">
          Skills measured
        </legend>
        {areaSkills.length ? (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {areaSkills.map((skill) => (
              <label key={skill.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.skillIds.includes(skill.id)}
                  onChange={(event) =>
                    update({
                      skillIds: event.target.checked
                        ? [...draft.skillIds, skill.id]
                        : draft.skillIds.filter((id) => id !== skill.id),
                    })
                  }
                  className="size-4 rounded border-slate-300"
                />
                {skill.name}
              </label>
            ))}
          </div>
        ) : (
          <p className="text-xs text-amber-700">
            No published {draft.skillArea.toLowerCase()} skills yet. An admin
            can add one in the Skill catalog.
          </p>
        )}
      </fieldset>

      <div className="space-y-3">
        {draft.questions.map((question, index) => (
          <QuestionEditor
            key={index}
            index={index}
            question={question}
            onChange={(next) => setQuestion(index, next)}
            onRemove={
              draft.questions.length > 1
                ? () =>
                    update({
                      questions: draft.questions.filter((_, i) => i !== index),
                    })
                : undefined
            }
          />
        ))}
        <button
          type="button"
          disabled={draft.questions.length >= 50}
          onClick={() => update({ questions: [...draft.questions, newQuestion()] })}
          className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          + Add question
        </button>
      </div>

      {showProblems && problems.length > 0 && (
        <ul role="alert" className="list-disc space-y-0.5 rounded-lg bg-red-50 px-6 py-2 text-xs text-red-700">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
      >
        {busy ? "Saving..." : "Create quiz"}
      </button>
    </form>
  );
}

function QuestionEditor({
  index,
  question,
  onChange,
  onRemove,
}: {
  index: number;
  question: DraftQuestion;
  onChange: (question: DraftQuestion) => void;
  onRemove?: () => void;
}) {
  const choice = question.type !== "SHORT_ANSWER";
  return (
    <fieldset className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <legend className="px-1 text-sm font-semibold text-slate-800">
        Question {index + 1}
      </legend>
      <div className="flex flex-wrap items-end gap-2">
        <label className="w-56 text-xs font-medium text-slate-700">
          Type
          <select
            value={question.type}
            onChange={(event) =>
              onChange(changeType(question, event.target.value as QuestionType))
            }
            className={`${field} mt-1`}
          >
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="w-24 text-xs font-medium text-slate-700">
          Marks
          <input
            type="number"
            min={0.5}
            max={10}
            step={0.5}
            value={question.marks}
            onChange={(event) =>
              onChange({ ...question, marks: Number(event.target.value) })
            }
            className={`${field} mt-1`}
          />
        </label>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="ml-auto text-xs font-semibold text-red-600 hover:underline"
          >
            Remove question
          </button>
        )}
      </div>
      <label className="block text-xs font-medium text-slate-700">
        Prompt
        <input
          value={question.prompt}
          onChange={(event) => onChange({ ...question, prompt: event.target.value })}
          className={`${field} mt-1`}
        />
      </label>
      {choice ? (
        <div className="space-y-1.5">
          <p className="text-xs text-slate-500">
            Tick the correct {question.type === "SINGLE_CHOICE" ? "option" : "options"}.
          </p>
          {question.options.map((option, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type={question.type === "SINGLE_CHOICE" ? "radio" : "checkbox"}
                name={`correct-${index}`}
                aria-label={`Option ${String.fromCharCode(65 + i)} is correct`}
                checked={option.correct}
                onChange={(event) =>
                  onChange({
                    ...question,
                    options: question.options.map((row, j) =>
                      question.type === "SINGLE_CHOICE"
                        ? { ...row, correct: j === i }
                        : j === i
                          ? { ...row, correct: event.target.checked }
                          : row,
                    ),
                  })
                }
                className="size-4"
              />
              <span className="w-4 text-xs font-semibold text-slate-500">
                {String.fromCharCode(65 + i)}
              </span>
              <input
                value={option.text}
                aria-label={`Option ${String.fromCharCode(65 + i)} text`}
                onChange={(event) =>
                  onChange({
                    ...question,
                    options: question.options.map((row, j) =>
                      j === i ? { ...row, text: event.target.value } : row,
                    ),
                  })
                }
                className={field}
              />
              {question.options.length > 2 && (
                <button
                  type="button"
                  aria-label={`Remove option ${String.fromCharCode(65 + i)}`}
                  onClick={() =>
                    onChange({
                      ...question,
                      options: question.options.filter((_, j) => j !== i),
                    })
                  }
                  className="text-xs text-slate-500 hover:text-red-600"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {question.options.length < 8 && (
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...question,
                  options: [...question.options, { text: "", correct: false }],
                })
              }
              className="text-xs font-semibold text-brand-700 hover:underline"
            >
              + Add option
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
          <label className="block text-xs font-medium text-slate-700">
            Accepted answers (one per line, not case-sensitive)
            <textarea
              rows={3}
              value={question.acceptedAnswers}
              onChange={(event) =>
                onChange({ ...question, acceptedAnswers: event.target.value })
              }
              className={`${field} mt-1`}
            />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Word limit
            <input
              type="number"
              min={1}
              max={20}
              value={question.maxWords}
              onChange={(event) =>
                onChange({ ...question, maxWords: event.target.value })
              }
              className={`${field} mt-1`}
            />
          </label>
        </div>
      )}
    </fieldset>
  );
}
