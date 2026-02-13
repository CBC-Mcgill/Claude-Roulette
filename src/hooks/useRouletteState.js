import { useReducer, useCallback } from 'react';

const DEFAULT_TEXT = 'Entry 1, Entry 2, Entry 3, Entry 4, Entry 5, Entry 6';

function parseNames(text) {
  if (!text || !text.trim()) return [];
  // Split by commas or newlines
  return text
    .split(/[,\n]+/)
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

const initialState = {
  rawText: DEFAULT_TEXT,
  names: parseNames(DEFAULT_TEXT),
  spinning: false,
  winner: null,
  history: [],
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_TEXT': {
      const names = parseNames(action.payload);
      return { ...state, rawText: action.payload, names };
    }
    case 'START_SPIN': {
      if (state.names.length < 2) return state;
      return { ...state, spinning: true, winner: null };
    }
    case 'SPIN_COMPLETE': {
      const index = action.payload;
      if (index < 0 || index >= state.names.length) return { ...state, spinning: false };
      const winnerName = state.names[index];
      return {
        ...state,
        spinning: false,
        winner: winnerName,
        history: [
          { spin: state.history.length + 1, name: winnerName },
          ...state.history,
        ],
      };
    }
    case 'DISMISS_WINNER': {
      return { ...state, winner: null };
    }
    default:
      return state;
  }
}

export default function useRouletteState() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setText = useCallback((text) => dispatch({ type: 'SET_TEXT', payload: text }), []);
  const startSpin = useCallback(() => dispatch({ type: 'START_SPIN' }), []);
  const spinComplete = useCallback((index) => dispatch({ type: 'SPIN_COMPLETE', payload: index }), []);
  const dismissWinner = useCallback(() => dispatch({ type: 'DISMISS_WINNER' }), []);

  return { state, setText, startSpin, spinComplete, dismissWinner };
}
