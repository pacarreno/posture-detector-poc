import { useState } from 'react';
import './App.css';
import PosturaDetector from './PosturaDetector';
import BreathingCoach from './breathing/BreathingCoach';

const views = [
  { key: 'postura', label: 'Postura' },
  { key: 'respiracion', label: 'Respiración' },
];

function App() {
  const [view, setView] = useState('postura');

  return (
    <div className="App">
      <nav className="App-nav">
        {views.map((v) => (
          <button
            key={v.key}
            className={v.key === view ? 'active' : ''}
            aria-pressed={v.key === view}
            onClick={() => setView(v.key)}
          >
            {v.label}
          </button>
        ))}
      </nav>
      {view === 'postura' ? <PosturaDetector /> : <BreathingCoach />}
    </div>
  );
}

export default App;
