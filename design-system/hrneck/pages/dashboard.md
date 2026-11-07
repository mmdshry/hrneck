# Dashboard Page Overrides

> **PROJECT:** HRNECK
> **Page Type:** Organization / MSP dashboard

---

## Page-Specific Rules

### Layout Overrides

- OrgShell sidebar + main content with `#main-content` landmark and skip link.
- One `h1` via `PageHeader` per view.
- Dense data allowed in tables/lists; avoid decorative glass/blur on sticky chrome.

### Spacing Overrides

- Slightly denser than marketing pages, still within Master mid density.

### Accessibility

- Tables need `<caption>` (visually hidden OK) and `scope` on header cells.
- Live websocket status is informational; failures must not spam the console.
