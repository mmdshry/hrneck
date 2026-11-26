import { draftToQuizPayload, type QuizDraft } from "../training/training-shared";

export type QuizDraftIssue =
  | { kind: "titleRequired" }
  | { kind: "noQuestions" }
  | { kind: "promptRequired"; questionNumber: number }
  | { kind: "optionsRequired"; questionNumber: number };

export function findQuizSettingsIssue(draft: QuizDraft): QuizDraftIssue | null {
  return draftToQuizPayload(draft).title ? null : { kind: "titleRequired" };
}

export function findQuizQuestionsIssue(draft: QuizDraft): QuizDraftIssue | null {
  const { questions } = draftToQuizPayload(draft);
  if (questions.length === 0) {
    return { kind: "noQuestions" };
  }
  for (const [index, question] of questions.entries()) {
    const questionNumber = index + 1;
    if (!question.prompt) {
      return { kind: "promptRequired", questionNumber };
    }
    if (question.type === "mcq" && (!question.options || question.options.length < 2)) {
      return { kind: "optionsRequired", questionNumber };
    }
  }
  return null;
}

export function isQuizDraftChanged(draft: QuizDraft, baseline: QuizDraft): boolean {
  return JSON.stringify(draft) !== JSON.stringify(baseline);
}
