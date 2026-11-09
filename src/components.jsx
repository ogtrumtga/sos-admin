import { useEffect, useRef } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, LoaderCircle, Search, ShieldPlus, X } from 'lucide-react';

export const statusLabels = {
  ACTIVE: 'Hoạt động', DISABLED: 'Đã khóa', INACTIVE: 'Tạm ngưng', BUSY: 'Đang cứu hộ',
  WAITING: 'Chờ tiếp nhận', ACCEPTED: 'Đã tiếp nhận', RESCUING: 'Đang đến', ARRIVED: 'Đã đến nơi',
  COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy',
};
export const roleLabels = { ADMIN: 'Quản trị viên', LEADER: 'Trưởng đội', MEMBER: 'Đội viên', DRIVER: 'Lái xe', MEDIC: 'Nhân viên y tế' };
export const emergencyLabels = { NGAP_LUT: 'Ngập lụt', LO_DAT: 'Sạt lở', TAI_NAN: 'Tai nạn', CHAY_NO: 'Cháy nổ', MAC_KET: 'Mắc kẹt', Y_TE_KHAN_CAP: 'Y tế khẩn cấp', KHAC: 'Khẩn cấp khác' };
export const formatDate = (value) => value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—';
export const initials = (name = '') => name.split(' ').filter(Boolean).slice(-2).map((word) => word[0]).join('').toUpperCase() || 'AD';

export function Logo({ light = false }) {
  return <div className={`logo ${light ? 'logo-light' : ''}`}><span className="logo-icon"><ShieldPlus size={25} strokeWidth={1.8} /></span><div>SOS<span>RESCUE CONSOLE</span></div></div>;
}
export function Badge({ value, children }) {
  return <span className={`badge badge-${value?.toLowerCase()}`}><i />{children || statusLabels[value] || roleLabels[value] || value}</span>;
}
export function ErrorNotice({ message, retry }) {
  if (!message) return null;
  return <div className="error-notice" role="alert"><AlertCircle size={18} /><span>{message}</span>{retry && <button className="text-button" onClick={retry}>Thử lại</button>}</div>;
}
export function Loading({ label = 'Đang tải dữ liệu…' }) {
  return <div className="loading" role="status"><LoaderCircle className="spin" size={22} /><span>{label}</span></div>;
}
export function Empty({ icon: Icon = Search, title = 'Chưa có dữ liệu', description = 'Dữ liệu sẽ xuất hiện tại đây khi được thêm vào hệ thống.' }) {
  return <div className="empty"><span><Icon size={27} strokeWidth={1.5} /></span><h3>{title}</h3><p>{description}</p></div>;
}
export function SearchInput({ value, onChange, placeholder = 'Tìm theo tên, số điện thoại…' }) {
  return <div className="search-input"><Search size={18} /><input aria-label={placeholder} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />{value && <button type="button" aria-label="Xóa tìm kiếm" onClick={() => onChange('')}><X size={15} /></button>}</div>;
}
export function Pagination({ page, total, pageSize = 10, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <div className="pagination"><span>{total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)}` : 0} trên <strong>{total}</strong> kết quả</span><div><button aria-label="Trang trước" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft size={17} /></button><span>Trang {page} / {pages}</span><button aria-label="Trang sau" disabled={page >= pages} onClick={() => onChange(page + 1)}><ChevronRight size={17} /></button></div></div>;
}
export function Modal({ title, description, children, onClose, busy = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current.showModal();
    return () => { previous?.focus(); };
  }, []);
  return <dialog ref={ref} className="modal" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} onClick={(event) => { if (event.target === ref.current && !busy) onClose(); }}><div className="modal-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div><button className="icon-button" aria-label="Đóng" disabled={busy} onClick={onClose}><X size={21} /></button></div>{children}</dialog>;
}
