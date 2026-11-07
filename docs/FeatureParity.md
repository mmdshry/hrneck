# HRNECK feature parity

Track implementation status for HRNECK.

## Organization & access

- [x] Foundation monorepo + brand config
- [x] Demo MSP admin user
- [x] Demo tenants (`itneck`, `test`, `company`) on `{slug}.hrneck.test`
- [x] MFA setup/verify API + Settings MFA page
- [x] RBAC hierarchy: platform staff (`platform_super_admin` / `platform_agent`) vs single-tenant org users (`org_admin` + custom roles)
- [x] Spatie teams (`tenant_id`) + `users.tenant_id` membership (no multi-company users)
- [x] Org permission catalog + middleware on `/api/v1/org/*`; MSP gated to platform staff
- [x] Org Users / Roles API + Next UI (`/org/users`, `/org/roles`)
- [x] Employees (`Target`) categorized by department/groups only (no RBAC)
- [x] Demo users: `admin@hrneck.test` (platform), `admin@{tenant}.test` (org_admin)
- [x] White-label settings API (display name, color, timezone)
- [x] MSP Organizations live API (industry, employee band, status, module flags)
- [x] Realtime WebSocket (Laravel Reverb + Echo): MSP + org Refresh-live pages use private channel snapshot/updated (no manual refresh)
- [x] Org shell sidebar (Dashboard, Users, Roles, Training, Checklists, Ticketing, Targets, Reporting, Settings, Guides)
- [x] Filament full admin (`admin.hrneck.test/admin`): Tenant Switcher (`filament_tenant_id`) + central directory + full tenant ops/settings/reporting
- [ ] SSO admin Entra OIDC (deferred)
- [ ] Active/Purchased license cards (deferred to Billing)

### UI split

| Surface | Role |
|---------|------|
| Filament (`/admin`) | Platform staff only (`platform_super_admin` / `platform_agent`); tenant switcher for ops |
| Next `/msp` | Platform staff |
| Next `/org` | Organization users (`tenant_id` match) with RBAC permissions |

## Targets & directory

- [x] Targets / groups CRUD API + Groups UI (PATCH/DELETE + soft archive via `status=inactive`)
- [x] CSV import UI
- [x] Directory sync mock/fixture
- [x] Entra / Google driver interface (mock; real credentials later)
- [x] Sync before campaign via explicit API
- [x] Risk score on targets

## Training

- [x] Course library (sample)
- [x] Quizzes + learner portal
- [x] Training Campaign entity + metrics UI + email reminder job (PATCH cancel/archive + DELETE)
- [x] Assign course or single article/video to targets and/or groups (`POST /training/assign`, campaign `group_ids`)
- [x] Admin viewing report (per-lesson progress, watch time, timestamps) + CSV export
- [x] SMTP delivery (mail.hrneck.com)
- [x] Sending profiles CRUD (PATCH/DELETE)
- [x] Custom sending domain DNS guidance stub

## Checklists (internal HR)

- [x] Admin-only flexible form builder (`org.checklists.manage`); no learner/`/learn` access
- [x] Template versions + per-target instances bound to `Target`
- [x] Item types: section, checkbox, text, select, date, number, file, link, rich note
- [x] Conditional visibility (`visible_when`) + item dependencies (`requires`)
- [x] Save template with admin choice: apply schema to open instances or new-only
- [x] Detailed activity audit (Spatie activitylog in tenant DB) + instance audit UI
- [x] Five system HR templates (onboarding, offboarding, IT access, transfer, leave return)
- [ ] Filament parity for checklists (deferred)

## Reporting

- [x] Dashboards / summary API
- [x] Email report job (CSV)
- [x] Scheduled report cadences (monthly/weekly/quarterly)
- [x] Quarterly PDF export (DomPDF) + monthly/quarterly calendar UI
- [x] Report archives + 6-month prune command
- [x] Risk indicators on targets
- [x] Webhook delivery stub

## Integrations

- [x] SMTP Connected status in Settings → Integrations
- [x] Optional `php artisan hrneck:smtp-smoke` (`HRNECK_SMTP_SMOKE=1`)
- [ ] Live Entra / Graphus (placeholder until credentials)

## Ticketing (Kaseya Service Desk core)

- [x] ITIL desks: Incident, Problem, Service Request, Change + Knowledge Base seed
- [x] Stages, statuses, priorities, severities, categories
- [x] Tickets CRUD + notes, tasks, attachments
- [x] Bulk: archive/unarchive, unlock, read/unread, stop notification, delete, group update, link, merge, copy
- [x] Procedures (on_create / on_stage_enter / on_escalation) + escalation job
- [x] SLA policies, goals, breach evaluation
- [x] Email readers + ingest/IMAP poller job + delayed notifications
- [x] KB articles, ticket→KB convert, Search All
- [x] Org UI `/org/ticketing/*` (HRNECK UX, English)
- [x] End-user portal `/portal/tickets` + published KB
- [x] Filament tenant-ops Tickets resource (view/unlock)
- [x] Reports summary + CSV export; import/export JSON package
- [x] Preferences (delay, scope, default desk)
- [x] RBAC: `org.ticketing.*` + `sd_admin` / `sd_technician` / `sd_user` / `kb_admin`

### Ticketing non-goals

- Device agents / Live Connect / remote registry-file
- Native mobile apps
- Service Billing / PSA invoicing
- Pixel-perfect Kaseya UI clone

### Ticketing smoke (manual)

1. Login org admin → `/org/ticketing` → create incident → add note/task → change stage
2. Convert ticket to KB → confirm in `/org/ticketing/kb` and `/portal/kb`
3. Configure email reader → Ingest test mail → ticket appears
4. Force escalation (set `escalation_due_at` past) → run escalations job → level++
5. `/portal/tickets` submit as portal user → add note
6. Reports CSV download; export/import selected tickets

## Platform

- [x] Feature flags (Pennant)
- [x] Audit log package installed
- [x] Fleet-wide org CRUD activity logging (Spatie `activity_log` in tenant DB via `LogOrgActivity`)
- [x] Filament Activity log resource (read-only; HRneck platform staff + tenant switcher; not exposed to customers)
- [x] Activity log retention prune (`hrneck:prune-activity-logs`, 180 days)
- [x] Backup package installed
- [x] Rate limit per tenant
- [x] Notifications/mail pipeline
- [x] Agentic browsing aids (`public/llms.txt`, `robots.txt`)
- [x] Org announcements / report schedules / report archives edit+delete APIs
- [x] Org users PATCH profile + delete UI
