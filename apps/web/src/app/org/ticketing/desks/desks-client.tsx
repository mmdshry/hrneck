"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDataTableQuery } from "@/hooks/use-data-table-query";
import { liveStatusLabel, useLiveTopic } from "@/hooks/use-live-topic";
import { api, ensureCsrf, fetchSessionUser } from "@/lib/api";
import { serializeDataTableQuery } from "@/lib/data-table-query";
import { orgLiveChannel } from "@/lib/live-topics";
import {
  DEFAULT_PAGE_SIZE,
  emptyMeta,
  paginateLocal,
  parsePaginatedResponse,
  paginationQuery,
  type PageSize,
  type PaginationMeta,
} from "@/lib/pagination";
import { hasPermission, type SessionUser } from "@/lib/session";
import { resolveTenant } from "@/lib/tenant";
import type { SdDesk } from "../ticketing-types";

type DesksPayload = {
  data: SdDesk[];
};

type TemplateMessage = {
  id: number;
  name: string;
  subject?: string | null;
  body: string;
  desk_id?: number | null;
};

type TemplateNote = {
  id: number;
  name: string;
  body: string;
  desk_id?: number | null;
};

type SupportTable = "statuses" | "priorities" | "severities" | "categories";

function matchesCells(
  q: string,
  columnFilters: Record<string, string>,
  cells: Record<string, string>,
): boolean {
  const needle = q.trim().toLowerCase();
  if (needle && !Object.values(cells).join(" ").toLowerCase().includes(needle)) {
    return false;
  }
  for (const [key, raw] of Object.entries(columnFilters)) {
    const value = raw.trim().toLowerCase();
    if (!value) continue;
    if (!String(cells[key] ?? "").toLowerCase().includes(value)) return false;
  }
  return true;
}

function deskCells(desk: SdDesk): Record<string, string> {
  return {
    name: desk.name,
    slug: desk.slug,
    type: desk.type,
    active: desk.is_active ? "1" : "0",
  };
}

type DeskStage = NonNullable<SdDesk["stages"]>[number];
type DeskProcedure = NonNullable<SdDesk["procedures"]>[number];
type DeskSla = NonNullable<SdDesk["sla_policies"]>[number];
type DeskSeverity = NonNullable<SdDesk["severities"]>[number];
type DeskSupportRow = { id: number; name: string; slug: string };

const stageColumns: Array<DataTableColumn<DeskStage>> = [
  {
    id: "name",
    header: "Name",
    accessorKey: "name",
    sticky: true,
    cell: (stage) => stage.name,
  },
  {
    id: "sequence",
    header: "Sequence",
    accessorKey: "sequence",
    cell: (stage) => stage.sequence,
  },
  {
    id: "escalation",
    header: "Escalation",
    filterValue: (stage) => stage.default_escalation_minutes ?? "",
    cell: (stage) =>
      stage.default_escalation_minutes != null ? `${stage.default_escalation_minutes}m` : "—",
  },
  {
    id: "terminal",
    header: "Terminal",
    filter: "select",
    filterOptions: [
      { label: "Terminal", value: "yes" },
      { label: "Open", value: "no" },
    ],
    filterValue: (stage) => (stage.is_terminal ? "yes" : "no"),
    cell: (stage) => (stage.is_terminal ? "Terminal" : "—"),
  },
];

const supportColumns: Array<DataTableColumn<DeskSupportRow>> = [
  {
    id: "name",
    header: "Name",
    accessorKey: "name",
    sticky: true,
    cell: (row) => row.name,
  },
  {
    id: "slug",
    header: "Slug",
    accessorKey: "slug",
    cell: (row) => row.slug,
  },
];

const procedureColumns: Array<DataTableColumn<DeskProcedure>> = [
  {
    id: "name",
    header: "Name",
    accessorKey: "name",
    sticky: true,
    cell: (procedure) => procedure.name,
  },
  {
    id: "hook",
    header: "Hook",
    accessorKey: "hook",
    cell: (procedure) => procedure.hook,
  },
  {
    id: "active",
    header: "Active",
    filter: "select",
    filterOptions: [
      { label: "Active", value: "active" },
      { label: "Inactive", value: "inactive" },
    ],
    filterValue: (procedure) => (procedure.is_active ? "active" : "inactive"),
    cell: (procedure) => (procedure.is_active ? "Active" : "Inactive"),
  },
];

const slaColumns: Array<DataTableColumn<DeskSla>> = [
  {
    id: "name",
    header: "Name",
    accessorKey: "name",
    sticky: true,
    cell: (policy) => policy.name,
  },
  {
    id: "default",
    header: "Default",
    filter: "select",
    filterOptions: [
      { label: "Default", value: "yes" },
      { label: "No", value: "no" },
    ],
    filterValue: (policy) => (policy.is_default ? "yes" : "no"),
    cell: (policy) => (policy.is_default ? "Default" : "—"),
  },
];

export function DesksClient() {
  const tenant = resolveTenant();
  const channel = tenant ? orgLiveChannel(tenant, "desks") : null;
  const [session, setSession] = useState<SessionUser | null>(null);
  const [desks, setDesks] = useState<SdDesk[]>([]);
  const [liveDesks, setLiveDesks] = useState<SdDesk[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [selected, setSelected] = useState<SdDesk | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [createName, setCreateName] = useState("");
  const [createType, setCreateType] = useState("incident");
  const [createPrefix, setCreatePrefix] = useState("");
  const [editName, setEditName] = useState("");
  const [editPrefix, setEditPrefix] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editingStageId, setEditingStageId] = useState<number | null>(null);
  const [stageName, setStageName] = useState("");
  const [stageSequence, setStageSequence] = useState("0");
  const [stageEscalation, setStageEscalation] = useState("");
  const [stageTerminal, setStageTerminal] = useState(false);
  const [editingProcedureId, setEditingProcedureId] = useState<number | null>(null);
  const [editingSlaId, setEditingSlaId] = useState<number | null>(null);
  const [supportTable, setSupportTable] = useState<SupportTable>("statuses");
  const [supportName, setSupportName] = useState("");
  const [supportSlug, setSupportSlug] = useState("");
  const [supportClosed, setSupportClosed] = useState(false);
  const [supportWeight, setSupportWeight] = useState("0");
  const [procedureName, setProcedureName] = useState("");
  const [procedureHook, setProcedureHook] = useState("on_create");
  const [procedureStageId, setProcedureStageId] = useState("");
  const [procedureActive, setProcedureActive] = useState(true);
  const [procedureStepsJson, setProcedureStepsJson] = useState(
    '[{"action":"assign_pool","pool":"tier1"}]',
  );
  const [slaName, setSlaName] = useState("");
  const [slaGoalsJson, setSlaGoalsJson] = useState(
    '[{"priority_slug":"medium","response_minutes":240,"resolve_minutes":1440}]',
  );
  const [slaDefault, setSlaDefault] = useState(false);
  const [templates, setTemplates] = useState<{ messages: TemplateMessage[]; notes: TemplateNote[] }>(
    { messages: [], notes: [] },
  );
  const [messageTemplateName, setMessageTemplateName] = useState("");
  const [messageTemplateSubject, setMessageTemplateSubject] = useState("");
  const [messageTemplateBody, setMessageTemplateBody] = useState("");
  const [noteTemplateName, setNoteTemplateName] = useState("");
  const [noteTemplateBody, setNoteTemplateBody] = useState("");
  const [pendingDeleteMessage, setPendingDeleteMessage] = useState<TemplateMessage | null>(null);
  const [pendingDeleteNote, setPendingDeleteNote] = useState<TemplateNote | null>(null);
  const tableQuery = useDataTableQuery();
  const filters = useMemo(
    () => serializeDataTableQuery(tableQuery.debounced),
    [tableQuery.debounced],
  );
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);
  const filtersKeyRef = useRef(filtersKey);
  const canAdmin = Boolean(session && hasPermission(session, "org.ticketing.admin"));

  const applyLiveSlice = useCallback(
    (
      items: SdDesk[],
      nextPage: number,
      nextPerPage: number,
      q: string,
      columnFilters: Record<string, string>,
    ) => {
      const filtered = items.filter((desk) => matchesCells(q, columnFilters, deskCells(desk)));
      const sliced = paginateLocal(filtered, nextPage, nextPerPage);
      setDesks(sliced.data);
      setMeta(sliced.meta);
      setPage(sliced.meta.current_page);
    },
    [],
  );

  const onPayload = useCallback((payload: DesksPayload) => {
    setLiveDesks(Array.isArray(payload.data) ? payload.data : []);
  }, []);

  const refreshFromApi = useCallback(
    async (nextPage: number, nextPerPage: number, nextFilters: Record<string, string>) => {
      await ensureCsrf();
      const me = await fetchSessionUser();
      setSession(me);
      if (!me) {
        return;
      }
      const t = resolveTenant();
      const list = await api(
        `/api/v1/org/ticketing/desks?${paginationQuery(nextPage, nextPerPage, nextFilters)}`,
        { tenant: t },
      );
      const parsed = parsePaginatedResponse<SdDesk>(list, nextPerPage);
      setDesks(parsed.data);
      setMeta(parsed.meta);
      setPage(parsed.meta.current_page);
    },
    [],
  );

  const { status, error: liveError } = useLiveTopic<DesksPayload>({
    channel,
    onPayload,
  });

  useEffect(() => {
    void fetchSessionUser()
      .then(setSession)
      .catch(() => setSession(null));
  }, []);

  useEffect(() => {
    if (filtersKeyRef.current !== filtersKey) {
      filtersKeyRef.current = filtersKey;
      if (page !== 1) {
        setPage(1);
        return;
      }
    }
    if (liveDesks !== null) {
      applyLiveSlice(
        liveDesks,
        page,
        perPage,
        tableQuery.debounced.q,
        tableQuery.debounced.columnFilters,
      );
      setLoading(false);
      return;
    }
    void refreshFromApi(page, perPage, filters)
      .catch((err: unknown) => setMessage(err instanceof Error ? err.message : "Load failed"))
      .finally(() => setLoading(false));
  }, [
    liveDesks,
    page,
    perPage,
    filters,
    filtersKey,
    applyLiveSlice,
    refreshFromApi,
    tableQuery.debounced,
  ]);

  const statusLabel = liveStatusLabel(status);

  async function openDesk(id: number, allowTemplates = canAdmin) {
    await ensureCsrf();
    const detail = await api<{ data: SdDesk }>(`/api/v1/org/ticketing/desks/${id}`, {
      tenant: resolveTenant(),
    });
    setSelected(detail.data);
    setEditName(detail.data.name);
    setEditPrefix(detail.data.number_prefix ?? "");
    setEditActive(detail.data.is_active);
    if (allowTemplates) {
      try {
        await loadTemplates(id);
      } catch {
        setTemplates({ messages: [], notes: [] });
      }
    } else {
      setTemplates({ messages: [], notes: [] });
    }
  }

  async function loadTemplates(deskId: number) {
    const res = await api<{ data: { messages: TemplateMessage[]; notes: TemplateNote[] } }>(
      `/api/v1/org/ticketing/templates?desk_id=${deskId}`,
      { tenant: resolveTenant() },
    );
    setTemplates({
      messages: res.data.messages ?? [],
      notes: res.data.notes ?? [],
    });
  }

  async function createDesk(event: FormEvent) {
    event.preventDefault();
    if (!canAdmin) return;
    try {
      await ensureCsrf();
      const created = await api<{ data: SdDesk }>("/api/v1/org/ticketing/desks", {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName,
          type: createType,
          number_prefix: createPrefix || null,
          is_active: true,
        }),
      });
      setCreateName("");
      setCreatePrefix("");
      setMessage(`Desk ${created.data.name} created.`);
      setLiveDesks(null);
      await refreshFromApi(1, perPage, filters);
      await openDesk(created.data.id, true);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Create desk failed");
    }
  }

  async function saveDesk(event: FormEvent) {
    event.preventDefault();
    if (!canAdmin || !selected) return;
    try {
      await ensureCsrf();
      await api(`/api/v1/org/ticketing/desks/${selected.id}`, {
        method: "PATCH",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          number_prefix: editPrefix,
          is_active: editActive,
        }),
      });
      setMessage("Desk updated.");
      await openDesk(selected.id);
      setLiveDesks(null);
      await refreshFromApi(page, perPage, filters);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Update desk failed");
    }
  }

  function fillStage(stage: DeskStage) {
    setEditingStageId(stage.id);
    setStageName(stage.name);
    setStageSequence(String(stage.sequence));
    setStageEscalation(
      stage.default_escalation_minutes != null ? String(stage.default_escalation_minutes) : "",
    );
    setStageTerminal(stage.is_terminal);
  }

  function resetStageForm() {
    setEditingStageId(null);
    setStageName("");
    setStageSequence("0");
    setStageEscalation("");
    setStageTerminal(false);
  }

  async function addStage(event: FormEvent) {
    event.preventDefault();
    if (!canAdmin || !selected) return;
    try {
      await ensureCsrf();
      const payload = {
        name: stageName,
        sequence: Number(stageSequence) || 0,
        default_escalation_minutes: stageEscalation ? Number(stageEscalation) : null,
        is_terminal: stageTerminal,
      };
      if (editingStageId !== null) {
        await api(`/api/v1/org/ticketing/desks/${selected.id}/stages/${editingStageId}`, {
          method: "PATCH",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setMessage("Stage updated.");
      } else {
        await api(`/api/v1/org/ticketing/desks/${selected.id}/stages`, {
          method: "POST",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setMessage("Stage added.");
      }
      resetStageForm();
      await openDesk(selected.id);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Stage save failed");
    }
  }

  async function addSupport(event: FormEvent) {
    event.preventDefault();
    if (!canAdmin || !selected) return;
    try {
      await ensureCsrf();
      const payload: Record<string, unknown> = {
        name: supportName,
        slug: supportSlug || undefined,
      };
      if (supportTable === "statuses") payload.is_closed = supportClosed;
      if (supportTable === "priorities") payload.weight = Number(supportWeight) || 0;
      await api(`/api/v1/org/ticketing/desks/${selected.id}/support/${supportTable}`, {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setSupportName("");
      setSupportSlug("");
      setSupportClosed(false);
      setSupportWeight("0");
      setMessage(`${supportTable} row added.`);
      await openDesk(selected.id);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Add support row failed");
    }
  }

  function fillProcedure(procedure: DeskProcedure) {
    setEditingProcedureId(procedure.id);
    setProcedureName(procedure.name);
    setProcedureHook(procedure.hook);
    setProcedureStageId(procedure.stage_id != null ? String(procedure.stage_id) : "");
    setProcedureActive(procedure.is_active);
    setProcedureStepsJson(JSON.stringify(procedure.steps ?? [], null, 2));
  }

  function resetProcedureForm() {
    setEditingProcedureId(null);
    setProcedureName("");
    setProcedureHook("on_create");
    setProcedureStageId("");
    setProcedureActive(true);
    setProcedureStepsJson('[{"action":"assign_pool","pool":"tier1"}]');
  }

  async function addProcedure(event: FormEvent) {
    event.preventDefault();
    if (!canAdmin || !selected) return;
    try {
      const steps = JSON.parse(procedureStepsJson) as unknown[];
      if (!Array.isArray(steps)) throw new Error("Steps must be a JSON array.");
      await ensureCsrf();
      const payload = {
        name: procedureName,
        hook: procedureHook,
        stage_id: procedureStageId ? Number(procedureStageId) : null,
        is_active: procedureActive,
        steps,
      };
      if (editingProcedureId !== null) {
        await api(`/api/v1/org/ticketing/desks/${selected.id}/procedures/${editingProcedureId}`, {
          method: "PATCH",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setMessage("Procedure updated.");
      } else {
        await api(`/api/v1/org/ticketing/desks/${selected.id}/procedures`, {
          method: "POST",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setMessage("Procedure added.");
      }
      resetProcedureForm();
      await openDesk(selected.id);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Procedure save failed");
    }
  }

  function fillSla(policy: NonNullable<SdDesk["sla_policies"]>[number]) {
    setEditingSlaId(policy.id);
    setSlaName(policy.name);
    setSlaDefault(policy.is_default);
    setSlaGoalsJson(JSON.stringify(policy.goals ?? [], null, 2));
  }

  function resetSlaForm() {
    setEditingSlaId(null);
    setSlaName("");
    setSlaDefault(false);
    setSlaGoalsJson(
      '[{"priority_slug":"medium","response_minutes":240,"resolve_minutes":1440}]',
    );
  }

  async function addSla(event: FormEvent) {
    event.preventDefault();
    if (!canAdmin || !selected) return;
    try {
      const goals = JSON.parse(slaGoalsJson) as unknown[];
      if (!Array.isArray(goals)) throw new Error("Goals must be a JSON array.");
      await ensureCsrf();
      const payload = {
        name: slaName,
        goals,
        is_default: slaDefault,
      };
      if (editingSlaId !== null) {
        await api(`/api/v1/org/ticketing/desks/${selected.id}/sla/${editingSlaId}`, {
          method: "PATCH",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setMessage("SLA policy updated.");
      } else {
        await api(`/api/v1/org/ticketing/desks/${selected.id}/sla`, {
          method: "POST",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setMessage("SLA policy added.");
      }
      resetSlaForm();
      await openDesk(selected.id);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "SLA save failed");
    }
  }

  async function addMessageTemplate(event: FormEvent) {
    event.preventDefault();
    if (!canAdmin || !selected) return;
    try {
      await ensureCsrf();
      await api("/api/v1/org/ticketing/templates/messages", {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          desk_id: selected.id,
          name: messageTemplateName,
          subject: messageTemplateSubject || null,
          body: messageTemplateBody,
        }),
      });
      setMessageTemplateName("");
      setMessageTemplateSubject("");
      setMessageTemplateBody("");
      setMessage("Message template added.");
      await loadTemplates(selected.id);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Add message template failed");
    }
  }

  async function addNoteTemplate(event: FormEvent) {
    event.preventDefault();
    if (!canAdmin || !selected) return;
    try {
      await ensureCsrf();
      await api("/api/v1/org/ticketing/templates/notes", {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          desk_id: selected.id,
          name: noteTemplateName,
          body: noteTemplateBody,
        }),
      });
      setNoteTemplateName("");
      setNoteTemplateBody("");
      setMessage("Note template added.");
      await loadTemplates(selected.id);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Add note template failed");
    }
  }

  async function deleteMessageTemplate(template: TemplateMessage) {
    await ensureCsrf();
    await api(`/api/v1/org/ticketing/templates/messages/${template.id}`, {
      method: "DELETE",
      tenant: resolveTenant(),
    });
    setMessage("Message template deleted.");
    if (selected) await loadTemplates(selected.id);
  }

  async function deleteNoteTemplate(template: TemplateNote) {
    await ensureCsrf();
    await api(`/api/v1/org/ticketing/templates/notes/${template.id}`, {
      method: "DELETE",
      tenant: resolveTenant(),
    });
    setMessage("Note template deleted.");
    if (selected) await loadTemplates(selected.id);
  }

  const columns: Array<DataTableColumn<SdDesk>> = [
    {
      id: "name",
      header: "Name",
      accessorKey: "name",
      sticky: true,
      cell: (desk) => (
        <span className={selected?.id === desk.id ? "font-medium" : undefined}>{desk.name}</span>
      ),
    },
    {
      id: "type",
      header: "Type",
      accessorKey: "type",
      cell: (desk) => desk.type,
    },
    {
      id: "slug",
      header: "Slug",
      accessorKey: "slug",
      cell: (desk) => desk.slug,
    },
    {
      id: "active",
      header: "Active",
      filter: "select",
      filterOptions: [
        { label: "Active", value: "1" },
        { label: "Inactive", value: "0" },
      ],
      filterValue: (desk) => (desk.is_active ? "1" : "0"),
      enableSorting: false,
      cell: (desk) => (desk.is_active ? "Active" : "Inactive"),
    },
  ];

  const messageTemplateColumns: Array<DataTableColumn<TemplateMessage>> = [
    {
      id: "name",
      header: "Name",
      accessorKey: "name",
      sticky: true,
      cell: (row) => row.name,
    },
    {
      id: "subject",
      header: "Subject",
      accessorKey: "subject",
      cell: (row) => row.subject || "—",
    },
    {
      id: "actions",
      header: "Actions",
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      cell: (row) => (
        <Button type="button" variant="outline" onClick={() => setPendingDeleteMessage(row)}>
          Delete
        </Button>
      ),
    },
  ];

  const noteTemplateColumns: Array<DataTableColumn<TemplateNote>> = [
    {
      id: "name",
      header: "Name",
      accessorKey: "name",
      sticky: true,
      cell: (row) => row.name,
    },
    {
      id: "body",
      header: "Body",
      accessorKey: "body",
      className: "max-w-md whitespace-pre-wrap",
      cell: (row) => row.body,
    },
    {
      id: "actions",
      header: "Actions",
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      cell: (row) => (
        <Button type="button" variant="outline" onClick={() => setPendingDeleteNote(row)}>
          Delete
        </Button>
      ),
    },
  ];

  if (loading) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  if (session && !hasPermission(session, "org.ticketing.admin") && !hasPermission(session, "org.ticketing.tickets")) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-8 sm:px-6">
        <PageHeader title="Desks" description="Desk definitions." />
        <Alert>Insufficient permissions.</Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Desks"
        description={
          statusLabel
            ? `ITIL desk definitions, stages, procedures, and SLA policies. · ${statusLabel}`
            : "ITIL desk definitions, stages, procedures, and SLA policies."
        }
        actions={<LinkButton href="/org/ticketing" variant="outline">Queue</LinkButton>}
      />
      {message ? <Alert>{message}</Alert> : null}
      {liveError ? <Alert variant="destructive">{liveError}</Alert> : null}

      {canAdmin ? (
        <Panel title="Create desk">
          <form className="grid gap-3 md:grid-cols-3" onSubmit={createDesk}>
            <div className="space-y-1">
              <Label htmlFor="desk-create-name">Name</Label>
              <Input
                id="desk-create-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="desk-create-type">Type</Label>
              <Select
                id="desk-create-type"
                value={createType}
                onChange={(e) => setCreateType(e.target.value)}
              >
                <option value="incident">Incident</option>
                <option value="problem">Problem</option>
                <option value="service_request">Service request</option>
                <option value="change">Change</option>
                <option value="kb">Knowledge base</option>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="desk-create-prefix">Number prefix</Label>
              <Input
                id="desk-create-prefix"
                value={createPrefix}
                onChange={(e) => setCreatePrefix(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <Button type="submit">Create</Button>
            </div>
          </form>
        </Panel>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="All desks">
          <DataTable
            mode="server"
            caption="Desks"
            columns={columns}
            rows={desks}
            filterState={tableQuery.state}
            onFilterStateChange={tableQuery.setState}
            getRowId={(row) => row.id}
            onRowClick={(desk) => void openDesk(desk.id)}
            emptyTitle="No desks."
            pagination={{
              page,
              perPage,
              total: meta.total,
              onPageChange: setPage,
              onPerPageChange: (size) => {
                setPerPage(size);
                setPage(1);
              },
            }}
          />
        </Panel>
        <Panel title={selected ? selected.name : "Detail"}>
          {!selected ? (
            <p className="text-sm text-[var(--muted-foreground)]">Select a desk.</p>
          ) : (
            <div className="space-y-6 text-sm">
              {canAdmin ? (
                <form className="grid gap-3" onSubmit={saveDesk}>
                  <div className="space-y-1">
                    <Label htmlFor="desk-edit-name">Name</Label>
                    <Input
                      id="desk-edit-name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="desk-edit-prefix">Number prefix</Label>
                    <Input
                      id="desk-edit-prefix"
                      value={editPrefix}
                      onChange={(e) => setEditPrefix(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="desk-edit-active">Active</Label>
                    <Select
                      id="desk-edit-active"
                      value={editActive ? "1" : "0"}
                      onChange={(e) => setEditActive(e.target.value === "1")}
                    >
                      <option value="1">Active</option>
                      <option value="0">Inactive</option>
                    </Select>
                  </div>
                  <div>
                    <Button type="submit">Save desk</Button>
                  </div>
                </form>
              ) : null}

              <div>
                <div className="mb-2 font-medium">Stages</div>
                <DataTable
                  mode="client"
                  caption="Desk stages"
                  columns={stageColumns}
                  rows={selected.stages ?? []}
                  getRowId={(row) => row.id}
                  emptyTitle="No stages."
                  onRowClick={canAdmin ? fillStage : undefined}
                />
                {canAdmin ? (
                  <form className="mt-3 grid gap-2 md:grid-cols-2" onSubmit={addStage}>
                    <div className="space-y-1 md:col-span-2">
                      <Label htmlFor="stage-name">Stage name</Label>
                      <Input
                        id="stage-name"
                        value={stageName}
                        onChange={(e) => setStageName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="stage-sequence">Sequence</Label>
                      <Input
                        id="stage-sequence"
                        value={stageSequence}
                        onChange={(e) => setStageSequence(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="stage-escalation">Escalation minutes</Label>
                      <Input
                        id="stage-escalation"
                        value={stageEscalation}
                        onChange={(e) => setStageEscalation(e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                    <label htmlFor="stage-terminal" className="flex items-center gap-2">
                      <input
                        id="stage-terminal"
                        type="checkbox"
                        checked={stageTerminal}
                        onChange={(e) => setStageTerminal(e.target.checked)}
                        className="h-4 w-4 rounded border border-[var(--border)]"
                      />
                      Terminal
                    </label>
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="submit">
                          {editingStageId !== null ? "Update stage" : "Add stage"}
                        </Button>
                        {editingStageId !== null ? (
                          <Button type="button" variant="secondary" onClick={resetStageForm}>
                            Cancel
                          </Button>
                        ) : null}
                      </div>
                      <p className="text-xs text-[var(--muted-foreground)] md:col-span-2">
                        Tip: use Edit on a stage row to load it into this form.
                      </p>
                    </div>
                  </form>
                ) : null}
              </div>

              <div>
                <div className="mb-2 font-medium">Statuses</div>
                <DataTable
                  mode="client"
                  caption="Statuses"
                  columns={supportColumns}
                  rows={(selected.statuses ?? []) as DeskSupportRow[]}
                  getRowId={(row) => row.id}
                  emptyTitle="No statuses."
                />
              </div>
              <div>
                <div className="mb-2 font-medium">Priorities</div>
                <DataTable
                  mode="client"
                  caption="Priorities"
                  columns={supportColumns}
                  rows={(selected.priorities ?? []) as DeskSupportRow[]}
                  getRowId={(row) => row.id}
                  emptyTitle="No priorities."
                />
              </div>
              <div>
                <div className="mb-2 font-medium">Severities</div>
                <DataTable
                  mode="client"
                  caption="Severities"
                  columns={supportColumns}
                  rows={(selected.severities ?? []) as DeskSeverity[]}
                  getRowId={(row) => row.id}
                  emptyTitle="No severities."
                />
              </div>
              <div>
                <div className="mb-2 font-medium">Categories</div>
                <DataTable
                  mode="client"
                  caption="Categories"
                  columns={supportColumns}
                  rows={(selected.categories ?? []) as DeskSupportRow[]}
                  getRowId={(row) => row.id}
                  emptyTitle="No categories."
                />
              </div>

              {canAdmin ? (
                <form className="grid gap-2 md:grid-cols-2" onSubmit={addSupport}>
                  <div className="space-y-1">
                    <Label htmlFor="support-table">Support table</Label>
                    <Select
                      id="support-table"
                      value={supportTable}
                      onChange={(e) => setSupportTable(e.target.value as SupportTable)}
                    >
                      <option value="statuses">Statuses</option>
                      <option value="priorities">Priorities</option>
                      <option value="severities">Severities</option>
                      <option value="categories">Categories</option>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="support-name">Name</Label>
                    <Input
                      id="support-name"
                      value={supportName}
                      onChange={(e) => setSupportName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="support-slug">Slug</Label>
                    <Input
                      id="support-slug"
                      value={supportSlug}
                      onChange={(e) => setSupportSlug(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  {supportTable === "statuses" ? (
                    <label htmlFor="support-closed" className="flex items-center gap-2 self-end">
                      <input
                        id="support-closed"
                        type="checkbox"
                        checked={supportClosed}
                        onChange={(e) => setSupportClosed(e.target.checked)}
                        className="h-4 w-4 rounded border border-[var(--border)]"
                      />
                      Closed status
                    </label>
                  ) : null}
                  {supportTable === "priorities" ? (
                    <div className="space-y-1">
                      <Label htmlFor="support-weight">Weight</Label>
                      <Input
                        id="support-weight"
                        value={supportWeight}
                        onChange={(e) => setSupportWeight(e.target.value)}
                      />
                    </div>
                  ) : null}
                  <div>
                    <Button type="submit">Add support row</Button>
                  </div>
                </form>
              ) : null}

              <div>
                <div className="mb-2 font-medium">Procedures</div>
                <DataTable
                  mode="client"
                  caption="Desk procedures"
                  columns={procedureColumns}
                  rows={selected.procedures ?? []}
                  getRowId={(row) => row.id}
                  emptyTitle="No procedures."
                  onRowClick={canAdmin ? fillProcedure : undefined}
                />
                {canAdmin ? (
                  <form className="mt-3 grid gap-2" onSubmit={addProcedure}>
                    <div className="space-y-1">
                      <Label htmlFor="procedure-name">Name</Label>
                      <Input
                        id="procedure-name"
                        value={procedureName}
                        onChange={(e) => setProcedureName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="procedure-hook">Hook</Label>
                      <Select
                        id="procedure-hook"
                        value={procedureHook}
                        onChange={(e) => setProcedureHook(e.target.value)}
                      >
                        <option value="on_create">On create</option>
                        <option value="on_stage_enter">On stage enter</option>
                        <option value="on_escalation">On escalation</option>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="procedure-stage">Stage (optional)</Label>
                      <Select
                        id="procedure-stage"
                        value={procedureStageId}
                        onChange={(e) => setProcedureStageId(e.target.value)}
                      >
                        <option value="">None</option>
                        {(selected.stages ?? []).map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="procedure-steps">Steps (JSON array)</Label>
                      <Textarea
                        id="procedure-steps"
                        rows={3}
                        value={procedureStepsJson}
                        onChange={(e) => setProcedureStepsJson(e.target.value)}
                        required
                      />
                    </div>
                    <label htmlFor="procedure-active" className="flex items-center gap-2">
                      <input
                        id="procedure-active"
                        type="checkbox"
                        checked={procedureActive}
                        onChange={(e) => setProcedureActive(e.target.checked)}
                        className="h-4 w-4 rounded border border-[var(--border)]"
                      />
                      Active
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit">
                        {editingProcedureId !== null ? "Update procedure" : "Add procedure"}
                      </Button>
                      {editingProcedureId !== null ? (
                        <Button type="button" variant="secondary" onClick={resetProcedureForm}>
                          Cancel
                        </Button>
                      ) : null}
                    </div>
                  </form>
                ) : null}
              </div>

              <div>
                <div className="mb-2 font-medium">SLA</div>
                <DataTable
                  mode="client"
                  caption="SLA policies"
                  columns={slaColumns}
                  rows={selected.sla_policies ?? []}
                  getRowId={(row) => row.id}
                  emptyTitle="No SLA policies."
                  onRowClick={canAdmin ? fillSla : undefined}
                />
                {canAdmin ? (
                  <form className="mt-3 grid gap-2" onSubmit={addSla}>
                    <div className="space-y-1">
                      <Label htmlFor="sla-name">Name</Label>
                      <Input
                        id="sla-name"
                        value={slaName}
                        onChange={(e) => setSlaName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="sla-goals">Goals (JSON array)</Label>
                      <Textarea
                        id="sla-goals"
                        rows={3}
                        value={slaGoalsJson}
                        onChange={(e) => setSlaGoalsJson(e.target.value)}
                        required
                      />
                    </div>
                    <label htmlFor="sla-default" className="flex items-center gap-2">
                      <input
                        id="sla-default"
                        type="checkbox"
                        checked={slaDefault}
                        onChange={(e) => setSlaDefault(e.target.checked)}
                        className="h-4 w-4 rounded border border-[var(--border)]"
                      />
                      Default policy
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit">
                        {editingSlaId !== null ? "Update SLA" : "Add SLA"}
                      </Button>
                      {editingSlaId !== null ? (
                        <Button type="button" variant="secondary" onClick={resetSlaForm}>
                          Cancel
                        </Button>
                      ) : null}
                    </div>
                  </form>
                ) : null}
              </div>
            </div>
          )}
        </Panel>
      </div>

      {canAdmin && selected ? (
        <Panel title={`Templates · ${selected.name}`}>
          <div className="space-y-6">
            <div>
              <div className="mb-2 font-medium">Message templates</div>
              <DataTable
                mode="client"
                caption="Message templates"
                columns={messageTemplateColumns}
                rows={templates.messages}
                getRowId={(row) => row.id}
                emptyTitle="No message templates."
              />
              <form className="mt-3 grid gap-2" onSubmit={addMessageTemplate}>
                <div className="space-y-1">
                  <Label htmlFor="msg-tpl-name">Name</Label>
                  <Input
                    id="msg-tpl-name"
                    value={messageTemplateName}
                    onChange={(e) => setMessageTemplateName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="msg-tpl-subject">Subject</Label>
                  <Input
                    id="msg-tpl-subject"
                    value={messageTemplateSubject}
                    onChange={(e) => setMessageTemplateSubject(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="msg-tpl-body">Body</Label>
                  <Textarea
                    id="msg-tpl-body"
                    rows={3}
                    value={messageTemplateBody}
                    onChange={(e) => setMessageTemplateBody(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Button type="submit">Add message template</Button>
                </div>
              </form>
            </div>
            <div>
              <div className="mb-2 font-medium">Note templates</div>
              <DataTable
                mode="client"
                caption="Note templates"
                columns={noteTemplateColumns}
                rows={templates.notes}
                getRowId={(row) => row.id}
                emptyTitle="No note templates."
              />
              <form className="mt-3 grid gap-2" onSubmit={addNoteTemplate}>
                <div className="space-y-1">
                  <Label htmlFor="note-tpl-name">Name</Label>
                  <Input
                    id="note-tpl-name"
                    value={noteTemplateName}
                    onChange={(e) => setNoteTemplateName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="note-tpl-body">Body</Label>
                  <Textarea
                    id="note-tpl-body"
                    rows={3}
                    value={noteTemplateBody}
                    onChange={(e) => setNoteTemplateBody(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Button type="submit">Add note template</Button>
                </div>
              </form>
            </div>
          </div>
        </Panel>
      ) : null}

      <ConfirmDialog
        open={pendingDeleteMessage !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteMessage(null);
        }}
        title="Delete message template"
        description={`Delete message template ${pendingDeleteMessage?.name ?? ""}?`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (!pendingDeleteMessage) return;
          await deleteMessageTemplate(pendingDeleteMessage);
        }}
      />
      <ConfirmDialog
        open={pendingDeleteNote !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteNote(null);
        }}
        title="Delete note template"
        description={`Delete note template ${pendingDeleteNote?.name ?? ""}?`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (!pendingDeleteNote) return;
          await deleteNoteTemplate(pendingDeleteNote);
        }}
      />
    </div>
  );
}
