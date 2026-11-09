import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { Clock3, Crosshair, MapPin, Phone, Radio, RefreshCw, SlidersHorizontal, UsersRound } from 'lucide-react';
import { useDebounce, useResource } from './hooks';
import { query } from './api';
import { Badge, Empty, ErrorNotice, Loading, SearchInput, emergencyLabels, formatDate, statusLabels } from './components';

const colors = { WAITING: '#dc5a48', ACCEPTED: '#d59b31', RESCUING: '#3b80b7', ARRIVED: '#258574' };
const hasLocation = (item) => Number.isFinite(item.lat) && Number.isFinite(item.lng);

function MapCanvas({ items, selected, onSelect, fitKey }) {
  const element = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const [tileError, setTileError] = useState(false);
  const fitted = useRef(false);
  const selectedItem = items.find((item) => item.sos_id === selected);
  const selectedLat = selectedItem?.lat;
  const selectedLng = selectedItem?.lng;
  useEffect(() => {
    map.current = L.map(element.current, { zoomControl: false }).setView([10.7769, 106.7009], 12);
    L.control.zoom({ position: 'bottomright' }).addTo(map.current);
    const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19,
    }).addTo(map.current);
    tiles.on('tileerror', () => setTileError(true));
    layer.current = L.layerGroup().addTo(map.current);
    const observer = new ResizeObserver(() => map.current?.invalidateSize());
    observer.observe(element.current);
    return () => { observer.disconnect(); map.current.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    layer.current.clearLayers();
    for (const item of items.filter(hasLocation)) {
      const color = colors[item.status] || '#607d78';
      const icon = L.divIcon({ className: 'sos-marker-wrapper', html: `<span class="sos-marker ${selected === item.sos_id ? 'selected' : ''}" style="--marker-color:${color}"><span>!</span></span>`, iconSize: [34, 42], iconAnchor: [17, 38] });
      L.marker([item.lat, item.lng], { icon, keyboard: true, title: `${emergencyLabels[item.emergency_type] || item.emergency_type} · ${item.requester_name}` })
        .on('click', () => selectRef.current(item.sos_id)).addTo(layer.current);
    }
    if (!fitted.current && items.some(hasLocation)) {
      map.current.fitBounds(items.filter(hasLocation).map((item) => [item.lat, item.lng]), { padding: [60, 60], maxZoom: 14 });
      fitted.current = true;
    }
  }, [items, selected]);
  useEffect(() => {
    if (Number.isFinite(selectedLat) && Number.isFinite(selectedLng)) map.current.flyTo([selectedLat, selectedLng], Math.max(map.current.getZoom(), 15), { duration: 0.5 });
  }, [selected, selectedLat, selectedLng]);
  useEffect(() => {
    const points = items.filter(hasLocation).map((item) => [item.lat, item.lng]);
    if (points.length) map.current.fitBounds(points, { padding: [60, 60], maxZoom: 14 });
  // Fit only when explicitly requested; polling should preserve the operator's viewport.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);
  return <><div className="map-canvas" ref={element} aria-label="Bản đồ vị trí các yêu cầu SOS"/>{tileError && <div className="tile-notice">Không tải được nền bản đồ. Kiểm tra kết nối Internet.</div>}</>;
}

export default function SosMap() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState(null);
  const [fitKey, setFitKey] = useState(0);
  const debounced = useDebounce(search);
  const { data, loading, error, refresh } = useResource(`/api/admin/sos?${query({ q: debounced, status })}`, 15000);
  const items = useMemo(() => data?.data || [], [data]);
  const selectedItem = items.find((item) => item.sos_id === selected);
  const locatedCount = items.filter(hasLocation).length;
  return <>
    <div className="page-heading"><div><div className="eyebrow">THEO DÕI & ĐIỀU PHỐI</div><h1>Bản đồ SOS <span className="live-pill"><i/> Trực tiếp</span></h1><p>Nắm bắt tín hiệu khẩn cấp. Kết nối hỗ trợ kịp thời.</p></div><button className="button secondary" onClick={refresh} disabled={loading}><RefreshCw size={16} className={loading ? 'spin' : ''}/> Làm mới</button></div>
    <ErrorNotice message={error} retry={refresh}/>
    <div className="map-workspace">
      <section className="sos-panel"><div className="sos-panel-heading"><div><Radio size={18}/><h2>Yêu cầu cứu hộ</h2><span className="count-pill">{items.length}</span></div><p>Tự động cập nhật mỗi 15 giây</p></div><div className="sos-filters"><SearchInput value={search} onChange={setSearch} placeholder="Tên, số điện thoại, sự cố…"/><div className="filter-select"><SlidersHorizontal size={16}/><select aria-label="Lọc trạng thái SOS" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Tất cả đang hoạt động</option>{Object.entries(statusLabels).filter(([key]) => ['WAITING','ACCEPTED','RESCUING','ARRIVED','COMPLETED','CANCELLED'].includes(key)).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div></div>
      <div className="sos-list">{loading ? <Loading/> : !items.length ? <Empty icon={Radio} title="Không có yêu cầu SOS" description={search || status ? 'Thử thay đổi từ khóa hoặc bộ lọc.' : 'Các tín hiệu cầu cứu mới sẽ được hiển thị tại đây.'}/> : items.map((item) => <button className={`sos-card ${selected === item.sos_id ? 'active' : ''}`} key={item.sos_id} onClick={() => setSelected(item.sos_id)}><div className="sos-card-top"><span className="sos-type-icon" style={{ color: colors[item.status] }}><Radio size={18}/></span><strong>{emergencyLabels[item.emergency_type] || item.emergency_type}</strong><span className="short-id">#{item.sos_id.slice(0, 5).toUpperCase()}</span></div><p className="sos-description">{item.description || 'Chưa có mô tả tình huống.'}</p><div className="sos-card-person"><span>{item.requester_name}</span><span>{item.requester_phone}</span></div><div className="sos-card-bottom"><Badge value={item.status}/><span><Clock3 size={12}/>{formatDate(item.created_at)}</span></div>{!hasLocation(item) && <span className="no-location">Chưa có tọa độ hiện tại</span>}</button>)}</div><div className="sos-panel-footer"><span className="status-dot"/> {locatedCount} vị trí trên bản đồ</div></section>
      <section className="map-panel"><MapCanvas items={items} selected={selected} onSelect={setSelected} fitKey={fitKey}/><div className="map-top-label"><span className="status-dot"/> BẢN ĐỒ ĐIỀU HÀNH <span>· {locatedCount} điểm SOS</span></div><button className="map-fit button secondary" onClick={() => setFitKey((value) => value + 1)} title="Hiển thị toàn bộ vị trí"><Crosshair size={17}/> Toàn bộ vị trí</button>
      {!loading && !items.length && !error && <div className="map-empty-note"><ShieldIcon/><div><strong>Đang theo dõi khu vực</strong><span>Chưa có SOS phù hợp với bộ lọc hiện tại.</span></div></div>}
      {selectedItem && <div className="map-detail"><div className="map-detail-top"><span className="eyebrow">CHI TIẾT YÊU CẦU</span><button className="text-button" onClick={() => setSelected(null)}>Đóng</button></div><h3>{emergencyLabels[selectedItem.emergency_type] || selectedItem.emergency_type}</h3><p>{selectedItem.description || 'Chưa có mô tả.'}</p><div className="detail-info"><span><Phone size={15}/><a href={`tel:${selectedItem.requester_phone}`}>{selectedItem.requester_phone}</a></span><span><UsersRound size={15}/>{selectedItem.team_name || 'Chưa có đội tiếp nhận'}</span><span><MapPin size={15}/>{hasLocation(selectedItem) ? `${selectedItem.lat.toFixed(5)}, ${selectedItem.lng.toFixed(5)}` : 'Chưa có tọa độ hiện tại'}</span></div><div className="map-detail-bottom"><Badge value={selectedItem.status}/><span>{selectedItem.visibility === 'PRIVATE' ? 'Riêng tư' : 'Công khai'}</span></div></div>}
      <div className="map-legend">{Object.entries(colors).map(([key, color]) => <span key={key}><i style={{ backgroundColor: color }}/>{statusLabels[key]}</span>)}</div></section>
    </div><div className="map-footnote"><ShieldIcon/> Tọa độ chính xác dành cho quản trị viên. Bao gồm cả SOS công khai và riêng tư.</div>
  </>;
}

function ShieldIcon() { return <MapPin size={17} strokeWidth={1.7}/>; }
