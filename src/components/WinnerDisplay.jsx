import { useEffect, useRef } from 'react';
import { fireWinnerConfetti } from '../utils/confettiPresets';
import ClaudeLogo from './ClaudeLogo';
import './WinnerDisplay.css';

export default function WinnerDisplay({ winner, onDismiss }) {
  const confettiFiredRef = useRef(false);

  const noWinner = winner === '__NO_WINNER__';

  // Fire confetti once on mount (only for actual winners)
  useEffect(() => {
    if (!confettiFiredRef.current && winner && !noWinner) {
      confettiFiredRef.current = true;
      fireWinnerConfetti();
    }
    return () => {
      confettiFiredRef.current = false;
    };
  }, [winner, noWinner]);

  // Escape key dismiss
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onDismiss();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  if (!winner) return null;

  return (
    <div className="winner-overlay" onClick={onDismiss}>
      <div className="winner-card" onClick={(e) => e.stopPropagation()}>
        <ClaudeLogo size={56} color={noWinner ? 'var(--color-text-muted)' : 'var(--color-primary)'} />
        <h2 className="winner-card__heading">{noWinner ? 'No Winner' : 'Congratulations!'}</h2>
        <p className="winner-card__name">{noWinner ? 'The ball landed on an empty pocket.' : winner}</p>
        <button className="winner-card__btn" onClick={onDismiss}>
          Spin Again
        </button>
      </div>
    </div>
  );
}
