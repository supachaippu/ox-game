'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { WinResult, checkWinner, findBestMove } from '@/lib/game-utils';

export default function Game() {
  const router = useRouter();

  // สถานะผู้เล่นและเซสชัน
  const [username, setUsername] = useState('');
  const [scoreRecord, setScoreRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // สถานะของเกม
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [lastBotStrategy, setLastBotStrategy] = useState<string>('รอกลยุทธ์ตาเดินถัดไป');
  const [gameResult, setGameResult] = useState<WinResult | null>(null);
  const [isBotThinking, setIsBotThinking] = useState(false);

  // ตรวจสอบเซสชันผู้ใช้งาน
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        if (!data.loggedIn) {
          router.push('/');
        } else {
          setUsername(data.user.username);
          setScoreRecord(data.score);
        }
      } catch (err) {
        console.error('Check session error:', err);
        router.push('/');
      } finally {
        setLoading(false);
      }
    }
    checkSession();
  }, [router]);

  // ฟังก์ชันสังเคราะห์เสียงซาวด์เอฟเฟกต์แบบออฟไลน์
  const playSound = (type: 'move-x' | 'move-o' | 'win' | 'lose' | 'draw') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'move-x') {
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === 'move-o') {
        osc.frequency.setValueAtTime(392.00, ctx.currentTime); // G4
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === 'win') {
        // อาร์เพจจิโอเสียงสว่างสดใส (C5 -> E5 -> G5 -> C6)
        const now = ctx.currentTime;
        const freqs = [523.25, 659.25, 783.99, 1046.50];
        gain.gain.setValueAtTime(0.15, now);
        freqs.forEach((f, i) => {
          osc.frequency.setValueAtTime(f, now + i * 0.1);
        });
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start();
        osc.stop(now + 0.5);
      } else if (type === 'lose') {
        // เสียงโทนเศร้าไล่ระดับลง
        const now = ctx.currentTime;
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220.00, now);
        osc.frequency.linearRampToValueAtTime(110.00, now + 0.4);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start();
        osc.stop(now + 0.4);
      } else if (type === 'draw') {
        osc.frequency.setValueAtTime(330.00, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch (e) {
      console.warn('AudioContext failed:', e);
    }
  };

  // ตาเดินของบอท AI
  useEffect(() => {
    if (!isPlayerTurn && !gameResult && !loading) {
      setIsBotThinking(true);
      const timer = setTimeout(() => {
        let botMoveIndex = -1;

        // สุ่มเลือกระดับความยากของการเดินรอบนี้
        const roll = Math.random();
        let selectedDiff: 'easy' | 'medium' | 'hard';
        let strategyText = '';

        if (roll < 0.50) {
          selectedDiff = 'easy'; // 50% โอกาสเดินสุ่ม
          strategyText = 'ระดับง่าย 🎲 (สุ่มตำแหน่งเดิน)';
        } else if (roll < 0.80) {
          selectedDiff = 'medium'; // 30% โอกาสเดินป้องกัน/บล็อก
          strategyText = 'ระดับปานกลาง 🛡️ (ป้องกันและเน้นบล็อกหมาก)';
        } else {
          selectedDiff = 'hard'; // 20% โอกาสเดินแบบไร้พ่ายด้วย Minimax AI
          strategyText = 'ระดับยากสุด 🧠 (ใช้สมองกลคำนวณแบบไร้พ่าย Minimax)';
        }
        setLastBotStrategy(strategyText);

        if (selectedDiff === 'easy') {
          // สุ่มตำแหน่ง
          const emptyCells = board.map((c, i) => c === null ? i : null).filter(v => v !== null) as number[];
          botMoveIndex = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        } else if (selectedDiff === 'medium') {
          // ลอจิกปานกลาง: ชนะได้ทำ บล็อกได้บล็อก นอกนั้นสุ่ม
          const emptyCells = board.map((c, i) => c === null ? i : null).filter(v => v !== null) as number[];
          
          // 1. ตรวจสอบว่าสามารถกดชนะได้เลยไหม
          for (const cell of emptyCells) {
            const tempBoard = [...board];
            tempBoard[cell] = 'O';
            if (checkWinner(tempBoard)?.winner === 'O') {
              botMoveIndex = cell;
              break;
            }
          }

          // 2. ถ้าไม่ได้ ให้ตรวจสอบว่าคู่แข่งกำลังจะชนะไหมเพื่อบล็อก
          if (botMoveIndex === -1) {
            for (const cell of emptyCells) {
              const tempBoard = [...board];
              tempBoard[cell] = 'X';
              if (checkWinner(tempBoard)?.winner === 'X') {
                botMoveIndex = cell;
                break;
              }
            }
          }

          // 3. ถ้าไม่มีข้อไหนเข้าสิทธิ์ ให้สุ่ม
          if (botMoveIndex === -1) {
            botMoveIndex = emptyCells[Math.floor(Math.random() * emptyCells.length)];
          }
        } else {
          // ลอจิกระดับยาก (Hard) - ใช้ Minimax 
          botMoveIndex = findBestMove(board);
        }

        if (botMoveIndex !== -1) {
          const newBoard = [...board];
          newBoard[botMoveIndex] = 'O';
          setBoard(newBoard);
          playSound('move-o');

          const result = checkWinner(newBoard);
          if (result) {
            setGameResult(result);
            handleMatchEnd(result.winner);
          } else {
            setIsPlayerTurn(true);
          }
        }
        setIsBotThinking(false);
      }, 500); // ดีเลย์บอทคิด 500ms ให้ความรู้สึกสมจริง

      return () => clearTimeout(timer);
    }
  }, [isPlayerTurn, board, gameResult, loading]);

  // จัดการเมื่อผลการเล่นจบแมทช์
  const handleMatchEnd = async (winner: string) => {
    let resultKey: 'win' | 'loss' | 'draw' = 'draw';
    if (winner === 'X') {
      resultKey = 'win';
      playSound('win');
    } else if (winner === 'O') {
      resultKey = 'loss';
      playSound('lose');
    } else {
      playSound('draw');
    }

    try {
      const res = await fetch('/api/game/score', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ result: resultKey }),
      });
      const data = await res.json();
      if (res.ok) {
        setScoreRecord(data.record);
      }
    } catch (e) {
      console.error('Error saving score:', e);
    }
  };

  // ผู้เล่นคลิกเดินหมาก
  const handleCellClick = (index: number) => {
    if (board[index] !== null || !isPlayerTurn || gameResult || isBotThinking) return;

    const newBoard = [...board];
    newBoard[index] = 'X';
    setBoard(newBoard);
    playSound('move-x');

    const result = checkWinner(newBoard);
    if (result) {
      setGameResult(result);
      handleMatchEnd(result.winner);
    } else {
      setIsPlayerTurn(false);
    }
  };

  // รีเซ็ตเพื่อเริ่มเกมใหม่
  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setIsPlayerTurn(true);
    setGameResult(null);
  };

  // ออกจากระบบ
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/session', { method: 'DELETE' });
      router.push('/');
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  if (loading) {
    return (
      <div className="container flex-center flex-column" style={{ minHeight: '80vh' }}>
        <div className="glass-panel text-center">
          <div className="input-label" style={{ fontSize: '1.2rem', animation: 'pulse 1s infinite alternate' }}>
            กำลังเชื่อมต่อเซสชัน...
          </div>
        </div>
      </div>
    );
  }

  // คำนวณความคืบหน้าของ Win Streak (คะแนนพิเศษชนะ 3 ครั้งติดต่อกัน)
  const streakCount = scoreRecord?.currentStreak || 0;

  return (
    <div className="container" style={{ maxWidth: '900px' }}>
      {/* Header แถบควบคุมข้อมูลผู้ใช้ */}
      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem', padding: '1rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '2rem' }}>🎮</span>
          <div>
            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>ผู้เล่น: <span style={{ color: 'var(--color-primary)' }}>{username}</span></h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>เข้าสู่ระบบด้วย OAuth 2.0</div>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link href="/admin" className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>
            📊 ตารางคะแนนรวม
          </Link>
          <button className="btn btn-danger" onClick={handleLogout} style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>
            🚪 ออกจากระบบ
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
        {/* แผงข้อมูลคะแนนและผู้เล่น */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div className="glass-panel text-center" style={{ padding: '1.25rem' }}>
            <div className="input-label">คะแนนรวมสะสม</div>
            <div style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--color-secondary)', textShadow: '0 0 10px rgba(0,245,212,0.3)', margin: '0.5rem 0' }}>
              {scoreRecord?.score ?? 0}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              ชนะ: {scoreRecord?.wins ?? 0} | แพ้: {scoreRecord?.losses ?? 0} | เสมอ: {scoreRecord?.draws ?? 0}
            </div>
          </div>

          <div className="glass-panel text-center" style={{ padding: '1.25rem' }}>
            <div className="input-label">โบนัสสตรีค (ชนะ 3 นัดติด)</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, margin: '1rem 0' }}>
              {/* สัญลักษณ์ไฟโชว์จำนวนครั้งที่ชนะติดต่อกัน */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', fontSize: '1.75rem' }}>
                <span style={{ opacity: streakCount >= 1 ? 1 : 0.2, filter: streakCount >= 1 ? 'drop-shadow(0 0 5px rgba(255,183,3,0.8))' : 'none' }}>🔥</span>
                <span style={{ opacity: streakCount >= 2 ? 1 : 0.2, filter: streakCount >= 2 ? 'drop-shadow(0 0 5px rgba(255,183,3,0.8))' : 'none' }}>🔥</span>
                <span style={{ opacity: streakCount >= 3 ? 1 : 0.2, filter: streakCount >= 3 ? 'drop-shadow(0 0 5px rgba(255,183,3,0.8))' : 'none' }}>🔥</span>
              </div>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {streakCount === 0 ? 'ชนะอีก 3 ครั้งเพื่อรับโบนัส +1 คะแนน!' : `ชนะอีก ${3 - streakCount} ครั้งเพื่อรับแต้มโบนัส!`}
            </div>
          </div>
        </div>

        {/* แผงหน้าจอการเล่นเกมหลัก */}
        <div className="glass-panel flex-center flex-column" style={{ position: 'relative' }}>


          {/* สถานะตาเดินของเกม */}
          <div style={{ height: '30px', margin: '0.5rem 0' }}>
            {gameResult ? (
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: gameResult.winner === 'X' ? 'var(--color-secondary)' : gameResult.winner === 'O' ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                {gameResult.winner === 'X' ? '🎉 คุณชนะบอทสำเร็จ! (+1 คะแนน)' : gameResult.winner === 'O' ? '💀 คุณแพ้บอท! (-1 คะแนน)' : '🤝 เสมอกัน!'}
              </div>
            ) : (
              <div style={{ color: isPlayerTurn ? 'var(--color-primary)' : 'var(--text-secondary)', fontSize: '1.1rem', fontWeight: 600 }}>
                {isPlayerTurn ? '👈 ตาของคุณแล้ว (เลือกตำแหน่ง X)' : isBotThinking ? '🤖 บอทกำลังคำนวณหมาก (O)...' : '🤖 บอทกำลังคิดหมาก (O)...'}
              </div>
            )}
          </div>

          {/* ตารางเกม 3x3 */}
          <div className="game-grid">
            {board.map((cell, index) => {
              const isWinning = gameResult?.line?.includes(index);
              return (
                <div
                  key={index}
                  className={`game-cell ${cell === 'X' ? 'cell-x' : cell === 'O' ? 'cell-o' : ''} ${isWinning ? 'winning-cell' : ''}`}
                  onClick={() => handleCellClick(index)}
                >
                  {cell}
                </div>
              );
            })}
          </div>

          {/* ปุ่มเริ่มใหม่ */}
          <button className="btn btn-primary" onClick={resetGame} style={{ marginTop: '1rem', width: '100%', maxWidth: '340px' }}>
            🔄 {gameResult ? 'เริ่มเล่นเกมใหม่' : 'เริ่มเกมใหม่ทั้งหมด'}
          </button>

        </div>
      </div>
    </div>
  );
}
