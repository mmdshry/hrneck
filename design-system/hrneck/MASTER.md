# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/hrneck/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** HRNECK
**Category:** Security awareness training SaaS (MSP / org / learner)
**Design Dials:** Variance 4/10 (Balanced / Modern) | Motion 4/10 (Standard) | Density 5/10 (Standard)
**Default theme:** Light (dark optional via toggle)

---

## Global Rules

### Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#1E3A5F` | `--color-primary` / `--primary` |
| On Primary | `#FFFFFF` | `--color-on-primary` |
| Secondary | `#334155` | `--color-secondary` |
| On Secondary | `#FFFFFF` | `--color-on-secondary` |
| Accent/CTA | `#047857` | `--color-accent` / `--accent` |
| On Accent/CTA | `#FFFFFF` | `--color-on-accent` |
| Background | `#F8FAFC` | `--color-background` |
| Foreground | `#0F172A` | `--color-foreground` |
| Card | `#FFFFFF` | `--color-card` |
| Card Foreground | `#0F172A` | `--color-card-foreground` |
| Muted | `#E2E8F0` | `--color-muted` |
| Muted Foreground | `#334155` | `--color-muted-foreground` |
| Border | `#E2E8F0` | `--color-border` |
| Destructive | `#DC2626` | `--color-destructive` |
| On Destructive | `#FFFFFF` | `--color-on-destructive` |
| Ring | `#1E3A5F` | `--color-ring` |

**Color Notes:** Navy trust + emerald accent (≥4.5:1 with white). Do not use accent as body/link text on light backgrounds — use primary for links.

### Typography

- **Heading Font:** Plus Jakarta Sans (variable via `next/font`)
- **Body Font:** Plus Jakarta Sans
- **Mood:** minimal, modern, enterprise, calm
- Minimum body/label size: 12px (`text-xs`)

### Spacing Variables

*Density: 5/10 — Standard*

| Token | Value | Usage |
|------|-------|-------|
| `--space-xs` | `4px` | Tight gaps |
| `--space-sm` | `8px` | Icon gaps |
| `--space-md` | `12px` | Standard padding |
| `--space-lg` | `16px` | Section padding |
| `--space-xl` | `24px` | Large gaps |
| `--space-2xl` | `32px` | Section margins |
| `--space-3xl` | `48px` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(15,23,42,0.06)` | Subtle lift |
| `--shadow-md` | `0 4px 12px rgba(15,23,42,0.08)` | Panels |

---

## Style Guidelines

**Style:** Minimalism & Swiss Style

**Keywords:** Clean, simple, spacious, functional, white space, high contrast, geometric, sans-serif, grid-based, essential

**Key Effects:** Subtle hover (150–250ms), clear type hierarchy, fast loading. No glassmorphism, no heavy backdrop-blur on large surfaces.

### Anti-Patterns (Do NOT Use)

- Excessive decoration / glassmorphism
- Dark mode by default
- Color-only indicators
- Emojis as icons
- Layout-shifting hovers
- Low contrast text
- Invisible focus states
- Tap targets under 44px for primary controls

---

## Accessibility & Agentic readiness

- Skip link to `#main-content` on every page
- One `<main id="main-content">` per view
- Interactive controls have accessible names
- Tables: caption + `scope` on headers
- Public `llms.txt` at site root
- Respect `prefers-reduced-motion`
