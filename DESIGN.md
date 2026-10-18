---
name: Smart Stock Alert
description: Vaccine stock tracking and alerting for AKUH districts, union councils and facilities.
colors:
  forest-green: "#2F4234"
  forest-green-raised: "#3B5A40"
  forest-wash: "#E8F0EA"
  sidebar-forest: "#1D2721"
  warm-paper: "#F3F3F1"
  card-white: "#FFFFFF"
  hairline: "#E6E6E1"
  chip-stone: "#ECECE8"
  ledger-ink: "#1C211E"
  pencil-grey: "#6B726C"
  status-adequate: "#2F9E66"
  status-adequate-wash: "#E1EEE4"
  status-adequate-text: "#2F6B46"
  status-low: "#E0A53A"
  status-low-wash: "#F6E6C6"
  status-low-text: "#8A5A12"
  status-critical: "#C5483F"
  status-critical-wash: "#F7DEDB"
  status-critical-text: "#A8352D"
  status-info: "#2F5B99"
  status-info-wash: "#DFE8F5"
  status-none-text: "#5B625D"
  category-teal: "#1F7A7A"
  category-teal-wash: "#DCEFEE"
  category-indigo: "#4F57B0"
  category-indigo-wash: "#E3E5F6"
  category-plum: "#8B4C9C"
  category-plum-wash: "#F0E3F3"
  category-sky: "#2F7FB8"
  category-sky-wash: "#DDEBF6"
  category-slate: "#56636F"
  category-slate-wash: "#E6E9EC"
typography:
  display:
    fontFamily: "Figtree Variable, Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 300
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Figtree Variable, Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 300
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Figtree Variable, Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "Figtree Variable, Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "-0.011em"
  numeric:
    fontFamily: "Figtree Variable, Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 300
    lineHeight: 1
    fontFeature: "tnum"
  label:
    fontFamily: "Figtree Variable, Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.06em"
rounded:
  control: "10px"
  card: "18px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.forest-green}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.forest-green-raised}"
  button-secondary:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ledger-ink}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  input-field:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ledger-ink}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  card:
    backgroundColor: "{colors.card-white}"
    rounded: "{rounded.card}"
    padding: "20px"
  chip-filter:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ledger-ink}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  chip-filter-active:
    backgroundColor: "{colors.chip-stone}"
  status-pill-critical:
    backgroundColor: "{colors.status-critical-wash}"
    textColor: "{colors.status-critical-text}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
  nav-item-active:
    backgroundColor: "{colors.sidebar-forest}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
---

# Design System: Smart Stock Alert

## Overview

**Creative North Star: "The Ward Ledger"**

The interface is a calm, exact record book kept on a busy ward. Warm paper surfaces, ink-dark numbers and a single forest green carry the identity. Red, amber and green are reserved for stock status, so when red or amber appears it is the most important thing on screen. A small categorical palette (teal, indigo, plum, sky, slate) keeps charts, KPI icons and tags from feeling dry without competing with status. It never decorates to fill space.

Density is moderate. Admin and supervisor screens are tables and lists that people scan under time pressure. The facility-worker screens are phone-first, one-handed, with large targets. Every number is set in tabular figures so columns align and change is visible. Hierarchy comes from type weight, spacing and position, not from boxes, icons or tints.

Light and dark themes share one token set: CSS variable channel triplets in `src/index.css`, mapped in `tailwind.config.js`. Dark mode follows the OS, and the user can override it.

**Key Characteristics:**
- Warm paper canvas, white hairline cards, forest-green sidebar and primary actions.
- Status colour (red / amber / green / grey) always means status and is always paired with a text label; categorical hues never mean status.
- Flat surfaces; shadows only on things that float.
- One card radius, one control radius, pills for status and filters.
- Numbers are the product: large, light, tabular.

## Colors

A restrained forest-and-paper palette, with four status hues that do all the signalling.

### Primary
- **Forest Green** (#2F4234): primary buttons, active tab and segment text, links, focus rings. It sits on 10% of a screen or less.
- **Raised Forest** (#3B5A40): the hover state of primary actions.
- **Forest Wash** (#E8F0EA): selected rows, active nav indicator background, subtle primary emphasis.
- **Sidebar Forest** (#1D2721): the app sidebar only. It anchors the shell and never appears inside content.

### Neutral
- **Warm Paper** (#F3F3F1): the page canvas and table-row hover.
- **Card White** (#FFFFFF): cards, inputs, dialogs.
- **Hairline** (#E6E6E1): every border and divider.
- **Chip Stone** (#ECECE8): segmented-control tracks, active filter chips, neutral badges.
- **Ledger Ink** (#1C211E): primary text and numbers.
- **Pencil Grey** (#6B726C): secondary text, labels, captions, table headers.

### Status (semantic; never decorative)
- **Critical** (#C5483F dot, #F7DEDB wash, #A8352D text): stock below threshold, failures, destructive confirmation.
- **Low** (#E0A53A dot, #F6E6C6 wash, #8A5A12 text): approaching threshold, pending or awaiting states.
- **Adequate / Normal** (#2F9E66 dot, #E1EEE4 wash, #2F6B46 text): healthy stock, approved, completed.
- **Info** (#2F5B99 on #DFE8F5): neutral in-progress states (sent, in transit), informational notes.
- **Not updated** (#5B625D on Chip Stone): no data recorded yet.

### Category (decorative-but-meaningful; never status)
Tokens `--cat-1…5` with a `-bg` wash each (`text-cat-1`, `bg-cat-1-bg`, …), defined for light and dark in `src/index.css`; chart hex values in `useChartTheme().series`.
- **Teal** (#1F7A7A on #DCEFEE), **Indigo** (#4F57B0 on #E3E5F6), **Plum** (#8B4C9C on #F0E3F3), **Sky** (#2F7FB8 on #DDEBF6), **Slate** (#56636F on #E6E9EC).
- Used for: chart series that are not status, KPI icon tiles that are not status, role and group tags, notification type icons.

### Named Rules
**The Status Colour Rule.** Red, amber and green mean stock or workflow status, and nothing else. Anything that needs colour but is not a status takes a category hue. A KPI or chart that does encode status uses the status colour.

**The Category Colour Rule.** Category hues identify a kind of thing (a series, a role, a KPI's subject). Use at most one per element, as text or icon on its own wash; never as large fills, card backgrounds or edge stripes.

**The Label-Always Rule.** No status is communicated by hue alone. Every coloured dot, pill or bar carries its word ("Critical", "Low", "Normal", "Not updated").

**The One Vocabulary Rule.** Stock statuses come from `statusConfig()` and workflow statuses (pending, approved, rejected…) from the shared request-status config in `src/lib/status.js`. Pages never pick status colours themselves.

## Typography

**Display Font:** Figtree Variable (with system-ui fallback)
**Body Font:** Figtree Variable
**Label Font:** Figtree Variable, small caps-style uppercase

**Character:** A single humanist sans used at very different weights. Light (300) for large numbers and page titles gives the ledger calm. Semibold (600) is kept for labels and row titles.

### Hierarchy
- **Display** (300, 36px; 30px on mobile, 1.1): page titles on dashboards and overview screens only.
- **Headline** (300, 30px; 26px on mobile, 1.1): page titles on work screens (forms, lists, registers, logs).
- **Title** (600, 16px, 1.35): card titles, dialog titles, row primary text.
- **Body** (400, 14px, 1.5): default text, table cells, form values. Prose runs at 70ch or less.
- **Numeric** (300, 32px, tabular): KPI values and stock quantities.
- **Label** (600, 11px, 0.06em, uppercase): sidebar section headings and the role pill only. Never a kicker above a heading; sections are named with a Title-style heading.
- **Caption** (500, 12px): KPI labels, table headers, field hints.

### Named Rules
**The Tabular Rule.** Every quantity, count, date or currency uses `tabular-nums`.

**The Two-Weight Rule.** A screen uses at most two weights at body size: 400 for content and 600 for emphasis. Bold (700+) is not used.

## Layout

The app shell is a fixed forest sidebar (250px, collapsible to 72px; an overlay on screens narrower than lg) and a content column with a top bar. Content uses 24px gutters on desktop and 16px on mobile. Forms and detail pages cap their content width; tables and dashboards may span the full width.

Spacing follows a 4px base: 8 / 16 / 24 / 32. Inside a card the padding is 20px; between cards the gap is 16px; between page sections it is 24px. Layout goes from one column on mobile to two or three on desktop. Wide tables become stacked row cards below the md breakpoint.

**The Scope-Visible Rule.** The current scope (facility, UC, district) is always visible in the shell or the page header. Users never have to infer where they are.

## Elevation & Depth

Flat by default. Depth comes from tonal layering: a white card on warm paper, separated by a 1px hairline. Cards and inline panels carry no shadow. Shadows appear only on layers that float above the page.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 8px 24px rgb(28 33 30 / 0.12)`): dropdown menus, popovers, the notification panel, toasts.
- **Overlay** (`box-shadow: 0 24px 48px rgb(28 33 30 / 0.18)`): modals (and the mobile sidebar drawer), over a `rgb(28 33 30 / 0.35)` scrim.

### Named Rules
**The Flat-By-Default Rule.** A surface gets either a hairline border or a shadow, never both. Resting cards use the border; floating layers use the shadow.

## Shapes

Gently rounded and consistent. Cards and panels use an 18px radius. Controls (buttons, inputs, selects, segmented tracks, inner tiles) use 10px. Status pills, filter chips and avatars are fully round. Nested elements reduce the radius rather than repeating it. Borders are always 1px hairline; there are no thick or coloured edge stripes.

## Components

### Buttons
- **Shape:** control radius (10px). Heights of 32px (sm), 36px (md) and 44px (lg, and every touch-first screen).
- **Primary:** forest-green fill with white text. One per view region.
- **Secondary:** white with a hairline border and ink text.
- **Ghost:** forest text, no fill; for tertiary actions and table-row actions.
- **Danger:** critical fill; used only to confirm a destructive action, inside a dialog.
- **Ghost-danger:** critical text on a critical wash on hover; for the entry point to a destructive action in a row or form (Reject, Decline, Deactivate, Cancel request). It is a variant, never a colour override on Ghost.
- **Hover / Focus:** a colour shift only, with no scale or lift. Focus is a 2px forest ring with a 2px offset.

### Chips & Filters
- **Filter chip:** white, hairline border, pill shape. When active it takes the Chip Stone fill and a 600 weight. An optional count sits in Pencil Grey.
- **Status pill:** the status wash background with the status text colour and a 6px dot. Its label comes from the status config.

### Segmented Tabs
- A Chip Stone track with a 4px inset. The active segment is white, with ink text at 600 weight. An optional count follows the label. This is the only tab style; there are no underline tabs or icon-only toggles.

### Cards / Containers
- **Corner Style:** 18px.
- **Background:** Card White on Warm Paper.
- **Shadow Strategy:** none (see Elevation).
- **Border:** 1px Hairline.
- **Internal Padding:** 20px (16px on mobile).

### KPI Figures
- Caption label (Pencil Grey), then the value in the numeric style, then one line of context. Colour on the value only when it encodes status (for example, a critical count in critical text).
- **Icon tile:** a 36px tile, 10px radius, top-right, with an 18px lucide icon that names the KPI's subject. Status KPIs use the status wash and text; others a category wash and text (`StatCard` `icon` + `accent`).

### Tables
- Header row: Caption style (12px, 500, sentence case) in Pencil Grey on white, hairline bottom border.
- Rows: 14px body, 12–16px vertical padding, hairline dividers, Warm Paper on hover.
- Numbers are right-aligned and tabular.
- Below md, each row becomes a stacked card with label/value pairs.
- Loading, empty and error states render inside the table frame.

### Inputs / Fields
- **Style:** white, hairline border, 10px radius, 36px height (44px on touch-first screens). The label sits above in 14px at 500 weight.
- **Focus:** the border shifts to forest with a 3px forest/10% ring.
- **Error:** critical border and a message below in critical text that says what is true ("Only 12 doses left").
- **Notes and reasons:** `Textarea`, same style as inputs, two rows, label with `(required)` or `(optional)`.
- **Raw numeric cells:** compact quantity fields inside tables and steppers (Assign Vials, Day End, Raise request, Record sent) are plain `<input type="number">` styled like an Input at 36px, because a label and field wrapper does not fit a table cell. This is the only sanctioned exception.

### Navigation
- **Sidebar** (250px, Sidebar Forest):
  - **Brand block:** a 38px Raised Forest tile with a 10px radius and a white line icon, beside a two-line "Stock Management & Alert System" wordmark (14px, 500, white). A hairline (white/8%) separates it from the nav.
  - **Scope line:** under the brand, in label style, the role section and current scope (for example "FACILITY · RHC Latifabad").
  - **Primary CTA:** one per role, linking to its most-used page (facility supervisor: Assign Vials; head: Approvals; UC supervisor: Stock Requests). A light button: paper fill, Sidebar Forest text, 10px radius, full width. Admin, district, observer and the view-only worker have none.
  - **Items:** 14px at 400 weight. A lucide icon at 18px with a 1.75 stroke and 70% opacity. Idle text is white at 75%; active is white at 100% on a white/10% fill with a 10px radius. Each item has a distinct icon.
  - **Grouping:** Label-style section headings group items by task. Sign Out sits at the bottom.
- **Top bar:** a hairline bottom border on the canvas.
  - **Left:** the ☰ menu toggle at every width: on lg+ it switches the sidebar between 250px and the 72px icon rail (remembered); below lg it opens the drawer.
  - **Right:**
    - the offline/sync status;
    - the theme toggle;
    - the 🔔 emoji bell with a critical-red count pill offset top-right (`9+` cap);
    - the role pill (Status Adequate wash and text, uppercase label style);
    - the name with its scope beneath in Pencil Grey;
    - a 38px Forest Green avatar circle with the initial.
- **Mobile:** the sidebar becomes an overlay drawer over the scrim.

### Feedback States
- **Loading:** skeletons that match the final layout (rows for tables, blocks for cards), on Warm Paper.
- **Empty:** a one-line statement of what is missing and the action that fixes it. No illustration.
- **Error:** an inline critical-wash panel with the actual message and a Retry action.

## Do's and Don'ts

### Do:
- **Do** route every colour through the tokens (`bg-surface`, `text-text-muted`, `bg-danger-bg`…); never use hex values or Tailwind palette colours in pages.
- **Do** use `statusConfig()` and `StatusBadge` for stock status, and the shared request-status config for workflow status.
- **Do** use the shared components (`Card`, `Tabs`, `FilterChips`, `Table`, `EmptyState`, `ErrorState`, `Modal`) instead of hand-rolling them.
- **Do** keep one primary action per region and put page actions in the `PageHeader` actions slot.
- **Do** pair every status colour with its text label.
- **Do** use `tabular-nums` for every number.

### Don't:
- **Don't** use coloured left-border stripes (`border-l-4`) on cards or rows; show status with a pill or dot.
- **Don't** use red, amber or green for anything that is not a status.
- **Don't** use ring gauges or donuts as decoration; use a chart only when it shows a comparison or trend.
- **Don't** stack border, shadow and radius on resting cards.
- **Don't** mix radii (`rounded-xl`, `rounded-2xl`, `rounded-[18px]`) for the same kind of container.
- **Don't** use emoji or glyph characters as icons; use lucide-react at 16–18px with a 1.75 stroke. The one exception is the top-bar 🔔 notification bell, which matches the reference mockups.
- **Don't** use gradients, glassmorphism or `backdrop-blur` surfaces.
- **Don't** use bold (700+) or oversized greetings on work screens.
- **Don't** put uppercase eyebrow kickers above section headings ("VACCINE STOCK STATUS"); name the section with a Title heading.
