type RecoveryCodesPanelProps = {
  codes: string[];
};

/**
 * One-time recovery codes from the API. Render only inside a dialog step, so the codes
 * are never left on the settings page.
 */
export function RecoveryCodesPanel({ codes }: RecoveryCodesPanelProps) {
  return (
    <ul className="grid gap-x-6 gap-y-1 rounded-[var(--radius)] border border-[var(--success)]/40 bg-[var(--success)]/10 px-[var(--space-md)] py-[var(--space-sm)] font-mono text-sm text-[var(--success)] sm:grid-cols-2">
      {codes.map((code) => (
        <li key={code}>{code}</li>
      ))}
    </ul>
  );
}
