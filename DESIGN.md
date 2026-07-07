---
name: Vaccine Stock Alert System
description: A ward status board for vaccine stock — scannable, color-coded, built for a glance mid-shift.
colors:
  clinical-blue: "#1F6FEB"
  clinical-blue-light: "#3B82F6"
  clinical-blue-dark: "#1558C0"
  slate: "#6B7280"
  slate-light: "#9CA3AF"
  slate-dark: "#374151"
  status-green: "#16A34A"
  status-green-light: "#22C55E"
  status-green-dark: "#15803D"
  status-green-bg: "#F0FDF4"
  status-amber: "#D97706"
  status-amber-light: "#F59E0B"
  status-amber-dark: "#B45309"
  status-amber-bg: "#FFFBEB"
  status-red: "#DC2626"
  status-red-light: "#EF4444"
  status-red-dark: "#B91C1C"
  status-red-bg: "#FEF2F2"
  paper: "#FFFFFF"
  paper-alt: "#F9FAFB"
  hairline: "#E5E7EB"
  ink: "#111827"
  ink-muted: "#6B7280"
  ink-inverse: "#FFFFFF"
typography:
  headline:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.05em"
rounded:
  sm: "8px"
  md: "12px"
  full: "9999px"
spacing:
  sm: "12px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.clinical-blue}"
    textColor: "{colors.ink-inverse}"
    rounded: "{rounded.sm}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.clinical-blue-dark}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 20px"
  button-danger:
    backgroundColor: "{colors.status-red}"
    textColor: "{colors.ink-inverse}"
    rounded: "{rounded.sm}"
    padding: "10px 20px"
  button-ghost:
    textColor: "{colors.clinical-blue}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
  card:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "16px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  status-badge-green:
    backgroundColor: "{colors.status-green-bg}"
    textColor: "{colors.status-green-dark}"
    rounded: "{rounded.full}"
  status-badge-amber:
    backgroundColor: "{colors.status-amber-bg}"
    textColor: "{colors.status-amber-dark}"
    rounded: "{rounded.full}"
  status-badge-red:
    backgroundColor: "{colors.status-red-bg}"
    textColor: "{colors.status-red-dark}"
    rounded: "{rounded.full}"
  status-badge-no-data:
    backgroundColor: "{colors.paper-alt}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.full}"
---

# Design System: Vaccine Stock Alert System

## 1. Overview

**Creative North Star: "The Ward Status Board"**

Picture the board at the nurses' station: color-coded, glanceable, no wasted words, built to be read correctly in the two seconds someone has between other tasks. That's the system. Every screen exists to answer one question fast — is this facility's vaccine stock fine, low, or critical — and everything else (forms, tables, audit trails) is the supporting record for that one glance.

The system is clinical, trustworthy, and efficient by design, not by accident. It explicitly rejects the consumer/marketing-app register: no gradients, no playful illustration, no decorative motion. This is hospital-grade software used under time pressure by people whose job is not "use software" — the interface should get out of the way of the actual task (check stock, record a movement, catch a shortage before it happens).

**Key Characteristics:**
- Flat surfaces, 1px hairline borders, shadow only as a response to interaction
- One functional accent (clinical blue) reserved for actions and links; saturated color elsewhere is reserved for status meaning only
- System font stack — no custom webfont, nothing to load, nothing to feel "designed" for its own sake
- Status is always paired with a text label, never color alone
- Small, calm, forgiving surfaces — generous enough for a Facility Worker's phone, restrained enough for a Super Admin's dense tables

## 2. Colors

The palette is almost entirely neutral gray and white; color is spent deliberately on two jobs — one blue accent for interactive elements, and the red/amber/green triad for stock status. Nothing else in the system is allowed to be saturated.

### Primary
- **Clinical Blue** (#1F6FEB): the one accent color. Carries primary buttons, active nav state, links, and focus rings. Nowhere else.

### Status
- **Status Green** (#16A34A, dark #15803D, bg #F0FDF4): stock at or above threshold — "OK."
- **Status Amber** (#D97706, dark #B45309, bg #FFFBEB): stock approaching threshold — "Low."
- **Status Red** (#DC2626, dark #B91C1C, bg #FEF2F2): stock at or below threshold — "Critical."
- **No Data** (Slate on Paper Alt): no stock entry has ever been recorded for this vaccine yet. Deliberately gray, not amber or red — it means "we don't know," not "this is low." Never silently falls back to green.

### Neutral
- **Paper** (#FFFFFF): the base surface for cards, tables, modals — everything sits on white.
- **Paper Alt** (#F9FAFB): the page background and table-header wash, one step back from Paper so surfaces read as raised without needing a shadow.
- **Hairline** (#E5E7EB): the single border color used everywhere a surface needs an edge.
- **Ink** (#111827): primary text.
- **Ink Muted** (#6B7280): secondary text, captions, placeholder copy, table labels.

### Named Rules
**The Status-Only Saturation Rule.** Saturated color means one of two things: an action (clinical blue) or a stock status (red/amber/green). If a new element wants a bright color for any other reason, it's wrong — make it gray or make it blue.

## 3. Typography

**Display Font:** none — this system has no hero, no marketing display type.
**Body Font:** the OS-native UI stack (`ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`).
**Label/Mono Font:** none distinct; labels use the same body stack at a smaller size and heavier weight.

**Character:** deliberately anonymous. The system font stack is chosen so the interface loads instantly and reads as "native to the device," never as a branded artifact competing with the data on screen.

### Hierarchy
- **Headline** (700, 1.25rem/20px, line-height 1.2): page titles only — "Facility Dashboard — Stock Levels," "Audit Log." One per screen.
- **Title** (600, 0.875rem/14px, line-height 1.3): card titles, modal titles, vaccine names inside a status card.
- **Body** (400, 0.875rem/14px, line-height 1.5): form labels, table cells, paragraph copy, button text. The workhorse size — most of the interface lives here. Max ~70ch where prose appears (audit-log detail strings, error messages).
- **Label** (600, 0.75rem/12px, letter-spacing 0.05em, uppercase): table column headers, status-pill text, section captions.

### Named Rules
**The System Font Rule.** No webfont is ever loaded. The interface should render instantly and disappear into the OS, not announce itself as designed.

## 4. Elevation

Flat by default. Structure comes from a 1px `hairline` border and the Paper/Paper-Alt contrast, not from shadow. Shadow is reserved for elements that are either responding to interaction or floating untethered above the page — never as ambient decoration on a surface that's just sitting in the layout.

### Shadow Vocabulary
- **Hover lift** (`box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)` / Tailwind `shadow-md`): applied only on `:hover` to a card that's actually a click target, paired with a `transition-shadow`. Signals "this is clickable," never present at rest, and never applied to a static card that has no click target (District/Facility cards currently have neither an `onClick` nor this class, on purpose).
- **Floating elements** (`shadow-xl` on the Modal, `shadow-lg` on the Toast): the two elements in the system that are never part of the page's own layout flow — a Modal sits above a dimmed backdrop, a Toast sits fixed above whatever content happens to be underneath. Both get a resting shadow because both need real spatial separation from a page they aren't laid out inside of.

### Named Rules
**The Border-at-Rest Rule.** Every surface that's part of the page layout is flat with a hairline border when nothing is happening to it. Shadow only appears as a *response* to hover, or on the two floating elements (Modal, Toast) that sit outside the page's own layout — never as ambient decoration on a laid-out surface.

## 5. Components

Calm and reassuring to use: generous touch targets, soft (not sharp) corners, motion kept to simple color/shadow transitions — nothing that could read as fussy or add friction for a Facility Worker on a phone in a clinic.

### Buttons
- **Shape:** gently rounded (8px / `rounded-lg`).
- **Primary:** Clinical Blue background, white text, 10px/20px padding; used for the one primary action per screen (Sign In, Save, Record Stock).
- **Secondary:** Paper background, Hairline border, Ink text — the default "cancel" or secondary action.
- **Danger:** Status Red background, white text — reserved for destructive/irreversible actions (deactivate).
- **Ghost:** no background, Clinical Blue text, a soft blue wash on hover (`primary/10`) — used for inline row actions (Edit, Rename, Reset).
- **Hover / Focus:** background darkens one step on hover (e.g. Clinical Blue → Clinical Blue Dark); every interactive element gets a 2px blue focus ring on keyboard focus.

### Chips / Badges
- **Status Badge:** a small dot + label pill (bg tint + dark-toned text) for OK / Low / Critical / No Data. The dot carries the hue; the label carries the meaning — status is never color-only, and an unrecognized status value falls back to the neutral "No Data" treatment, never to green.
- **Account Status Badge:** a plain pill (no dot) for Active / Inactive on user accounts — Active uses a soft Status Green tint, Inactive uses Paper Alt / Ink Muted. There is exactly one account-list role per screen in this app (a Super Admin's list is always District Supervisors, a District Supervisor's is always Facility Supervisors, and so on), so no role-color pill is needed here — the screen itself already tells you the role.

### Cards / Containers
- **Corner Style:** 12px (`rounded-xl`) — one step softer than buttons/inputs, marking cards as containers rather than controls.
- **Background:** Paper, on a Paper-Alt page background.
- **Shadow Strategy:** none at rest, ever. Every card in the system today (stat tiles, facility/district cards, stock-status tiles) is a static display surface, not a click target, so none of them carry the hover-lift shadow — that's reserved for the day a card actually becomes a link or button.
- **Border:** 1px Hairline, always.
- **Internal Padding:** 16–20px (`p-4`/`p-5`).

### Inputs / Fields
- **Style:** Paper background, 1px Hairline border, 8px radius, 8–12px padding.
- **Focus:** border and a 2px ring shift to Clinical Blue.
- **Error:** border and ring shift to Status Red, with a small red caption line beneath.

### Navigation
- **Sidebar:** fixed 256px width, Paper background, Hairline right border. Links are Body-weight text with an icon, 8px-radius rows; the active route gets a soft Clinical Blue wash (`primary/10`) and blue text, inactive rows are Ink-Muted with a Paper-Alt hover state.
- **Top bar:** 56px tall, Hairline bottom border, holds only the current user's role pill and email — no logo repetition, no clutter.

### Table
- **Header:** Paper-Alt background, Label typography (uppercase, tracked), no vertical borders.
- **Rows:** Hairline dividers between rows only; a Paper-Alt hover wash signals the row under the cursor without needing a border.

## 6. Do's and Don'ts

### Do:
- **Do** treat the red/amber/green/no-data quartet as sacred — it's the only saturated signal in the system besides the blue accent, it must always carry a text label alongside the color, and "no data yet" must never silently read as OK (green) or Low (amber).
- **Do** keep every laid-out surface flat with a Hairline border; reserve shadow for hover feedback and the two floating elements (Modal, Toast) that sit outside the page's own layout.
- **Do** size touch targets generously — 44×44px minimum — everywhere, not just on Facility Worker screens; row actions and icon-only close buttons are as reachable on a phone as the primary buttons are.
- **Do** write error messages that state the current true value ("Only 12 left"), not just that something failed.
- **Do** collapse the sidebar into an off-canvas drawer below the `lg` breakpoint. A permanent 256px sidebar on a phone screen is the single biggest way this system could betray the Facility Worker principle.

### Don't:
- **Don't** introduce a second accent color. One blue does all the interactive work; a second bright hue reads as a bug, not a feature.
- **Don't** add gradients, glassmorphism, playful illustration, or any decorative motion — this system explicitly rejects the consumer/marketing-app register.
- **Don't** let a static, non-clickable card carry a shadow. If it needs to look "important," give it a border or a status badge, not elevation.
- **Don't** load a custom webfont. The system font stack is a deliberate choice, not a placeholder waiting to be replaced.
- **Don't** invent a role-color badge system for account tables. Every user list in this app is already single-role by construction (a Super Admin's list is always District Supervisors, and so on) — the screen already tells you the role.
