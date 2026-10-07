import { useState, useEffect, useRef } from 'react';
import './RoomFive.css';
import roomFiveImage from '../images/room5-bg.png';

type RoomFiveProps = {
  initialScore?: number
  onRoomComplete?: (details: { score: number; hintsUsed: number }) => void
  onEnterFinalRoom?: () => void
  onBackHome?: () => void
}

type Item = {
  id: string;
  name: string;
  digit: string;
  found: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const RoomFive = ({ initialScore = 750, onRoomComplete, onEnterFinalRoom, onBackHome }: RoomFiveProps) => {
  const [timeLeft, setTimeLeft] = useState<number>(120);
  const [score, setScore] = useState<number>(initialScore);
  const [completionSent, setCompletionSent] = useState<boolean>(false);
  const [doorUnlocked, setDoorUnlocked] = useState<boolean>(false);
  const [enteredCode, setEnteredCode] = useState<string>('');
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const completionNotifiedRef = useRef(false);

  const [items, setItems] = useState<Item[]>([
    { id: 'item1', name: 'Globe', digit: '4', found: false, x: 13.5, y: 48, width: 5.8, height: 16.5 },
    { id: 'item2', name: 'Wall Clock', digit: '8', found: false, x: 17.5, y: 7.5, width: 7.5, height: 23 },
    { id: 'item3', name: 'Brass Lamp', digit: '2', found: false, x: 79.5, y: 35, width: 6, height: 19 },
    { id: 'item4', name: 'Mysterious Skull', digit: '9', found: false, x: 91.5, y: 0.5, width: 7.5, height: 13.5 },
  ]);

  const correctCode = items.map(i => i.digit).join('');
  const allFound = items.every(i => i.found);
  const isGameOver = timeLeft <= 0;

  useEffect(() => {
    if (doorUnlocked || isGameOver) return;
    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, doorUnlocked, isGameOver]);

  useEffect(() => {
    if (!doorUnlocked || completionSent || completionNotifiedRef.current) return;
    completionNotifiedRef.current = true;
    const finalScore = Math.max(initialScore, score + timeLeft * 5);
    setCompletionSent(true);
    onRoomComplete?.({ score: finalScore, hintsUsed: 0 });
  }, [completionSent, doorUnlocked, initialScore, onRoomComplete, score, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleItemClick = (id: string) => {
    setItems(prev =>
      prev.map(item => (item.id === id ? { ...item, found: true } : item))
    );
  };

  const handleNumpadPress = (num: string) => {
    if (enteredCode.length < 4) setEnteredCode(prev => prev + num);
  };

  const handleClear = () => {
    setEnteredCode('');
  };

  const handleSubmitCode = () => {
    if (!allFound) return;
    if (enteredCode === correctCode) {
      setDoorUnlocked(true);
      setScore(current => current + 500 + timeLeft);
    } else {
      alert('Incorrect code! Make sure to enter the digits in order.');
      setEnteredCode('');
    }
  };

  return (
    <div className="room5-page-container">
      <div 
        className={`room5-game-canvas ${isGameOver ? 'alarm-active' : ''}`}
        style={{ backgroundImage: `url(${roomFiveImage})` }}
      >
        <button className="room5-home-link" type="button" onClick={onBackHome}>
          ← ALL ROOMS
        </button>

        <div className="game-header">
          <div className="inventory-box">ROOM 04 · THE MYSTERIOUS STUDY</div>
          <div className="timer-box">⏰ TIME: {formatTime(timeLeft)}</div>
          <div className="inventory-box">
            🔍 ITEMS: {items.filter(i => i.found).length}/4 · SCORE {score.toLocaleString()}
          </div>
        </div>

        {items.map(item => (
          !item.found && (
            <button
              key={item.id}
              className="hotspot-btn"
              style={{ left: `${item.x}%`, top: `${item.y}%`, width: `${item.width}%`, height: `${item.height}%` }}
              onClick={() => handleItemClick(item.id)}
              title={item.name}
            />
          )
        ))}

        <button
          className="hotspot-btn hotspot-door-r5"
          onClick={() => setActiveModal('door')}
          title="Inspect Door Lock"
        />

        <div className="room5-bottom-bar">
          {items.map((item, index) => (
            <div key={item.id} className={`bottom-slot ${item.found ? 'found' : ''}`}>
              <span>#{index + 1} {item.name}</span>
              <strong>{item.found ? `Digit: ${item.digit}` : 'Locked 🔒'}</strong>
            </div>
          ))}
        </div>

        {activeModal === 'door' && !isGameOver && (
          <div className="room5-modal-overlay">
            <h3>🚪 Main Door Lock</h3>
            {!doorUnlocked ? (
              <div>
                <p>Enter the 4 item digits in the order shown below:</p>
                <div className="keypad-display">{enteredCode.padEnd(4, '_')}</div>
                <div className="keypad-grid">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                    <button key={num} className="keypad-btn" onClick={() => handleNumpadPress(num)}>
                      {num}
                    </button>
                  ))}
                  <button className="keypad-btn" style={{ background: '#881337' }} onClick={handleClear}>C</button>
                  <button className="keypad-btn" onClick={() => handleNumpadPress('0')}>0</button>
                  <button className="keypad-btn" style={{ background: '#16a34a' }} onClick={handleSubmitCode} disabled={!allFound}>✓</button>
                </div>
                {!allFound && (
                  <p style={{ color: '#f87171', fontSize: '0.8rem', marginTop: '10px' }}>
                    ⚠️ You must find all 4 items in the room first!
                  </p>
                )}
              </div>
            ) : (
              <div>
                <p style={{ color: '#4ade80', fontSize: '1.2rem', fontWeight: 'bold' }}>🎉 Door unlocked successfully!</p>
                <button
                  className="room5-modal-close-btn"
                  style={{ background: '#16a34a', marginTop: '15px' }}
                  onClick={onEnterFinalRoom}
                >
                  Complete Escape →
                </button>
              </div>
            )}
            <button className="room5-modal-close-btn" onClick={() => setActiveModal(null)}>
              Close
            </button>
          </div>
        )}

      </div>
    </div>
  );
};