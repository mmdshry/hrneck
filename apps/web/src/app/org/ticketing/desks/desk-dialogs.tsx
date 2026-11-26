"use client";

import type { SdDesk } from "../ticketing-types";
import type { DeskDialog } from "./desk-types";
import { ProcedureDialog } from "./procedure-dialog";
import { SlaDialog } from "./sla-dialog";
import { StageDialog } from "./stage-dialog";
import { SupportRowDialog } from "./support-row-dialog";
import { MessageTemplateDialog, NoteTemplateDialog } from "./template-dialog";

type DeskDialogsProps = {
  dialog: DeskDialog;
  desk: SdDesk;
  onClose: () => void;
  /** Reloads the selected desk after a stage, procedure, SLA or support row is saved. */
  onDetailChanged: () => void | Promise<void>;
  /** Reloads the templates after one is added. */
  onTemplatesChanged: () => void | Promise<void>;
};

/** Renders the one modal the detail or templates panel asked for. */
export function DeskDialogs({
  dialog,
  desk,
  onClose,
  onDetailChanged,
  onTemplatesChanged,
}: DeskDialogsProps) {
  switch (dialog.kind) {
    case "stage":
      return (
        <StageDialog
          deskId={desk.id}
          stage={dialog.stage}
          onClose={onClose}
          onSaved={onDetailChanged}
        />
      );
    case "procedure":
      return (
        <ProcedureDialog
          deskId={desk.id}
          procedure={dialog.procedure}
          stages={desk.stages ?? []}
          onClose={onClose}
          onSaved={onDetailChanged}
        />
      );
    case "sla":
      return (
        <SlaDialog
          deskId={desk.id}
          policy={dialog.policy}
          onClose={onClose}
          onSaved={onDetailChanged}
        />
      );
    case "support":
      return (
        <SupportRowDialog
          deskId={desk.id}
          initialTable={dialog.table}
          onClose={onClose}
          onSaved={onDetailChanged}
        />
      );
    case "messageTemplate":
      return (
        <MessageTemplateDialog
          deskId={desk.id}
          onClose={onClose}
          onSaved={onTemplatesChanged}
        />
      );
    case "noteTemplate":
      return (
        <NoteTemplateDialog deskId={desk.id} onClose={onClose} onSaved={onTemplatesChanged} />
      );
    default: {
      const unhandled: never = dialog;
      return unhandled;
    }
  }
}
