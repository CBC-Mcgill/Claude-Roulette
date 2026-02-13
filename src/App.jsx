import { useState, useEffect, useCallback } from 'react';
import ClaudeLogo from './components/ClaudeLogo';
import ThemeToggle from './components/ThemeToggle';
import RouletteWheel from './components/RouletteWheel';
import NameInput from './components/NameInput';
import WinnerDisplay from './components/WinnerDisplay';
import WinnerHistory from './components/WinnerHistory';
import useRouletteState from './hooks/useRouletteState';

function getInitialTheme() {
  const stored = localStorage.getItem('claude-roulette-theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function App() {
  const { state, setText, startSpin, spinComplete, dismissWinner } = useRouletteState();
  const { rawText, names, spinning, winner, history } = state;

  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('claude-roulette-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  }, []);

  return (
    <div className="app">
      <header className="app__header">
        <ClaudeLogo size={36} color="var(--color-primary)" />
        <h1 className="app__title">Claude Roulette</h1>
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </header>

      <aside className="app__sidebar">
        <NameInput
          rawText={rawText}
          onTextChange={setText}
          onSpin={startSpin}
          spinning={spinning}
          nameCount={names.length}
        />
        <WinnerHistory history={history} />
      </aside>

      <main className="app__main">
        <RouletteWheel
          names={names}
          spinning={spinning}
          onSpinEnd={spinComplete}
          onSpin={startSpin}
          theme={theme}
        />
      </main>

      <WinnerDisplay winner={winner} onDismiss={dismissWinner} />
    </div>
  );
}
