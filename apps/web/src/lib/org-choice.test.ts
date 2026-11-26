import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearOrgChoice,
  parseOrgChoice,
  readStoredOrgChoice,
  saveOrgChoice,
  type OrgChoice,
} from "./org-choice";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, String(value));
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => data.clear(),
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() {
      return data.size;
    },
  };
}

const choice: OrgChoice = {
  challengeToken: "choice-token",
  organizations: [
    { tenant_id: "itneck", name: "ITneck" },
    { tenant_id: "company", name: "Company" },
  ],
};

describe("org choice storage", () => {
  beforeEach(() => {
    vi.stubGlobal("sessionStorage", memoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips the challenge and organizations through sessionStorage", () => {
    saveOrgChoice(choice);

    expect(parseOrgChoice(readStoredOrgChoice())).toEqual(choice);
  });

  it("stores only the challenge and organization names, never a password", () => {
    saveOrgChoice(choice);

    const stored = readStoredOrgChoice() ?? "";
    expect(stored).not.toContain("password");
  });

  it("clears the stored choice", () => {
    saveOrgChoice(choice);

    clearOrgChoice();

    expect(readStoredOrgChoice()).toBeNull();
    expect(parseOrgChoice(readStoredOrgChoice())).toBeNull();
  });

  it("returns null when nothing is stored", () => {
    expect(parseOrgChoice(null)).toBeNull();
    expect(parseOrgChoice("")).toBeNull();
  });

  it("ignores malformed JSON", () => {
    expect(parseOrgChoice("{not json")).toBeNull();
  });

  it("ignores a stored value without a challenge token", () => {
    expect(
      parseOrgChoice(JSON.stringify({ organizations: [{ tenant_id: "itneck", name: "ITneck" }] })),
    ).toBeNull();
  });

  it("drops entries that are not organizations and keeps the valid ones", () => {
    const raw = JSON.stringify({
      challengeToken: "choice-token",
      organizations: [{ tenant_id: "itneck", name: "ITneck" }, { name: "missing id" }, null],
    });

    expect(parseOrgChoice(raw)).toEqual({
      challengeToken: "choice-token",
      organizations: [{ tenant_id: "itneck", name: "ITneck" }],
    });
  });

  it("returns null when no entry is a valid organization", () => {
    const raw = JSON.stringify({ challengeToken: "choice-token", organizations: [{ tenant_id: 1 }] });

    expect(parseOrgChoice(raw)).toBeNull();
  });
});
