import { useState, useEffect } from 'react';
import './NameInput.css';

const MAX_NAMES_WARNING = 100;

export default function NameInput({ rawText, onTextChange, onSpin, spinning, nameCount }) {
  const [showWarning, setShowWarning] = useState(false);
  const canSpin = nameCount >= 2 && !spinning;

  useEffect(() => {
    setShowWarning(nameCount > MAX_NAMES_WARNING);
  }, [nameCount]);

  return (
    <div className="name-input">
      <label className="name-input__label" htmlFor="names-textarea">
        Enter names
        <span className="name-input__hint">Separate with commas or new lines</span>
      </label>
      <textarea
        id="names-textarea"
        className="name-input__textarea"
        value={rawText}
        onChange={(e) => onTextChange(e.target.value)}
        disabled={spinning}
        placeholder="Alice, Bob, Charlie..."
        rows={8}
      />
      {showWarning && (
        <p className="name-input__warning">
          {nameCount} names entered — the wheel may look crowded.
        </p>
      )}
      <button
        className="name-input__spin-btn"
        onClick={onSpin}
        disabled={!canSpin}
      >
        {spinning ? 'Spinning...' : 'Spin!'}
      </button>
    </div>
  );
}
