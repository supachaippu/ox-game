'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState('');

  const [authState, setAuthState] = useState<{ useGitHub: boolean; clientId: string } | null>(null);

  // ตรวจสอบเซสชันการเข้าสู่ระบบปัจจุบัน
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        if (data.loggedIn) {
          setLoggedIn(true);
          setUsername(data.user.username);
          // ดีดตัวไปหน้าเกมทันทีถ้าล็อกอินแล้ว
          router.push('/game');
        }
      } catch (err) {
        console.error('Check session error:', err);
      } finally {
        setLoading(false);
      }
    }

    async function fetchConfig() {
      try {
        const res = await fetch('/api/auth/config');
        const data = await res.json();
        setAuthState(data);
      } catch (err) {
        console.error('Fetch auth config error:', err);
      }
    }

    checkSession();
    fetchConfig();
  }, [router]);

  // ฟังก์ชันเริ่มกระบวนการ OAuth 2.0 Authorization Code Flow
  const handleLogin = () => {
    const useGitHub = authState?.useGitHub ?? false;
    const clientId = authState?.clientId ?? 'ox-game-client';
    const redirectUri = `${window.location.origin}/oauth/callback`;
    const state = Math.random().toString(36).substring(2, 15);
    const scope = useGitHub ? 'read:user' : 'profile';

    // บันทึก state ไว้ใน Session Storage เพื่อนำไปตรวจสอบใน Callback
    sessionStorage.setItem('oauth_state', state);

    let authUrl = '';
    if (useGitHub) {
      // พาผู้ใช้งานไปยังหน้าเว็บล็อกอินจริงของ GitHub
      authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}`;
    } else {
      // พาผู้ใช้งานไปยังหน้า Consent Page จำลองของ OAuth Server ในเครื่อง
      authUrl = `/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}`;
    }
    router.push(authUrl);
  };

  if (loading) {
    return (
      <div className="container flex-center flex-column" style={{ minHeight: '80vh' }}>
        <div className="glass-panel text-center">
          <div className="input-label" style={{ fontSize: '1.2rem', animation: 'pulse 1s infinite alternate' }}>
            กำลังโหลดระบบ...
          </div>
        </div>
      </div>
    );
  }

  const isGitHubMode = authState?.useGitHub ?? false;

  return (
    <div className="container flex-center flex-column" style={{ minHeight: '90vh' }}>
      <div className="glass-panel text-center" style={{ maxWidth: '450px', width: '100%', textAlign: 'center' }}>
        {/* โลโก้เกมลอยได้ */}
        <div className="floating-icon" style={{ fontSize: '5rem', marginBottom: '1rem', display: 'inline-block' }}>
          ❌⭕
        </div>
        
        <h1 style={{ marginBottom: '1rem' }}>OX Tic-Tac-Toe</h1>
        <p style={{ marginBottom: '2rem' }}>
          ท้าทายความสามารถของคุณกับบอท AI สุดแกร่ง สะสมคะแนนไต่เต้าลีดเดอร์บอร์ด และพิชิตโบนัสชนะ 3 ครั้งติดต่อกัน!
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button className="btn btn-primary" onClick={handleLogin}>
            {isGitHubMode ? '🐱 เข้าสู่ระบบด้วย GitHub OAuth' : '⚡ เข้าสู่ระบบเพื่อเริ่มเล่น (Demo Mode)'}
          </button>
          
          <Link href="/admin" className="btn btn-secondary">
            📊 ดูอันดับคะแนนผู้เล่นทั้งหมด
          </Link>
        </div>

        <div style={{ marginTop: '2rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {isGitHubMode ? (
            <span style={{ color: 'var(--color-secondary)' }}>● กำลังใช้ระบบความปลอดภัยเชื่อมต่อกับ GitHub OAuth จริง</span>
          ) : (
            <span>⚡ โหมดสาธิต: ยืนยันตัวตนจำลองภายในตัวแอป (ตั้งค่า .env เพื่อเปิดใช้ GitHub OAuth จริง)</span>
          )}
        </div>
      </div>
    </div>
  );
}
