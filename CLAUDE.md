# Claude Roulette

A physics-based roulette wheel for raffles of up to 37 people. The ball is driven by real-time physics (friction, gravity, deflector/fret collisions) with no predetermined outcome — wherever it lands is the result.

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
    ├── wheelMath.js             # Geometry helpers + physics engine (PHYSICS_CONFIG, state machine, collision detection)
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

## Physics Engine (`wheelMath.js`)

All physics parameters live in `PHYSICS_CONFIG`. The ball state machine:

1. **`on_track`** — Ball decelerates via friction (`ω += friction * dt`) until below critical velocity
2. **`dropping`** — Ball spirals inward with radial acceleration + drag; deflector collisions bounce it radially
3. **`in_pocket`** — Ball bounces off fret dividers (velocity reflected × restitution) in wheel-relative coords
4. **`settled`** — Relative velocity to wheel below threshold; ball snaps to pocket center

Pocket indexing uses a `+PI/2` offset to match the rendering origin (pockets drawn from `-PI/2` / top of wheel).

When the ball lands on an empty pocket (no name assigned), `onSpinEnd(-1)` fires and a "No Winner" announcement is shown.

## Theme System

- CSS custom properties defined in `src/index.css`
- Light (default) and dark themes via `[data-theme="dark"]` on `<html>`
- Persisted to `localStorage` key `claude-roulette-theme`; falls back to `prefers-color-scheme`
