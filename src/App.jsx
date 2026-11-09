import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, CheckCircle2, ChevronRight, CircleHelp, LayoutDashboard, LogOut, Map, Menu, Radio, ShieldCheck, Users, UsersRound, X } from 'lucide-react';
import { api, session } from './api';
import { useResource } from './hooks';
import { ErrorNotice, Loading, Logo, initials } from './components';
import Login from './Login';
import Management from './Management';
import SosMap from './SosMap';

const nav = [
  { key: 'sos', label: 'Bản đồ SOS', icon: Map },
  { key: 'rescuers', label: 'Quản lý rescuer', icon: ShieldCheck },
  { key: 'teams', label: 'Đội cứu hộ', icon: UsersRound },
  { key: 'users', label: 'Người dùng', icon: Users },
];
const pageFromHash = () => nav.some((item) => item.key === location.hash.slice(1)) ? location.hash.slice(1) : 'sos';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!session.get());
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const logout = useCallback((message = '') => { session.clear(); setUser(null); setLoading(false); setError(''); setNotice(message); }, []);
  const bootstrap = useCallback(async () => {
    if (!session.get()) return;
    setLoading(true); setError('');
    try { const data = await api('/api/admin/me'); setUser(data.user); }
    catch (error) { if ([401, 403].includes(error.status)) logout(error.message); else setError(error.message); }
    finally { setLoading(false); }
  }, [logout]);
  useEffect(() => { bootstrap(); }, [bootstrap]);
  useEffect(() => {
    const listener = (event) => logout(event.detail);
    window.addEventListener('session-expired', listener);
    return () => window.removeEventListener('session-expired', listener);
  }, [logout]);
  if (loading) return <main className="bootstrap"><Logo/><Loading label="Đang xác thực quyền quản trị…"/></main>;
  if (error && session.get()) return <main className="bootstrap"><Logo/><ErrorNotice message={error} retry={bootstrap}/><button className="button secondary" onClick={() => logout()}>Về trang đăng nhập</button></main>;
  if (!user) return <Login notice={notice} onLogin={(user) => { setUser(user); setNotice(''); }}/>;
  return <Console user={user} onLogout={() => logout()}/>;
}

function Console({ user, onLogout }) {
  const [page, setPage] = useState(pageFromHash);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [help, setHelp] = useState(false);
  const { data, error, refresh } = useResource('/api/admin/overview', 15000);
  const stats = data?.data;
  useEffect(() => {
    const listener = () => { setPage(pageFromHash()); setMobileOpen(false); };
    window.addEventListener('hashchange', listener);
    return () => window.removeEventListener('hashchange', listener);
  }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4000); return () => clearTimeout(timer); }, [toast]);
  const current = nav.find((item) => item.key === page);
  const statCards = [
    { label: 'SOS đang hoạt động', value: stats?.active_sos, sub: stats ? `${stats.waiting_sos} yêu cầu chờ tiếp nhận` : 'Đang cập nhật', icon: Radio, color: 'coral', target: 'sos' },
    { label: 'Lực lượng cứu hộ', value: stats?.rescuers, sub: 'Rescuer trong hệ thống', icon: ShieldCheck, color: 'green', target: 'rescuers' },
    { label: 'Đội cứu hộ', value: stats?.teams, sub: stats ? `${stats.available_teams} đội sẵn sàng ứng cứu` : 'Đang cập nhật', icon: UsersRound, color: 'blue', target: 'teams' },
    { label: 'Người dùng', value: stats?.users, sub: 'Tài khoản trong hệ thống', icon: Users, color: 'ochre', target: 'users' },
  ];
  return <div className="app-shell">
    {mobileOpen && <button className="sidebar-overlay" aria-label="Đóng menu" onClick={() => setMobileOpen(false)}/>}
    <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}><div className="sidebar-brand"><Logo/><button className="icon-button mobile-close" aria-label="Đóng menu" onClick={() => setMobileOpen(false)}><X size={21}/></button></div><div className="workspace-label"><span className="workspace-icon"><LayoutDashboard size={17}/></span><div>Trung tâm điều hành<span>Không gian quản trị</span></div><span className="workspace-dot"/></div><span className="nav-caption">QUẢN LÝ HỆ THỐNG</span><nav aria-label="Điều hướng chính">{nav.map(({ key, label, icon: Icon }) => <a href={`#${key}`} className={page === key ? 'active' : ''} aria-current={page === key ? 'page' : undefined} key={key} onClick={() => setMobileOpen(false)}><Icon size={19}/><span>{label}</span>{key === 'sos' && stats?.waiting_sos > 0 && <span className="nav-count">{stats.waiting_sos}</span>}{page === key && <ChevronRight className="nav-chevron" size={15}/>}</a>)}</nav><div className="sidebar-bottom"><div className="sidebar-help"><span><ShieldCheck size={22}/></span><strong>Mỗi giây đều quan trọng.</strong><p>Cùng giữ kết nối,<br/>sẵn sàng khi cần.</p><div><i/> Đồng hành cùng cộng đồng</div></div><div className="sidebar-account"><span className="avatar">{initials(user.full_name)}</span><div><strong>{user.full_name}</strong><span>Quản trị viên</span></div><button className="icon-button" onClick={onLogout} aria-label="Đăng xuất" title="Đăng xuất"><LogOut size={17}/></button></div></div></aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="Mở menu" onClick={() => setMobileOpen(true)}><Menu size={22}/></button><span>Không gian quản trị</span><ChevronRight size={14}/><strong>{current.label}</strong></div><div className="topbar-right"><span className="admin-access"><ShieldCheck size={15}/> Quyền ADMIN</span><span className="topbar-divider"/><button className="icon-button" aria-label="Hướng dẫn sử dụng" onClick={() => setHelp(!help)}><CircleHelp size={19}/></button><span className="avatar small">{initials(user.full_name)}</span></div></header>
    {help && <div className="help-banner"><div><strong>Hướng dẫn nhanh</strong><p>Bản đồ tự làm mới sau 15 giây. Chọn một SOS để xem vị trí và liên hệ. Dùng các mục quản lý để thêm, sửa, xóa tài khoản và đội cứu hộ. Tài khoản bị khóa hoặc bị thu hồi ADMIN sẽ mất quyền truy cập.</p></div><button className="icon-button" aria-label="Đóng hướng dẫn" onClick={() => setHelp(false)}><X size={18}/></button></div>}
    <main className="main-content"><div className="overview-strip"><span><i/> TỔNG QUAN HỆ THỐNG</span><span className="overview-date">Dữ liệu từ hệ thống SOS</span></div><div className="stat-grid">{statCards.map(({ label, value, sub, icon: Icon, color, target }) => <a href={`#${target}`} className="stat-card" key={label}><div><span className="stat-label">{label}</span><strong>{value == null ? '—' : new Intl.NumberFormat('vi-VN').format(value)}</strong><span className="stat-sub">{sub}</span></div><span className={`stat-icon ${color}`}><Icon size={22} strokeWidth={1.7}/></span><ArrowUpRight className="stat-arrow" size={15}/></a>)}</div><ErrorNotice message={error} retry={refresh}/>
    {page === 'sos' ? <SosMap/> : <Management key={page} kind={page} onChanged={refresh} notify={setToast}/>}<footer className="app-footer"><span>SOS Rescue Console <i/> Trung tâm điều hành cứu hộ</span><span>Chung tay vì một cộng đồng an toàn.</span></footer></main></div>
    {toast && <div className="toast" role="status"><CheckCircle2 size={19}/>{toast}<button aria-label="Đóng thông báo" onClick={() => setToast('')}><X size={16}/></button></div>}
  </div>;
}
