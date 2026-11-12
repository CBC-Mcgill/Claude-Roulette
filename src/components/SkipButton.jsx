import './SoundToggle.css'; // shares the .sound-toggle button styling
import './SkipButton.css';

export default function SkipButton({ onSkip }) {
  return (
    <button
      className="sound-toggle skip-button"
      onClick={onSkip}
      aria-label="Speed up spin"
      title="Speed up spin"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 19 22 12 13 5 13 19" />
        <polygon points="2 19 11 12 2 5 2 19" />
      </svg>
    </button>
  );
}
