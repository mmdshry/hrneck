"use client";

import { useCallback, useEffect, useState } from "react";
import { toastError } from "@/lib/toast";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { api, ensureCsrf } from "@/lib/api";
import { resolveTenant } from "@/lib/tenant";
import { ImportMappingStep } from "./import-mapping-step";
import { ImportPreviewStep } from "./import-preview-step";
import { ImportResultStep } from "./import-result-step";
import {
  emptyColumnMap,
  normalizeColumnMap,
  type ColumnMap,
  type ImportCommitResult,
  type ImportMappingTemplate,
  type ImportPreviewResult,
  type ImportSession,
  type WizardStep,
} from "./import-types";
import { ImportUploadStep } from "./import-upload-step";

type ImportWizardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (summary: string) => void;
};

export function ImportWizardDialog({
  open,
  onOpenChange,
  onImported,
}: ImportWizardDialogProps) {
  const t = useTranslations("org.employees");
  const tCommon = useTranslations("common");
  const [step, setStep] = useState<WizardStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [session, setSession] = useState<ImportSession | null>(null);
  const [columnMap, setColumnMap] = useState<ColumnMap>(emptyColumnMap());
  const [templates, setTemplates] = useState<ImportMappingTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [result, setResult] = useState<ImportCommitResult | null>(null);
  const [sendInvites, setSendInvites] = useState(false);
  const [busy, setBusy] = useState(false);

  const reset = useCallback(() => {
    setStep("upload");
    setFile(null);
    setSession(null);
    setColumnMap(emptyColumnMap());
    setSelectedTemplateId("");
    setTemplateName("");
    setPreview(null);
    setResult(null);
    setSendInvites(false);
    setBusy(false);
    
  }, []);

  const loadTemplates = useCallback(async () => {
    const res = await api<{ data: ImportMappingTemplate[] }>(
      "/api/v1/org/targets/import/mappings",
      { tenant: resolveTenant() },
    );
    setTemplates(res.data ?? []);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    reset();
    void loadTemplates().catch(() => {
      /* templates optional on open */
    });
  }, [open, reset, loadTemplates]);

  function handleOpenChange(next: boolean) {
    if (!next && busy) {
      return;
    }
    onOpenChange(next);
    if (!next) {
      reset();
    }
  }

  async function uploadSession() {
    if (!file) {
      toastError(t("chooseCsvFirst"));
      return;
    }
    setBusy(true);
    
    try {
      await ensureCsrf();
      const body = new FormData();
      body.append("file", file);
      const res = await api<{ data: ImportSession }>("/api/v1/org/targets/import/sessions", {
        method: "POST",
        tenant: resolveTenant(),
        body,
      });
      const data = res.data;
      setSession(data);
      setColumnMap(normalizeColumnMap(data.suggested_map));
      setSelectedTemplateId("");
      setStep("map");
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("uploadFailed"));
    } finally {
      setBusy(false);
    }
  }

  function applyTemplate(id: string) {
    setSelectedTemplateId(id);
    if (!id) {
      if (session) {
        setColumnMap(normalizeColumnMap(session.suggested_map));
      }
      setTemplateName("");
      return;
    }
    const template = templates.find((row) => String(row.id) === id);
    if (!template) {
      return;
    }
    setColumnMap(normalizeColumnMap(template.column_map));
    setTemplateName(template.name);
  }

  async function saveTemplate() {
    const name = templateName.trim();
    if (!name) {
      toastError(t("enterTemplateName"));
      return;
    }
    if (!columnMap.email) {
      toastError(t("mapEmailBeforeSave"));
      return;
    }
    setBusy(true);
    
    try {
      await ensureCsrf();
      if (selectedTemplateId) {
        await api(`/api/v1/org/targets/import/mappings/${selectedTemplateId}`, {
          method: "PATCH",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, column_map: columnMap }),
        });
      } else {
        const res = await api<{ data: ImportMappingTemplate }>(
          "/api/v1/org/targets/import/mappings",
          {
            method: "POST",
            tenant: resolveTenant(),
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, column_map: columnMap }),
          },
        );
        setSelectedTemplateId(String(res.data.id));
      }
      await loadTemplates();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("couldNotSaveTemplate"));
    } finally {
      setBusy(false);
    }
  }

  async function deleteTemplate() {
    if (!selectedTemplateId) {
      return;
    }
    setBusy(true);
    
    try {
      await ensureCsrf();
      await api(`/api/v1/org/targets/import/mappings/${selectedTemplateId}`, {
        method: "DELETE",
        tenant: resolveTenant(),
      });
      setSelectedTemplateId("");
      setTemplateName("");
      if (session) {
        setColumnMap(normalizeColumnMap(session.suggested_map));
      }
      await loadTemplates();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("couldNotDeleteTemplate"));
    } finally {
      setBusy(false);
    }
  }

  async function runPreview() {
    if (!session) {
      return;
    }
    if (!columnMap.email) {
      toastError(t("mapEmailBeforePreview"));
      return;
    }
    setBusy(true);
    
    try {
      await ensureCsrf();
      const res = await api<{ data: ImportPreviewResult }>(
        `/api/v1/org/targets/import/sessions/${session.id}/preview`,
        {
          method: "POST",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ column_map: columnMap }),
        },
      );
      setPreview(res.data);
      setStep("preview");
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("previewFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function runCommit() {
    if (!session) {
      return;
    }
    setBusy(true);
    
    try {
      await ensureCsrf();
      const body: Record<string, unknown> = {
        column_map: columnMap,
        send_invites: sendInvites,
      };
      if (templateName.trim()) {
        body.save_mapping = {
          name: templateName.trim(),
          ...(selectedTemplateId ? { update_id: Number(selectedTemplateId) } : {}),
        };
      }
      const res = await api<ImportCommitResult>(
        `/api/v1/org/targets/import/sessions/${session.id}/commit`,
        {
          method: "POST",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      setResult(res);
      setStep("result");
      const parts = [
        t("importedSummary", {
          imported: res.imported,
          created: res.created,
          updated: res.updated,
          skipped: res.skipped,
        }),
      ];
      const autoCount = res.meta?.auto_assigned_instance_count ?? 0;
      if (autoCount > 0) {
        parts.push(t("autoAssigned", { count: autoCount }));
      }
      onImported(parts.join(" "));
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("importFailed"));
    } finally {
      setBusy(false);
    }
  }

  const title =
    step === "upload"
      ? t("importTitleUpload")
      : step === "map"
        ? t("importTitleMap")
        : step === "preview"
          ? t("importTitlePreview")
          : t("importTitleResult");

  const description =
    step === "upload"
      ? t("importStep1")
      : step === "map"
        ? t("importStep2")
        : step === "preview"
          ? t("importStep3")
          : t("importStep4");

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
      size="lg"
      dismissible={!busy}
      className="max-w-3xl"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          {step === "upload" ? (
            <>
              <Button type="button" variant="outline" disabled={busy} onClick={() => handleOpenChange(false)}>
                {tCommon("cancel")}
              </Button>
              <Button type="button" disabled={busy || !file} onClick={() => void uploadSession()}>
                {busy ? tCommon("uploading") : tCommon("continue")}
              </Button>
            </>
          ) : null}
          {step === "map" ? (
            <>
              <Button type="button" variant="outline" disabled={busy} onClick={() => setStep("upload")}>
                {tCommon("back")}
              </Button>
              <Button type="button" disabled={busy} onClick={() => void runPreview()}>
                {busy ? tCommon("checking") : tCommon("preview")}
              </Button>
            </>
          ) : null}
          {step === "preview" ? (
            <>
              <Button type="button" variant="outline" disabled={busy} onClick={() => setStep("map")}>
                {tCommon("back")}
              </Button>
              <Button type="button" disabled={busy} onClick={() => void runCommit()}>
                {busy ? tCommon("importing") : tCommon("import")}
              </Button>
            </>
          ) : null}
          {step === "result" ? (
            <Button type="button" onClick={() => handleOpenChange(false)}>
              {tCommon("close")}
            </Button>
          ) : null}
        </div>
      }
    >
      
      {step === "upload" ? (
        <ImportUploadStep file={file} onFileChange={setFile} busy={busy} />
      ) : null}
      {step === "map" && session ? (
        <ImportMappingStep
          session={session}
          columnMap={columnMap}
          onColumnMapChange={setColumnMap}
          templates={templates}
          selectedTemplateId={selectedTemplateId}
          onSelectTemplate={applyTemplate}
          templateName={templateName}
          onTemplateNameChange={setTemplateName}
          onSaveTemplate={() => void saveTemplate()}
          onDeleteTemplate={() => void deleteTemplate()}
          busy={busy}
        />
      ) : null}
      {step === "preview" && preview ? (
        <ImportPreviewStep
          preview={preview}
          sendInvites={sendInvites}
          onSendInvitesChange={setSendInvites}
        />
      ) : null}
      {step === "result" && result ? <ImportResultStep result={result} /> : null}
    </Dialog>
  );
}
