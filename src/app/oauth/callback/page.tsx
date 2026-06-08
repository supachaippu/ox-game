'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

function CallbackForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [status, setStatus] = useState('กำลังยืนยันความปลอดภัยและเชื่อมต่อเซสชัน...');
  const [error, setError] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    
    // ดึงค่า state ดั้งเดิมที่ฝั่ง client บันทึกไว้มาตรวจสอบป้องกัน CSRF
    const savedState = sessionStorage.getItem('oauth_state');

    if (!code) {
      setError('ไม่พบ Authorization Code ในพารามิเตอร์การติดต่อกลับ');
      return;
    }

    if (state !== savedState) {
      setError('ข้อผิดพลาดด้านความปลอดภัย: ค่า State ไม่ตรงกับที่ส่งไป (อาจเกิดการปลอมแปลงคำขอ)');
      return;
    }

    async function exchangeTokenAndLogin() {
      try {
        const res = await fetch('/api/auth/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'ไม่สามารถสร้างเซสชันเชื่อมต่อระบบได้');
        }

        // ล้างค่า state ออกจากหน่วยความจำ
        sessionStorage.removeItem('oauth_state');
        
        setStatus('เข้าสู่ระบบสำเร็จ! กำลังพาไปหน้าเกม...');
        
        // พาเข้าหน้าเกม
        setTimeout(() => {
          router.push('/game');
        }, 1000);
      } catch (err: any) {
        console.error('Callback login error:', err);
        setError(err.message || 'เกิดข้อผิดพลาดระหว่างแลกเปลี่ยนรหัสโทเคน');
      }
    }

    exchangeTokenAndLogin();
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="glass-panel text-center" style={{ maxWidth: '480px', width: '100%' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>⚠️</div>
        <h2 style={{ color: 'var(--color-danger)', marginBottom: '1rem' }}>ล็อกอินไม่สำเร็จ</h2>
        <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>{error}</p>
        <Link href="/" className="btn btn-primary" style={{ width: '100%' }}>
          กลับไปหน้าแรกเพื่อลองอีกครั้ง
        </Link>
      </div>
    );
  }

  return (
    <div className="glass-panel text-center" style={{ maxWidth: '450px', width: '100%' }}>
      <div className="floating-icon" style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>
        🔑
      </div>
      <h2>กำลังตรวจสอบความถูกต้อง</h2>
      <p style={{ marginTop: '1rem', animation: 'pulse 1s infinite alternate' }}>
        {status}
      </p>
    </div>
  );
}

export default function OAuthCallback() {
  return (
    <div className="container flex-center flex-column" style={{ minHeight: '90vh' }}>
      <Suspense fallback={
        <div className="glass-panel text-center">
          <div className="input-label" style={{ fontSize: '1.2rem', animation: 'pulse 1s infinite alternate' }}>
            กำลังรับข้อมูลติดต่อกลับ...
          </div>
        </div>
      }>
        <CallbackForm />
      </Suspense>
    </div>
  );
}
