'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ScoreRecord {
  userId: string;
  username: string;
  wins: number;
  losses: number;
  draws: number;
  score: number;
  currentStreak: number;
  maxStreak: number;
  bonusPoints: number;
  updatedAt: string;
}

export default function AdminDashboard() {
  const [scores, setScores] = useState<ScoreRecord[]>([]);
  const [filteredScores, setFilteredScores] = useState<ScoreRecord[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [sortBy, setSortBy] = useState<'score' | 'wins' | 'losses' | 'maxStreak'>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // ตรวจสอบข้อมูลสถิติคะแนนทั้งหมด
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/admin/scores');
        const data = await res.json();
        if (data.success) {
          setScores(data.scores);
          setFilteredScores(data.scores);
        }
      } catch (err) {
        console.error('Fetch scores error:', err);
      } finally {
        setLoading(false);
      }
    }

    async function checkSession() {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        if (data.loggedIn) {
          setLoggedIn(true);
        }
      } catch (e) {
        console.error(e);
      }
    }

    fetchData();
    checkSession();
  }, []);

  // ตัวคัดกรองการค้นหารายชื่อผู้เล่น
  useEffect(() => {
    const term = search.toLowerCase().trim();
    if (!term) {
      setFilteredScores(scores);
    } else {
      setFilteredScores(scores.filter(s => s.username.toLowerCase().includes(term)));
    }
  }, [search, scores]);

  // ฟังก์ชันสลับการจัดเรียงคอลัมน์
  const handleSort = (field: 'score' | 'wins' | 'losses' | 'maxStreak') => {
    let order: 'asc' | 'desc' = 'desc';
    if (sortBy === field) {
      order = sortOrder === 'desc' ? 'asc' : 'desc';
    }
    setSortBy(field);
    setSortOrder(order);

    const sorted = [...filteredScores].sort((a, b) => {
      const valA = a[field];
      const valB = b[field];
      if (order === 'desc') {
        return valB - valA;
      } else {
        return valA - valB;
      }
    });
    setFilteredScores(sorted);
  };

  if (loading) {
    return (
      <div className="container flex-center flex-column" style={{ minHeight: '80vh' }}>
        <div className="glass-panel text-center">
          <div className="input-label" style={{ fontSize: '1.2rem', animation: 'pulse 1s infinite alternate' }}>
            กำลังโหลดข้อมูลตารางคะแนน...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: '1000px' }}>
      {/* ส่วนหัว แถบนำทางกลับ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem' }}>📊 สถิติและคะแนนสะสมผู้เล่น</h1>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>เครื่องมือตรวจสอบและค้นหารายชื่อผู้เล่นในระบบทั้งหมด</p>
        </div>

        <Link href={loggedIn ? "/game" : "/"} className="btn btn-primary">
          {loggedIn ? "🎮 กลับสู่หน้าเกม" : "🏠 กลับหน้าแรก"}
        </Link>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        {/* เครื่องมือค้นหาและกรองข้อมูล */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <div className="input-group" style={{ flex: 1, margin: 0 }}>
            <input
              type="text"
              className="text-input"
              placeholder="🔍 ค้นหาตามชื่อผู้เล่น..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            พบข้อมูลผู้เล่น: <strong>{filteredScores.length}</strong> คน
          </div>
        </div>

        {/* ตารางสถิติผู้เล่น */}
        {filteredScores.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', border: '1px dashed var(--panel-border)', borderRadius: '12px' }}>
            ไม่พบรายชื่อผู้เล่นที่ค้นหาในระบบ
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>อันดับ</th>
                  <th>ผู้เล่น</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('score')}>
                    คะแนนสะสม {sortBy === 'score' ? (sortOrder === 'desc' ? '▼' : '▲') : ''}
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('wins')}>
                    ชนะ {sortBy === 'wins' ? (sortOrder === 'desc' ? '▼' : '▲') : ''}
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('losses')}>
                    แพ้ {sortBy === 'losses' ? (sortOrder === 'desc' ? '▼' : '▲') : ''}
                  </th>
                  <th>เสมอ</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('maxStreak')}>
                    ชนะรวดสูงสุด {sortBy === 'maxStreak' ? (sortOrder === 'desc' ? '▼' : '▲') : ''}
                  </th>
                  <th>โบนัสสตรีค</th>
                  <th>อัปเดตล่าสุด</th>
                </tr>
              </thead>
              <tbody>
                {filteredScores.map((record, index) => {
                  // แสดงเหรียญรางวัลสำหรับอันดับท็อป 3
                  let rankDisplay: React.ReactNode = index + 1;
                  if (index === 0) rankDisplay = '🥇';
                  else if (index === 1) rankDisplay = '🥈';
                  else if (index === 2) rankDisplay = '🥉';

                  const dateStr = new Date(record.updatedAt).toLocaleDateString('th-TH', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr key={record.userId} style={{ background: record.currentStreak > 0 ? 'rgba(0, 245, 212, 0.01)' : 'transparent' }}>
                      <td style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{rankDisplay}</td>
                      <td>
                        <div style={{ fontWeight: '600', color: 'var(--color-primary)' }}>
                          {record.username}
                        </div>
                      </td>
                      <td style={{ fontWeight: 'bold', color: 'var(--color-secondary)', fontSize: '1.1rem' }}>
                        {record.score}
                      </td>
                      <td style={{ color: 'var(--color-success)' }}>{record.wins}</td>
                      <td style={{ color: '#ff4d6d' }}>{record.losses}</td>
                      <td>{record.draws}</td>
                      <td>🔥 {record.maxStreak}</td>
                      <td style={{ color: 'var(--color-warning)' }}>✨ {record.bonusPoints}</td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{dateStr}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        * คลิกที่หัวตารางเพื่อทำการเรียงลำดับคะแนน, จำนวนครั้งชนะ, แพ้ หรือ สตรีคสูงสุดของผู้เล่นได้
      </div>
    </div>
  );
}
