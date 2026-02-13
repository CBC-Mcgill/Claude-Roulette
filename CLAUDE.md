# Claude Roulette

A spinning roulette wheel that randomly picks a name from a user-provided list, with confetti celebrations and dark/light theming.

## Tech Stack

- React 18 with Vite 6
- canvas-confetti for celebrations
- Plain CSS (no preprocessors or CSS-in-JS)

## Commands

```
npm run dev       # Start dev server
npm run build     # Production build to dist/
npm run preview   # Preview production build
```

## Project Structure

```
src/
├── App.jsx              # Root component, theme management
├── main.jsx             # Entry point
├── index.css            # Global styles & CSS custom properties
├── components/
│   ├── RouletteWheel.jsx/.css   # Canvas-based spinning wheel
│   ├── NameInput.jsx/.css       # Text input for name list
│   ├── WinnerDisplay.jsx/.css   # Winner announcement + confetti
│   ├── WinnerHistory.jsx/.css   # Past winner log
│   ├── ThemeToggle.jsx/.css     # Dark/light toggle button
│   └── ClaudeLogo.jsx           # SVG logo component
├── hooks/
│   └── useRouletteState.js      # useReducer-based state (names, spinning, winner)
└── utils/
    ├── wheelMath.js             # Geometry/math helpers for the wheel
    └── confettiPresets.js       # Confetti animation configurations
public/                          # Static assets
```

## Conventions

- **Components**: PascalCase `.jsx` with co-located `.css` in `src/components/`
- **Hooks**: `use*.js` in `src/hooks/`; state managed via `useReducer`
- **Utilities**: camelCase `.js` in `src/utils/`
- **CSS**: BEM methodology; theming via CSS custom properties on `:root` / `[data-theme="dark"]`
- **React**: Functional components only; use `useCallback` for event handler optimization
- **No TypeScript** — plain JS/JSX throughout

## Theme System

- CSS custom properties defined in `src/index.css`
- Light (default) and dark themes via `[data-theme="dark"]` on `<html>`
- Persisted to `localStorage` key `claude-roulette-theme`; falls back to `prefers-color-scheme`
