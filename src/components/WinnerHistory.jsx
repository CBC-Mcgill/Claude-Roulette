import './WinnerHistory.css';

export default function WinnerHistory({ history }) {
  return (
    <div className="winner-history">
      <h3 className="winner-history__title">Past Winners</h3>
      {history.length === 0 ? (
        <p className="winner-history__empty">No winners yet — give it a spin!</p>
      ) : (
        <ul className="winner-history__list">
          {history.map((entry, idx) => (
            <li key={`${entry.spin}-${idx}`} className="winner-history__item">
              <span className="winner-history__number">#{entry.spin}</span>
              <span className="winner-history__name">{entry.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
