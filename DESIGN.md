# DESIGN.md — December Design System & Visual Guidelines

## Surface Classification

- **Primary Surface**: Product UI (Developer Platform, Repository Documentation Viewer, Interactive Code Editor & AI Chat)
- **Secondary Surface**: Developer CLI & Terminal UI (`tui`)

---

## Design Philosophy

**December** follows a modern, dark-mode developer aesthetic ("VS Code / Linear meets Modern AI Workspace"). The UI prioritizes high information density, sharp contrast, clear visual hierarchy, and non-distracting subtle animations.

---

## Color System & Tokens

### Base Color Palette

- **Background (`--color-background`)**: `#141414` (Warm Dark Grey)
- **Sidebar & Panels (`--color-sidebar`)**: `#191919` (Deep Charcoal)
- **Surface & Cards (`--color-surface`)**: `#252423` (Elevated Surface)
- **Surface Hover (`--color-surface-hover`)**: `#2f2e2d`
- **Borders & Dividers (`--color-border`)**: `#333333`
- **Text Main (`--color-text-main`)**: `#e8e8e6` (Off-white for warm dark contrast)
- **Text Muted (`--color-text-muted`)**: `#a09f9d`
- **Code Selection (`::selection`)**: `rgba(38, 79, 120, 0.85)` (Steel Blue)

### Status & State Colors

- **Success / Completed**: Emerald (`#10b981`)
- **Warning / Generating**: Amber (`#f59e0b`)
- **Error / Failed**: Rose (`#f43f5e`)
- **Active / Accent**: Pure White (`#ffffff`) or Cyan/Violet subtle AI highlights

---

## Typography System

- **Primary UI Sans**: `'Inter'`, `system-ui`, `-apple-system`, `sans-serif`
- **Display Headings**: `'FK Grotesk'`, `'Inter'`, `sans-serif`
- **Code & Terminal Monospace**: `'JetBrains Mono'`, `'Fira Code'`, `ui-monospace`, `monospace`

---

## Component & Layout Standards

1. **Navigation Sidebar (`#191919`)**:
    - Compact, expandable tree hierarchy for repository pages and documentation modules.
    - Zero focus-outline ring flickers on button click (`outline: none !important`).

2. **Reading Pane & Main Canvas**:
    - Clean markdown rendering with dot pattern background (`.dot-pattern`).
    - Distinct code block formatting with CodeMirror integration and syntax highlights.

3. **WikiChat AI Panel**:
    - Embedded or sliding drawer for grounded codebase prompts.
    - Instant response rendering with subtle popover/fade animations.

4. **Interactive Controls**:
    - Custom scrollbars (`8px`, background `#333333`, hover `#4b4b4b`).
    - Seamless input focus transitions without browser default blue rings.

---

## Anti-Patterns ("AI Slop" to Avoid)

- ❌ **No Loud Neon Gradients**: Avoid aggressive purple-to-pink background gradients.
- ❌ **No Low-Contrast Text**: Never use faint gray body text on dark backgrounds; ensure WCAG AA readability (`#e8e8e6` on `#141414`).
- ❌ **No Excessively Padded Cards**: Keep UI compact and density-appropriate for developers.
- ❌ **No Focus Ring Flickers**: Prevent unwanted browser outline artifacts on dark action buttons.
- ❌ **No Generic Dropshadows**: Rely on crisp 1px borders (`#333333`) over heavy ambient shadows.
