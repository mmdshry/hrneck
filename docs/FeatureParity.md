# HRNECK feature parity

Track implementation status for HRNECK.

## Organization & access

- [x] Foundation monorepo + brand config
- [x] Demo MSP admin user
- [x] Demo tenants (`itneck`, `test`, `company`) on `{slug}.hrneck.test`
- [x] MFA setup/verify/disable + recovery codes + Settings MFA/password page
- [x] Password forgot/reset/change API + Next `/login/forgot` `/login/reset`
- [x] Email verification gate on login (admin-created users verified)
- [x] Platform staff tenant-context (`staff_tenant_id` enter/leave) for Next `/org`
- [x] Next `proxy.ts` auth gate for `/msp` `/org` `/learn` `/portal`
- [x] RBAC roles (peer, not hierarchical): platform staff (`platform_super_admin` / `platform_agent`) and single-tenant org users (`org_admin` + custom roles + `learner`)
- [x] Spatie teams (`tenant_id`) + `users.tenant_id` membership (no multi-company users)
- [x] Org permission catalog + middleware on `/api/v1/org/*`; MSP gated to platform staff
- [x] Org Users / Roles API + Next UI (`/org/users`, `/org/roles`)
- [x] Employees (`Target`) paired with login `User`/`learner`; categorized by department/groups (not operator RBAC)
- [x] Demo users: `admin@hrneck.test` (platform), `admin@{tenant}.test` (org_admin)
- [x] White-label settings API (display name, color, timezone)
- [x] MSP Organizations live API (industry, employee band, status, module flags / `training_enabled` — informational, not enforced)
- [x] Realtime WebSocket (Laravel Reverb + Echo): MSP + org Refresh-live pages use private channel snapshot/updated (no manual refresh)
- [x] Org shell sidebar (Dashboard, Organizations/MSP, Training, Courses, Checklists, Ticketing, Employees, Departments, Groups, Users, Roles, Reporting, Export, Announcements, Settings, Guides)
- [x] SSO sign-in with Google and Microsoft (Entra and personal accounts), global OAuth credentials, link-only to pre-provisioned users; see [auth.md](auth.md#single-sign-on-google-and-microsoft)
- [ ] SSO admin per organization: own Entra/OIDC settings in Settings → Integrations (deferred)
- [ ] Active/Purchased license cards (deferred to Billing)

### UI split

| Surface | Role |
|---------|------|
| Next `/msp` | Platform staff |
| Next `/org` | Organization users (`tenant_id` match) **or** platform staff after MSP enter |

## Targets & groups

- [x] Targets / groups CRUD API + Groups UI (PATCH/DELETE + soft archive via `status=inactive`)
- [x] CSV import UI
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
- [x] Item types: section, checkbox, short_text, long_text, single_select, multi_select, date, number, file, link, rich_note
- [x] Conditional visibility (`visible_when`) + item dependencies (`requires`)
- [x] Save template with admin choice: apply schema to open instances or new-only
- [x] Detailed activity audit (Spatie activitylog in tenant DB) + instance audit UI
- [x] Five system HR templates (onboarding, offboarding, IT access, transfer, leave return)
- [x] Checklist packs (API + Next `/org/checklists/packs`)
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
- [x] Tickets CRUD + notes, tasks, attachments — **API + Next ✓** (attachments upload/download, task complete toggle, copy)
- [x] Bulk actions — **API + Next ✓** (archive/unarchive/read/unread/stop_notification/delete/merge/group_update/link/unlock + archived filter)
- [x] Procedures + SLA — **API + Next ✓** (desk create/edit, stages, support rows, procedures, SLA, templates)
- [x] Email readers + ingest/IMAP poller job + delayed notifications — **API + Next ✓** (create/ingest/edit/delete)
- [x] KB articles, ticket→KB convert, Search All — **API + Next ✓** (list/create/edit/publish toggle/delete)
- [x] Org UI `/org/ticketing/*` (HRNECK UX, English) — core flows complete for implemented API surface
- [x] End-user portal `/portal/tickets` + published KB
- [x] Reports summary + CSV/PDF export — **API + Next ✓**; JSON import/export package — **API + Next ✓**
- [x] Preferences (delay, scope, default desk) — **API + Next ✓**
- [x] RBAC: `org.ticketing.*` + `sd_admin` / `sd_technician` / `sd_user` / `kb_admin`

### Ticketing non-goals

- Device agents / Live Connect / remote registry-file
- Native mobile apps
- Service Billing / PSA invoicing
- Pixel-perfect Kaseya UI clone

### Ticketing smoke (manual)

1. Login org admin → `/org/ticketing` → create incident → add note/task → change stage
2. Convert ticket to KB → confirm in `/org/kb` and `/portal/kb`
3. Configure email reader → Ingest test mail → ticket appears
4. Force escalation (set `escalation_due_at` past) → run escalations job → level++
5. `/portal/tickets` submit as portal user → add note
6. Reports CSV download; export/import selected tickets

## Subscription plans

- [x] Plan catalog in the central DB (`subscription_plans`): employee and user limits (empty = unlimited), feature toggles, informational monthly price, active and default flags — managed by platform staff only (audited)
- [x] One subscription per organization (`tenant_subscriptions`): plan, status (`trial` / `active` / `suspended` / `expired`), `trial_ends_at`, `ends_at` — managed by platform staff (audited, realtime refresh)
- [x] New organizations get the default plan; existing organizations were backfilled to it as `active`
- [x] Organizations without a subscription row use the default plan; with no default plan nothing is restricted
- [x] Employee seats (`max_employees`) enforced for new targets (`POST /org/targets`, CSV import, staff employee create and import) and for learner logins that create a new employee
- [x] User seats (`max_users`) enforced for non-learner org users (`POST /org/users`, staff user management); a user is counted as active memberships not linked to an employee
- [x] Feature gates return HTTP 403 `plan_feature_disabled`: `learner_portal` (learner training routes), `training` (course management), `checklists`, `ticketing` (all ticketing groups including portal), `advanced_reporting` (detailed reports and exports), `white_label` (logo upload), `custom_domains` (domain settings; `enabled` flag reflects the plan)
- [x] Limit breaches return HTTP 403 `plan_limit_reached` (message includes limit and usage)
- [x] Read-only subscriptions (`suspended`, `expired`, a trial past `trial_ends_at`, or an active subscription past `ends_at`) keep every read working. Any other org API write (every method except GET/HEAD/OPTIONS under `/api/v1/org/*`) returns HTTP 403 `subscription_read_only` with the effective status; tenant data is unchanged. platform staff are not affected
- [x] Trials expire automatically: `hrneck:expire-trial-subscriptions` runs hourly and moves trials past `trial_ends_at` to `expired` (audited as `tenant_subscription_expired`, source `schedule`). Platform staff can still change any status manually; the job does not expire active subscriptions
- [x] Pennant feature flags resolve per organization from its plan; enforcement itself goes through `TenantEntitlements`
- [x] `automation_rules` removed from the plan catalog because nothing implements it; add it back with a gate when an automation feature ships
- [x] Plan usage in `/auth/me` (`subscription`: plan, status, effective status, read-only flag, `ends_at`, `over_limit`, and used/limit for employees and users) and in the org app: a read-only banner, an over-limit warning, and a usage card in Settings. `/msp` does not show plan usage yet
- [ ] Disabled features are not shown in the org app yet (gated routes return 403 `plan_feature_disabled` only)
- [ ] Confirm the read-only write scope with product: it currently blocks every org write, including learner progress, notification mark-read, exports, and chat messages
- [x] Downgrade policy: lowering a limit below current usage keeps all rows, blocks new seats, and shows an over-limit warning in the org app
- [ ] Payment gateway and self-service plan change (out of scope; platform staff assign plans manually)

## Platform

- [x] Feature flags (Pennant) — per-organization resolvers driven by the subscription plan; hard enforcement via `TenantEntitlements` (see Subscription plans)
- [x] Audit log package installed
- [x] Fleet-wide org CRUD activity logging (Spatie `activity_log` in tenant DB via `LogOrgActivity`)
- [x] Activity log retention prune (`hrneck:prune-activity-logs`, 180 days)
- [x] Backup package installed
- [x] Rate limit per tenant
- [x] Notifications/mail pipeline
- [x] Agentic browsing aids (`public/llms.txt`, `robots.txt`)
- [x] Org announcements / report schedules / report archives edit+delete APIs
- [x] Org users PATCH profile + delete UI
