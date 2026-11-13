import './WheelControl.css';

export default function SkipButton({ onSkip, isSkipping }) {
  const label = isSkipping ? 'Spin sped up' : 'Speed up spin';
  return (
    <button
      className={`wheel-control${isSkipping ? ' wheel-control--active' : ''}`}
      onClick={onSkip}
      aria-pressed={isSkipping}
      aria-label={label}
      title={label}
    >
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 19 22 12 13 5 13 19" />
        <polygon points="2 19 11 12 2 5 2 19" />
      </svg>
    </button>
  );
}
