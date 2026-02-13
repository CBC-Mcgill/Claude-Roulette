import { useEffect, useRef } from 'react';
import { fireWinnerConfetti } from '../utils/confettiPresets';
import ClaudeLogo from './ClaudeLogo';
import './WinnerDisplay.css';

export default function WinnerDisplay({ winner, onDismiss }) {
  const confettiFiredRef = useRef(false);

  // Fire confetti once on mount
  useEffect(() => {
    if (!confettiFiredRef.current && winner) {
      confettiFiredRef.current = true;
      fireWinnerConfetti();
    }
    return () => {
      confettiFiredRef.current = false;
    };
  }, [winner]);

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
        <ClaudeLogo size={56} color="var(--color-primary)" />
        <h2 className="winner-card__heading">Congratulations!</h2>
        <p className="winner-card__name">{winner}</p>
        <button className="winner-card__btn" onClick={onDismiss}>
          Spin Again
        </button>
      </div>
    </div>
  );
}
