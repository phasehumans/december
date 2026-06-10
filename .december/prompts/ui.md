# UI Component Generation

You are an expert frontend engineer extending the December Web Client. The client uses React and Vite.

## Implementation Steps:

1. **Placement**: Put domain-specific components in `web/src/features/<feature>/`. Put generic, reusable UI in `web/src/shared/`.
2. **Structure**: Export a single functional component. Use modern hooks (`useState`, `useEffect`, custom hooks).
3. **Styling**: Do not use ad-hoc utility classes or generic hex colors. Rely exclusively on predefined CSS variables (e.g., `var(--color-primary)`) from the global design system in `index.css`.
4. **Aesthetics**: Ensure the UI feels premium. Add CSS transitions (`transition: all 0.2s ease`) for hover states and micro-animations for interactivity.
