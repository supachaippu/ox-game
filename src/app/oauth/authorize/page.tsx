'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function AuthorizeForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // ดึงพารามิเตอร์ OAuth 2.0 มาจาก URL Query
  const clientId = searchParams.get('client_id') || '';
  const redirectUri = searchParams.get('redirect_uri') || '';
  const state = searchParams.get('state') || '';
  const scope = searchParams.get('scope') || '';
  const responseType = searchParams.get('response_type') || '';

  // ตรวจสอบค่าพารามิเตอร์ที่จำเป็น
  useEffect(() => {
    if (!clientId || !redirectUri) {
      setError('ข้อผิดพลาด OAuth: พารามิเตอร์ client_id หรือ redirect_uri หายไป');
    }
    if (responseType !== 'code') {
      setError('ข้อผิดพลาด OAuth: ไม่รองรับ response_type อื่นนอกจาก "code"');
    }
  }, [clientId, redirectUri, responseType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('กรุณาระบุชื่อผู้ใช้งาน');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/oauth/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          client_id: clientId,
          redirect_uri: redirectUri,
          state,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'การยืนยันตัวตนล้มเหลว');
      }

      // นำทางผู้เล่นกลับไปยัง callback พร้อมแนบ authorization code
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        throw new Error('ไม่พบข้อมูล Redirect URL');
      }
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // กลับไปยังหน้าหลัก
    router.push('/');
  };

  return (
    <div className="glass-panel" style={{ maxWidth: '500px', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Mock OAuth 2.0 Service
        </h2>
        <span style={{ background: 'rgba(0, 210, 255, 0.1)', color: 'var(--color-primary)', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
          Local Auth
        </span>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '0.25rem' }}>
          แอปพลิเคชัน <span style={{ color: 'var(--color-secondary)' }}>OX Tic-Tac-Toe</span> ขอสิทธิ์เข้าถึง:
        </p>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--panel-border)', borderRadius: '8px', padding: '0.75rem', marginTop: '0.5rem' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            👤 <strong>ข้อมูลโปรไฟล์ผู้ใช้งาน (Profile):</strong> ชื่อผู้ใช้งานและคะแนนสะสมของคุณ
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(255, 0, 127, 0.1)', border: '1px solid var(--color-danger)', color: '#ff4d6d', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label className="input-label" htmlFor="username">ระบุชื่อผู้ใช้งานเพื่อล็อกอิน</label>
          <input
            type="text"
            id="username"
            className="text-input"
            placeholder="เช่น Player1, 9Arm"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading || !!error}
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ flex: 1 }}
            onClick={handleCancel}
            disabled={loading}
          >
            ยกเลิก
          </button>
          
          <button
            type="submit"
            className="btn btn-primary"
            style={{ flex: 2 }}
            disabled={loading || !!error}
          >
            {loading ? 'กำลังดำเนินรายการ...' : 'ให้สิทธิ์และเริ่มเล่นเกม'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function Authorize() {
  return (
    <div className="container flex-center flex-column" style={{ minHeight: '90vh' }}>
      <Suspense fallback={
        <div className="glass-panel text-center">
          <div className="input-label" style={{ fontSize: '1.2rem', animation: 'pulse 1s infinite alternate' }}>
            กำลังโหลดหน้าการยืนยันตัวตน...
          </div>
        </div>
      }>
        <AuthorizeForm />
      </Suspense>
    </div>
  );
}
