# IELTS Evaluator Pro — Design System (Master)

Global source of truth for UI decisions. Page-specific overrides go in `pages/<page>.md`.
Implementation lives in `frontend/tailwind.config.js` and `frontend/src/index.css`.

## Direction

Calm, content-first, flat UI for adult exam preparation. Clear hierarchy, generous
whitespace on learner pages, denser layouts in the instructor and admin workspaces.
No decorative gradients beyond a faint brand wash at the top of learner pages.

## Workspace identity (`brand`)

Every component uses the `brand-*` Tailwind scale. Its hue comes from the nearest
`[data-workspace]` ancestor, so shared components (notifications, profile, authoring,
reports) adopt the right identity automatically.

| Workspace | Attribute set by | Hue | `brand-600` |
|---|---|---|---|
| Student (default on `:root`) | `StudentLayout`, `AuthLayout` | Cobalt | `#2747D9` |
| Instructor | `WorkspaceShell workspace="instructor"` | Teal (shifted one step darker for AA) | `#0F766E` |
| Admin | `WorkspaceShell workspace="admin"` | Graphite | `#3D4A61` |

Rules:
- Primary actions are `bg-brand-600 hover:bg-brand-700` with white text (every workspace passes AA at 4.5:1 or better).
- Use `brand-50/100` for selected/unread tints and `brand-700/800` for accent text.
- Never hard-code hex colours in components; never use `blue-`, `teal-` or `violet-` for workspace identity.

## Categorical and status colours (fixed, not brand)

- Skill areas: `src/lib/skillTone.ts`: Reading `sky`, Writing `violet`, Listening `teal`, Speaking `amber`.
- Role badges: `getRoleBadgeClass`: Learner `indigo`, Instructor `teal`, Admin `slate`.
- Status: success `emerald`, warning `amber`, danger `red`, neutral `slate`.
- Target band and other goals are highlighted in `amber`.

## Neutrals and surfaces

- Text: `slate-900` (headings/body), `slate-600` (secondary), `slate-500` (meta). Avoid `slate-400` for text.
- Page canvas `bg-canvas` (`#F6F8FB`); cards `bg-white border-slate-200/80 rounded-2xl shadow-card`.
- Shadows: `2xs`, `xs`, `card`, `raised`, `popover` (defined in Tailwind config).

## Typography

- Plus Jakarta Sans (Google Fonts), 400–800, single family for UI and headings.
- Page title `text-2xl sm:text-[28px] font-bold tracking-tight`; section title `text-base/lg font-semibold`.
- Body 14–15px, `leading-relaxed` for paragraphs; use `tabular-nums` for scores, timers and counts.
- `tracking-tight` is softened to `-0.012em` globally to suit the font.

## Primitives (`@layer components` in `index.css`)

`ui-card`, `ui-btn-primary`, `ui-btn-secondary`, `ui-btn-ghost`, `ui-icon-btn`, `ui-label`,
`ui-input`, `ui-menu`, `ui-menu-item`, `ui-eyebrow`. Use them for new markup.

Components: `components/ui/Logo` (mark + wordmark), `components/ui/Icon` (Lucide-style SVG set,
use these and never emoji or unicode glyphs as icons), `components/ui/Spinner` + `LoadingScreen`,
`components/layout/WorkspaceShell` (instructor/admin chrome).

## Layout and navigation

- Student: sticky translucent top bar, centred pill tabs at `lg+`, dropdown nav below `lg`.
- Instructor/Admin: `WorkspaceShell`: sticky 17rem sidebar with grouped nav, sticky header with
  breadcrumb (`Workspace › Page`), notifications and account menu; slide-in drawer below `lg`.
  Pages must not repeat the workspace name in an eyebrow; the breadcrumb already shows it.
- Content max width `max-w-7xl`, gutters `px-4 sm:px-6 lg:px-8`.

## Interaction and accessibility

- Visible focus everywhere: global `:focus-visible` outline in the brand colour.
- Targets at least 40px in shells and menus (44px on mobile nav).
- Motion: 150–220ms ease-out for menus and drawers; all motion is disabled under `prefers-reduced-motion`.
- Menus close on Escape and outside click and return focus to their trigger; the drawer is a modal dialog with body scroll locked.
- Forms: visible labels, helper text under the field, a show/hide password toggle, a spinner plus loading text on submit, and errors with an icon in `role="alert"`.
