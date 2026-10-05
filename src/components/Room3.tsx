import { useState, useEffect, useRef } from 'react';
import './Room3.css';

type Room3Props = {
  initialScore?: number
  onRoomComplete?: (details: { score: number; hintsUsed: number }) => void
}

export const Room3 = ({ initialScore = 750, onRoomComplete }: Room3Props) => {
  const [activeModal, setActiveModal] = useState<string | null>(null);
  
  // Computer Sub-screens State
  const [computerScreen, setComputerScreen] = useState<'menu' | 'riddle' | 'logs'>('menu');

  // Game States
  const [timeLeft, setTimeLeft] = useState<number>(120);
  const [score, setScore] = useState<number>(initialScore);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [isAlarmActive, setIsAlarmActive] = useState<boolean>(false);
  const [hasKeycard, setHasKeycard] = useState<boolean>(false);
  const [completionSent, setCompletionSent] = useState<boolean>(false);
  const [safeInput, setSafeInput] = useState<string>('');
  const [safeUnlocked, setSafeUnlocked] = useState<boolean>(false);
  const [doorUnlocked, setDoorUnlocked] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string>('');
  const completionNotifiedRef = useRef(false);

  const CORRECT_SAFE_CODE = '7392';

  // Timer Effect
  useEffect(() => {
    setScore(initialScore);
  }, [initialScore]);

  useEffect(() => {
    if (doorUnlocked) return;
    if (timeLeft <= 0) {
      setIsGameOver(true);
      setIsAlarmActive(true);
      return;
    }
    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, doorUnlocked]);

  useEffect(() => {
    if (!doorUnlocked || completionSent || completionNotifiedRef.current) return;
    completionNotifiedRef.current = true;
    const finalScore = Math.max(initialScore, score + timeLeft * 5 + (safeUnlocked ? 300 : 0));
    setCompletionSent(true);
    onRoomComplete?.({ score: finalScore, hintsUsed: 0 });
  }, [completionSent, doorUnlocked, initialScore, onRoomComplete, safeUnlocked, score, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleNumpadPress = (num: string) => {
    if (safeInput.length < 4) setSafeInput((prev) => prev + num);
  };

  const handleClear = () => {
    setSafeInput('');
    setFeedbackMsg('');
  };

  const handleSubmitSafeCode = () => {
    if (safeInput === CORRECT_SAFE_CODE) {
      setSafeUnlocked(true);
      setHasKeycard(true);
      setFeedbackMsg('ACCESS GRANTED! Security Keycard collected 💳');
    } else {
      setFeedbackMsg('WRONG CODE! Alarm Triggered 🚨');
      setIsAlarmActive(true);
      setSafeInput('');
    }
  };

  return (
    <div className="room3-page-container">
      <div className={`room3-game-canvas ${isAlarmActive ? 'alarm-active' : ''}`}>
        
        {/* Header Bar */}
        <div className="game-header">
          <div className="timer-box">⏰ TIME: {formatTime(timeLeft)}</div>
          <div className="inventory-box">🎒 INVENTORY: {hasKeycard ? '💳 Security Keycard' : 'Empty'} · SCORE {score.toLocaleString()}</div>
        </div>

        {/* 🚪 Door Opening Animated Light Overlay */}
        <div className={`door-open-overlay ${doorUnlocked ? 'is-open' : ''}`} />

        {/* Hotspots */}
        <button
          className="hotspot-btn hotspot-computer"
          onClick={() => {
            setActiveModal('computer');
            setComputerScreen('menu');
            setFeedbackMsg('');
          }}
          title="Inspect Terminal"
        />

        <button
          className="hotspot-btn hotspot-safe"
          onClick={() => {
            setActiveModal('safe');
            setFeedbackMsg('');
          }}
          title="Inspect Safe"
        />

        <button
          className="hotspot-btn hotspot-door"
          onClick={() => {
            setActiveModal('door');
            setFeedbackMsg('');
          }}
          title="Inspect Exit Door"
        />

        {/* Game Over Modal */}
        {isGameOver && (
          <div className="room3-modal-overlay alarm-border">
            <h3 style={{ color: '#ef4444' }}>🚨 SYSTEM LOCKDOWN!</h3>
            <p>Time expired! The security alarm sealed all exits permanently.</p>
            <button className="room3-modal-close-btn" style={{ backgroundColor: '#ef4444' }} onClick={() => window.location.reload()}>
              🔄 Retry Mission
            </button>
          </div>
        )}

        {/* 1. Computer Modal */}
        {activeModal === 'computer' && !isGameOver && (
          <div className="room3-modal-overlay">
            <h3>🖥️ Workstation OS v3.4</h3>
            
            {computerScreen === 'menu' && (
              <div>
                <p>Select a system file to analyze:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '15px 0' }}>
                  <button 
                    className="keypad-btn" 
                    onClick={() => setComputerScreen('riddle')}
                    style={{ textAlign: 'left', padding: '12px 16px' }}
                  >
                    📁 Encrypted_Passcode.txt
                  </button>
                  <button 
                    className="keypad-btn" 
                    onClick={() => setComputerScreen('logs')}
                    style={{ textAlign: 'left', padding: '12px 16px' }}
                  >
                    📄 System_Security_Logs.log
                  </button>
                </div>
              </div>
            )}

            {computerScreen === 'riddle' && (
              <div>
                <p>Decoding Encrypted File...</p>
                <div style={{
                  background: '#0d1117',
                  color: '#38bdf8',
                  padding: '12px',
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  textAlign: 'left',
                  marginBottom: '15px',
                  lineHeight: '1.6'
                }}>
                  &gt; CLUE MATRIX (4-Digit Passcode):<br/>
                  &gt; Digit 1: Number of desk screens + 4<br/>
                  &gt; Digit 2: The largest prime number before 5<br/>
                  &gt; Digit 3: Result of (9 ÷ 3) x 3<br/>
                  &gt; Digit 4: Square root of 4 (√4)
                </div>
                <button 
                  className="room3-modal-close-btn" 
                  style={{ marginRight: '10px', backgroundColor: '#7000ff' }} 
                  onClick={() => setComputerScreen('menu')}
                >
                  ⬅ Back to Menu
                </button>
              </div>
            )}

            {computerScreen === 'logs' && (
              <div>
                <p>System Security Log History:</p>
                <div style={{
                  background: '#0d1117',
                  color: '#a7f3d0',
                  padding: '12px',
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  textAlign: 'left',
                  marginBottom: '15px',
                  lineHeight: '1.5'
                }}>
                  [14:02] Security breach detected.<br/>
                  [14:05] Vault Safe auto-locked.<br/>
                  [14:10] Security Keycard moved inside Heavy Vault.
                </div>
                <button 
                  className="room3-modal-close-btn" 
                  style={{ marginRight: '10px', backgroundColor: '#7000ff' }} 
                  onClick={() => setComputerScreen('menu')}
                >
                  ⬅ Back to Menu
                </button>
              </div>
            )}

            <button className="room3-modal-close-btn" onClick={() => setActiveModal(null)}>
              Close
            </button>
          </div>
        )}

        {/* 2. Safe Modal */}
        {activeModal === 'safe' && !isGameOver && (
          <div className="room3-modal-overlay">
            <h3>🔒 Heavy Vault Safe</h3>
            {!safeUnlocked ? (
              <>
                <p>Enter 4-digit vault passcode:</p>
                <div className="keypad-container">
                  <div className="keypad-display">{safeInput.padEnd(4, '_')}</div>
                  <div className="keypad-grid">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                      <button key={num} className="keypad-btn" onClick={() => handleNumpadPress(num)}>
                        {num}
                      </button>
                    ))}
                    <button className="keypad-btn" style={{ background: '#881337' }} onClick={handleClear}>C</button>
                    <button className="keypad-btn" onClick={() => handleNumpadPress('0')}>0</button>
                    <button className="keypad-btn" style={{ background: '#16a34a' }} onClick={handleSubmitSafeCode}>✓</button>
                  </div>
                </div>
              </>
            ) : (
              <p style={{ color: '#4ade80', fontWeight: 'bold' }}>
                🔓 Vault Opened! Security Keycard collected.
              </p>
            )}
            
            {feedbackMsg && (
              <p style={{ color: safeUnlocked ? '#4ade80' : '#f87171', fontSize: '0.85rem' }}>
                {feedbackMsg}
              </p>
            )}

            <button className="room3-modal-close-btn" onClick={() => setActiveModal(null)}>
              Close
            </button>
          </div>
        )}

        {/* 3. Door Modal */}
        {activeModal === 'door' && !isGameOver && (
          <div className="room3-modal-overlay">
            <h3>🚪 Blast Exit Door</h3>
            {doorUnlocked ? (
              <div>
                <p style={{ color: '#4ade80', fontSize: '1.2rem', fontWeight: 'bold' }}>🎉 MISSION ACCOMPLISHED!</p>
                <p>You bypassed the security systems and escaped Room 3!</p>
              </div>
            ) : (
              <div>
                <p>The electronic lock requires level-4 access clearance.</p>
                {hasKeycard ? (
                  <button
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#16a34a',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      boxShadow: '0 0 15px rgba(34, 197, 94, 0.4)',
                      marginTop: '10px'
                    }}
                    onClick={() => {
                      setDoorUnlocked(true);
                      setIsAlarmActive(false);
                      setScore((current) => current + 500 + timeLeft);
                    }}
                  >
                    💳 Swipe Security Keycard
                  </button>
                ) : (
                  <p style={{ color: '#f87171', fontSize: '0.85rem', marginTop: '10px' }}>
                    🔒 Access Denied! Security Keycard is required.
                  </p>
                )}
              </div>
            )}
            <br />
            <button className="room3-modal-close-btn" onClick={() => setActiveModal(null)}>
              Close
            </button>
          </div>
        )}

      </div>
    </div>
  );
};