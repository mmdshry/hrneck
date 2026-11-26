import { describe, expect, it } from "vitest";
import { emptyQuizDraft, emptyQuizQuestionDraft, type QuizDraft } from "../training/training-shared";
import {
  findQuizQuestionsIssue,
  findQuizSettingsIssue,
  isQuizDraftChanged,
} from "./quiz-draft-rules";

function draftWith(overrides: Partial<QuizDraft>): QuizDraft {
  return { ...emptyQuizDraft(), title: "Safety basics", ...overrides };
}

describe("findQuizSettingsIssue", () => {
  it("requires a non-blank title", () => {
    expect(findQuizSettingsIssue(draftWith({ title: "   " }))).toEqual({ kind: "titleRequired" });
    expect(findQuizSettingsIssue(draftWith({ title: " Safety " }))).toBeNull();
  });
});

describe("findQuizQuestionsIssue", () => {
  it("accepts a valid multiple-choice and essay mix", () => {
    const draft = draftWith({
      questions: [
        { ...emptyQuizQuestionDraft(), prompt: "Pick one", options_text: "A\nB" },
        { ...emptyQuizQuestionDraft(), type: "essay", prompt: "Explain" },
      ],
    });
    expect(findQuizQuestionsIssue(draft)).toBeNull();
  });

  it("reports a missing prompt with the one-based question number", () => {
    const draft = draftWith({
      questions: [
        { ...emptyQuizQuestionDraft(), prompt: "Fine", options_text: "A\nB" },
        { ...emptyQuizQuestionDraft(), prompt: "   ", options_text: "A\nB" },
      ],
    });
    expect(findQuizQuestionsIssue(draft)).toEqual({ kind: "promptRequired", questionNumber: 2 });
  });

  it("requires at least two non-blank options for multiple-choice questions", () => {
    const draft = draftWith({
      questions: [{ ...emptyQuizQuestionDraft(), prompt: "Pick", options_text: "A\n  \n" }],
    });
    expect(findQuizQuestionsIssue(draft)).toEqual({ kind: "optionsRequired", questionNumber: 1 });
  });

  it("does not require options for essay questions", () => {
    const draft = draftWith({
      questions: [{ ...emptyQuizQuestionDraft(), type: "essay", prompt: "Explain" }],
    });
    expect(findQuizQuestionsIssue(draft)).toBeNull();
  });

  it("reports an empty question list", () => {
    expect(findQuizQuestionsIssue(draftWith({ questions: [] }))).toEqual({ kind: "noQuestions" });
  });
});

describe("isQuizDraftChanged", () => {
  it("is false for identical drafts and true after any edit", () => {
    const baseline = draftWith({});
    expect(isQuizDraftChanged({ ...baseline }, baseline)).toBe(false);
    expect(isQuizDraftChanged(draftWith({ pass_score: "80" }), baseline)).toBe(true);
  });
});
