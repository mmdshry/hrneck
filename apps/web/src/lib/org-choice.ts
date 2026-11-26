/**
 * One password matched several organization logins. The API returns a short-lived challenge and the list of
 * organizations; the user picks one on /select-org, and no password is asked again.
 */
export type OrgChoice = {
  challengeToken: string;
  organizations: { tenant_id: string; name: string }[];
};

type ChoiceOrganization = OrgChoice["organizations"][number];

const STORAGE_KEY = "org_choice";

export function saveOrgChoice(choice: OrgChoice): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
}

/** Raw stored value. A string snapshot compares by value, so it is safe for useClientSnapshot. */
export function readStoredOrgChoice(): string | null {
  return sessionStorage.getItem(STORAGE_KEY);
}

export function parseOrgChoice(raw: string | null): OrgChoice | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as { challengeToken?: unknown; organizations?: unknown };
    if (typeof parsed.challengeToken !== "string" || !Array.isArray(parsed.organizations)) {
      return null;
    }
    const organizations = parsed.organizations.filter(isChoiceOrganization);
    if (organizations.length === 0) {
      return null;
    }
    return { challengeToken: parsed.challengeToken, organizations };
  } catch {
    return null;
  }
}

export function clearOrgChoice(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

function isChoiceOrganization(value: unknown): value is ChoiceOrganization {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as { tenant_id?: unknown; name?: unknown };
  return typeof candidate.tenant_id === "string" && typeof candidate.name === "string";
}
