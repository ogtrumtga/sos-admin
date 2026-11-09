import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, KeyRound, LoaderCircle, MapPin, Phone, ShieldCheck } from 'lucide-react';
import { api, session } from './api';
import { ErrorNotice, Logo } from './components';

export default function Login({ onLogin, notice }) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [countdown, setCountdown] = useState(0);
  useEffect(() => {
    if (!countdown) return;
    const timer = setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const requestOtp = async () => {
    const data = await api('/api/auth/request-otp', { method: 'POST', body: { phone, role: 'ADMIN' } });
    setPhone(data.phone);
    setStep('otp');
    setDevOtp(data.dev_otp || '');
    setCountdown(30);
  };
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      if (step === 'phone') await requestOtp();
      else {
        const data = await api('/api/auth/verify-otp', { method: 'POST', body: { phone, otp, role: 'ADMIN' } });
        if (data.user.role !== 'ADMIN') throw new Error('Tài khoản không có quyền quản trị.');
        session.set(data.access_token);
        try {
          const verified = await api('/api/admin/me');
          onLogin(verified.user);
        } catch (error) { session.clear(); throw error; }
      }
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  };
  const resend = async () => {
    setBusy(true); setError('');
    try { await requestOtp(); } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  };

  return <main className="login-page">
    <section className="login-story">
      <Logo light />
      <div className="login-story-copy"><span className="eyebrow">TRUNG TÂM ĐIỀU HÀNH CỨU HỘ</span><h1>Kết nối lực lượng.<br />Tiếp nối hy vọng.</h1><p>Một không gian điều phối tập trung.<br />Để mỗi tín hiệu cầu cứu đều được lắng nghe.</p></div>
      <div className="login-map-art" aria-hidden="true"><svg viewBox="0 0 560 300" fill="none"><path d="M-20 190 150 120 270 165 590 30M60-20 140 100 110 340M360-10 300 100 345 200 530 290M-20 40 180 80 300 40 590 130M-20 280 160 210 310 250 590 190" stroke="currentColor" strokeWidth="14"/><path d="M210-20 245 95 190 180 270 330M450-20 400 140 460 340M-20 130 180 155 340 130 590 240" stroke="currentColor" strokeWidth="5"/></svg><span className="art-marker marker-one"><MapPin size={23}/></span><span className="art-marker marker-two"><ShieldCheck size={22}/></span><span className="art-callout"><i/> Luôn sẵn sàng ứng cứu</span></div>
      <div className="login-story-footer"><ShieldCheck size={17}/> Hệ thống hỗ trợ cứu hộ khẩn cấp SOS</div>
    </section>
    <section className="login-form-side"><div className="login-mobile-brand"><Logo/></div><div className="login-card">
      <span className="login-lock"><ShieldCheck size={27} strokeWidth={1.6}/></span>
      <span className="eyebrow">CỔNG QUẢN TRỊ</span><h2>{step === 'phone' ? 'Chào mừng trở lại' : 'Xác minh đăng nhập'}</h2><p className="login-description">{step === 'phone' ? 'Đăng nhập bằng số điện thoại được cấp quyền quản trị.' : <>Nhập mã 6 chữ số được gửi qua Telegram liên kết với <strong>{phone}</strong>.</>}</p>
      <ErrorNotice message={error || notice}/>
      <form onSubmit={submit}>
        {step === 'phone' ? <label className="field">Số điện thoại<div className="input-with-icon"><Phone size={18}/><input autoFocus autoComplete="tel" type="tel" inputMode="tel" placeholder="090 123 4567" maxLength={20} value={phone} required onChange={(event) => setPhone(event.target.value)}/></div></label>
          : <label className="field">Mã xác minh OTP<div className="input-with-icon"><KeyRound size={18}/><input autoFocus autoComplete="one-time-code" className="otp-input" inputMode="numeric" pattern="[0-9]{6}" placeholder="000000" maxLength={6} required value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))}/></div></label>}
        {devOtp && step === 'otp' && <div className="dev-otp">Chế độ phát triển · OTP: <strong>{devOtp}</strong></div>}
        <button className="button primary login-submit" disabled={busy}>{busy ? <LoaderCircle size={18} className="spin"/> : null}{step === 'phone' ? 'Tiếp tục đăng nhập' : 'Xác minh & đăng nhập'}{!busy && <ArrowRight size={18}/>}</button>
      </form>
      {step === 'otp' && <div className="otp-actions"><button className="text-button" disabled={busy} onClick={() => { setStep('phone'); setError(''); setOtp(''); }}><ArrowLeft size={15}/> Đổi số điện thoại</button><button className="text-button" disabled={busy || countdown > 0} onClick={resend}>{countdown > 0 ? `Gửi lại sau ${countdown}s` : 'Gửi lại mã'}</button></div>}
      <div className="login-access-note"><ShieldCheck size={19}/><div><strong>Dành riêng cho quản trị viên</strong><p>Tài khoản phải là rescuer có role ADMIN và đang hoạt động.</p></div></div>
      <div className="login-secure"><Check size={14}/> Xác thực OTP · Kết nối với hệ thống cứu hộ</div>
    </div><footer className="login-footer">SOS Rescue Console <span>Quản trị & điều phối</span></footer></section>
  </main>;
}
