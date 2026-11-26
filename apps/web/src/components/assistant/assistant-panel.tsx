"use client";

import { Bot, Send, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import {
  cancelAssistantAction,
  confirmAssistantAction,
  fetchAssistantStatus,
  sendAssistantMessage,
  startAssistantConversation,
  type AssistantPendingAction,
  type AssistantStatus,
} from "@/lib/assistant";
import { cn } from "@/lib/utils";

type ChatLine = {
  id: number;
  role: "user" | "assistant";
  text: string;
};

type Feedback = "helpful" | "not_helpful";

/** Reserved for the static greeting. Server-side lines start at 1. */
const GREETING_ID = 0;

/** Launcher mascot. The launcher falls back to the Bot icon if this file is missing. */
const MASCOT_SRC = "/assistant/necki.png";

/** Brand teal from the Necki design. */
const TEAL = "bg-[#1E556A]";

/** Statuses where the server has already settled the action, so its card should disappear. */
const SETTLED_STATUSES = new Set([403, 404, 409, 422]);

/**
 * Chat with the Necki assistant. Renders nothing unless the tenant is in the pilot
 * and the signed-in user has at least one assistant tool.
 *
 * Mount with `key={tenant}` so switching organizations starts a fresh conversation.
 */
export function AssistantPanel({ tenant }: { tenant: string }) {
  const t = useTranslations("assistant");
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [pending, setPending] = useState<AssistantPendingAction[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Partial<Record<number, Feedback>>>({});
  const [mascotFailed, setMascotFailed] = useState(false);
  const conversationIdRef = useRef<string | null>(null);
  const nextLineId = useRef(GREETING_ID);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    fetchAssistantStatus(tenant)
      .then((next) => {
        if (active) setStatus(next);
      })
      .catch(() => {
        if (active) setStatus({ enabled: false, tools: [] });
      });
    return () => {
      active = false;
    };
  }, [tenant]);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [lines, pending, open]);

  if (!status?.enabled) {
    return null;
  }

  function appendLine(role: ChatLine["role"], text: string) {
    nextLineId.current += 1;
    const id = nextLineId.current;
    setLines((current) => [...current, { id, role, text }]);
  }

  function toggleFeedback(lineId: number, value: Feedback) {
    setFeedback((current) => ({
      ...current,
      [lineId]: current[lineId] === value ? undefined : value,
    }));
  }

  async function ensureConversation(): Promise<string> {
    if (conversationIdRef.current) return conversationIdRef.current;
    const started = await startAssistantConversation(tenant);
    conversationIdRef.current = started.id;
    return started.id;
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || busy) return;

    setDraft("");
    setError(null);
    setBusy(true);
    appendLine("user", message);

    try {
      const conversationId = await ensureConversation();
      const result = await sendAssistantMessage(tenant, conversationId, message);
      for (const reply of result.replies) {
        appendLine("assistant", reply.text);
      }
      if (result.replies.length === 0) {
        appendLine("assistant", t("noReply"));
      }
      setPending(result.pending_actions);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // The conversation ended on the server. The next message starts a new one.
        conversationIdRef.current = null;
        setError(t("conversationEnded"));
      } else if (err instanceof ApiError && err.status === 503) {
        setError(t("unavailable"));
      } else {
        setError(err instanceof Error ? err.message : t("genericError"));
      }
    } finally {
      setBusy(false);
    }
  }

  async function resolve(action: AssistantPendingAction, decision: "confirm" | "cancel") {
    setError(null);
    setBusy(true);
    try {
      if (decision === "confirm") {
        await confirmAssistantAction(tenant, action.id);
        appendLine("assistant", t("confirmed"));
      } else {
        await cancelAssistantAction(tenant, action.id);
        appendLine("assistant", t("cancelled"));
      }
      setPending((current) => current.filter((item) => item.id !== action.id));
    } catch (err) {
      if (err instanceof ApiError && SETTLED_STATUSES.has(err.status)) {
        setPending((current) => current.filter((item) => item.id !== action.id));
        setError(t("resolvedElsewhere"));
      } else {
        setError(err instanceof Error ? err.message : t("genericError"));
      }
    } finally {
      setBusy(false);
    }
  }

  function onDraftKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  const greeting: ChatLine = { id: GREETING_ID, role: "assistant", text: t("greeting") };
  const visibleLines = [greeting, ...lines];

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3">
      {open ? (
        <section
          aria-label={t("title")}
          className="flex h-[min(32rem,calc(100vh-7rem))] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)] shadow-[var(--shadow-md)]"
        >
          <div className="flex justify-end px-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={t("close")}
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </div>
          <h2 className={cn("px-4 py-3 text-sm font-semibold text-white", TEAL)}>{t("title")}</h2>

          <div
            ref={logRef}
            role="log"
            aria-live="polite"
            className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3"
          >
            {visibleLines.map((line) => (
              <div
                key={line.id}
                className={cn("flex flex-col gap-1", line.role === "user" ? "items-end" : "items-start")}
              >
                <div
                  className={cn(
                    "max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm",
                    line.role === "user"
                      ? cn(TEAL, "text-white")
                      : "bg-[var(--muted)] text-[var(--foreground)]",
                  )}
                >
                  <span className="sr-only">
                    {line.role === "user" ? t("youLabel") : t("assistantLabel")}:{" "}
                  </span>
                  {line.text}
                </div>
                {line.role === "assistant" ? (
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label={t("feedbackHelpful")}
                      aria-pressed={feedback[line.id] === "helpful"}
                      onClick={() => toggleFeedback(line.id, "helpful")}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label={t("feedbackNotHelpful")}
                      aria-pressed={feedback[line.id] === "not_helpful"}
                      onClick={() => toggleFeedback(line.id, "not_helpful")}
                    >
                      <ThumbsDown className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}

            {pending.map((action) => (
              <div
                key={action.id}
                role="group"
                aria-label={t("pendingTitle")}
                className="space-y-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] p-3 text-sm"
              >
                <p className="font-medium">{t("pendingTitle")}</p>
                <p>{action.summary}</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {t("pendingHint")} ·{" "}
                  {t("expiresAt", {
                    time: new Date(action.expires_at).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
                  })}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() => void resolve(action, "confirm")}
                  >
                    {t("confirm")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void resolve(action, "cancel")}
                  >
                    {t("cancel")}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {error ? (
            <Alert variant="destructive" className="mx-4 mb-2">
              {error}
            </Alert>
          ) : null}

          <form onSubmit={send} className="flex items-end gap-2 border-t border-[var(--border)] p-3">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onDraftKeyDown}
              rows={2}
              maxLength={4000}
              placeholder={t("placeholder")}
              aria-label={t("placeholder")}
              disabled={busy}
              className="min-h-0 resize-none"
            />
            <Button
              type="submit"
              size="icon"
              aria-label={t("send")}
              disabled={busy || draft.trim() === ""}
            >
              <Send className="h-4 w-4" aria-hidden />
            </Button>
          </form>
        </section>
      ) : (
        <div className="max-w-[16rem] rounded-2xl bg-[var(--card)] px-4 py-3 text-sm text-[var(--card-foreground)] shadow-[var(--shadow-md)]">
          {t("greeting")}
        </div>
      )}

      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? t("close") : t("open")}
        onClick={() => setOpen((current) => !current)}
        className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-white shadow-[var(--shadow-md)] transition-transform duration-[var(--motion)] hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E556A]"
      >
        {mascotFailed ? (
          <span className={cn("flex h-full w-full items-center justify-center text-white", TEAL)}>
            <Bot className="h-6 w-6" aria-hidden />
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- static mascot asset in /public
          <img
            src={MASCOT_SRC}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setMascotFailed(true)}
          />
        )}
      </button>
    </div>
  );
}
