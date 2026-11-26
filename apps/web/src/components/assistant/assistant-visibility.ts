export type AssistantVisibilityInput = {
  isOrgRoute: boolean;
  authChecked: boolean;
  hasUser: boolean;
  tenant: string;
  membershipDenied: boolean;
};

/**
 * The launcher lives on org pages only. Members and platform staff acting inside a tenant both see it.
 * When the membership gate is shown, the gate replaces the page content and the launcher stays hidden.
 */
export function canShowAssistant(input: AssistantVisibilityInput): boolean {
  return (
    input.isOrgRoute &&
    input.authChecked &&
    input.hasUser &&
    input.tenant !== "" &&
    !input.membershipDenied
  );
}
