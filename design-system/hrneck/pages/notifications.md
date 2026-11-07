# Notifications Page Overrides

> **PROJECT:** HRNECK  
> **Page Type:** In-app inbox / announcement publish

---

## Page-Specific Rules

### Layout

- Bell lives in the OrgShell **top content header** (desktop + mobile), plus portal chrome and learn actions — not in the sidebar brand block.
- Clicking the bell navigates to `/org/notifications` (full content-column inbox). No floating dropdown panel.
- Inbox page: one `PageHeader` + mark-all action + a single list (type icon, title, body, timestamp). Unread rows use muted surface tint.
- Announcements admin (`/org/announcements`): one form (title + body + publish) and one Recent list — no cards in the hero/header.

### Feedback

- Transient success/error uses Sonner toasts with Lucide icons (CheckCircle2 / XCircle / Info / Bell).
- Live notification arrivals toast only when the document is visible and the user is **not** already on `/org/notifications`.
- Unread badge: visual count plus a single `role="status"` string (e.g. “3 unread notifications”), never a bare live number.

### Motion

- Respect `prefers-reduced-motion`.
- No bounce/overshoot on dense notification rows.

### Branding co-location

- Top header shows tenant label + bell; BrandMark remains in the sidebar (and mobile header brand).
