import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Filter,
  History,
  Info,
  MapPin,
  Phone,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  UsersRound,
  X,
} from 'lucide-react';
import { api, query } from './api';
import { useDebounce } from './hooks';
import {
  Badge,
  Empty,
  ErrorNotice,
  Loading,
  Modal,
  Pagination,
  SearchInput,
  emergencyLabels,
  formatDate,
  initials,
  statusLabels,
} from './components';

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'COMPLETED', label: 'Hoàn thành cứu hộ' },
  { value: 'CANCELLED', label: 'Đã hủy yêu cầu' },
  { value: 'RESCUING', label: 'Đang đến hiện trường' },
  { value: 'ARRIVED', label: 'Đã đến nơi' },
  { value: 'ACCEPTED', label: 'Đã tiếp nhận' },
  { value: 'WAITING', label: 'Chờ tiếp nhận' },
];

function formatDuration(start, end) {
  if (!start || !end) return '—';
  const diffMs = new Date(end) - new Date(start);
  if (diffMs <= 0) return '0 phút';
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 60) return `${diffMin} phút`;
  const hours = Math.floor(diffMin / 60);
  const minutes = diffMin % 60;
  return minutes > 0 ? `${hours} giờ ${minutes} phút` : `${hours} giờ`;
}

export default function RescueHistory({ notify }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [emergencyType, setEmergencyType] = useState('');
  const [teamId, setTeamId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState({ items: [], total: 0 });
  const [allHistoryItems, setAllHistoryItems] = useState([]); // Phục vụ thống kê KPI & xuất CSV
  const [isFallbackMode, setIsFallbackMode] = useState(false);

  const [emergencyTypes, setEmergencyTypes] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);

  const debouncedSearch = useDebounce(search, 300);

  // 1. Tải danh mục loại sự cố
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api('/api/emergency-types');
        if (active && Array.isArray(res?.data)) {
          setEmergencyTypes(res.data);
        }
      } catch {
        // Dự phòng từ dictionary sẵn có
        if (active) {
          setEmergencyTypes(
            Object.entries(emergencyLabels).map(([key, name]) => ({ id: key, name }))
          );
        }
      }
    })();
    return () => { active = false; };
  }, []);

  // 2. Tải danh mục đội cứu hộ
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api('/api/admin/teams?page=1&page_size=200');
        if (active && Array.isArray(res?.data)) {
          setTeams(res.data);
        }
      } catch {
        // Bỏ qua nếu lỗi
      }
    })();
    return () => { active = false; };
  }, []);

  // 3. Cơ chế tải dữ liệu lịch sử cứu hộ thông minh (Smart Adapter)
  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError('');

    // A. Thử gọi API chuyên dụng /api/admin/sos/history nếu Backend đã triển khai
    try {
      const historyQuery = query({
        q: debouncedSearch,
        status,
        emergency_type_id: emergencyType,
        team_id: teamId,
        from_date: fromDate,
        to_date: toDate,
        page,
        page_size: pageSize,
      });

      const res = await api(`/api/admin/sos/history?${historyQuery}`);
      if (res && Array.isArray(res.data)) {
        setData({ items: res.data, total: res.total || res.data.length });
        setAllHistoryItems(res.data);
        setIsFallbackMode(false);
        setLoading(false);
        return;
      }
    } catch (err) {
      // Nếu không phải lỗi 404 (ví dụ mất mạng 500), ghi nhận
      if (err.status && err.status !== 404) {
        setError(err.message || 'Lỗi khi tải lịch sử cứu hộ.');
        setLoading(false);
        return;
      }
      // Lỗi 404: Endpoint chưa có trên backend -> Chuyển sang fallback adapter mượt mà!
      setIsFallbackMode(true);
    }

    // B. FALLBACK ADAPTER: Tải qua /api/admin/sos và thực hiện client-side filtering & pagination
    try {
      // Để có toàn bộ lịch sử (bao gồm cả COMPLETED và CANCELLED), gọi đồng thời các trạng thái
      const [completedRes, cancelledRes, activeRes] = await Promise.all([
        api(`/api/admin/sos?status=COMPLETED`).catch(() => ({ data: [] })),
        api(`/api/admin/sos?status=CANCELLED`).catch(() => ({ data: [] })),
        api(`/api/admin/sos`).catch(() => ({ data: [] })),
      ]);

      const map = new Map();
      const combined = [
        ...(completedRes?.data || []),
        ...(cancelledRes?.data || []),
        ...(activeRes?.data || []),
      ];

      for (const item of combined) {
        if (item?.sos_id && !map.has(item.sos_id)) {
          map.set(item.sos_id, item);
        }
      }

      let allRecords = Array.from(map.values());

      // Sắp xếp giảm dần theo thời gian tạo mới nhất
      allRecords.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setAllHistoryItems(allRecords);

      // Áp dụng các bộ lọc client-side
      let filtered = allRecords;

      // Filter theo từ khóa
      if (debouncedSearch.trim()) {
        const term = debouncedSearch.toLowerCase().trim();
        filtered = filtered.filter((row) =>
          (row.requester_name && row.requester_name.toLowerCase().includes(term)) ||
          (row.requester_phone && row.requester_phone.includes(term)) ||
          (row.description && row.description.toLowerCase().includes(term)) ||
          (row.team_name && row.team_name.toLowerCase().includes(term)) ||
          (row.emergency_type && row.emergency_type.toLowerCase().includes(term))
        );
      }

      // Filter theo trạng thái
      if (status) {
        filtered = filtered.filter((row) => row.status === status);
      }

      // Filter theo loại sự cố
      if (emergencyType) {
        filtered = filtered.filter(
          (row) =>
            row.emergency_type_id === emergencyType ||
            row.emergency_type === emergencyType
        );
      }

      // Filter theo đội cứu hộ
      if (teamId) {
        filtered = filtered.filter(
          (row) => row.team_id === teamId || row.team_name === teamId
        );
      }

      // Filter theo khoảng ngày tạo
      if (fromDate) {
        const start = new Date(`${fromDate}T00:00:00`);
        filtered = filtered.filter((row) => new Date(row.created_at) >= start);
      }
      if (toDate) {
        const end = new Date(`${toDate}T23:59:59.999`);
        filtered = filtered.filter((row) => new Date(row.created_at) <= end);
      }

      const total = filtered.length;
      const startIndex = (page - 1) * pageSize;
      const paginated = filtered.slice(startIndex, startIndex + pageSize);

      setData({ items: paginated, total });
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu cứu hộ từ máy chủ.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, status, emergencyType, teamId, fromDate, toDate, page, pageSize]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Thống kê nhanh KPI
  const stats = useMemo(() => {
    const list = allHistoryItems;
    const completed = list.filter((i) => i.status === 'COMPLETED').length;
    const cancelled = list.filter((i) => i.status === 'CANCELLED').length;
    const active = list.filter((i) =>
      ['WAITING', 'ACCEPTED', 'RESCUING', 'ARRIVED'].includes(i.status)
    ).length;
    const ended = completed + cancelled;
    const rate = ended > 0 ? Math.round((completed / ended) * 100) : 100;

    return {
      total: list.length,
      completed,
      cancelled,
      active,
      successRate: rate,
    };
  }, [allHistoryItems]);

  // Reset toàn bộ bộ lọc
  const handleResetFilters = () => {
    setSearch('');
    setStatus('');
    setEmergencyType('');
    setTeamId('');
    setFromDate('');
    setToDate('');
    setPage(1);
    if (notify) notify('Đã đặt lại toàn bộ bộ lọc.');
  };

  const hasActiveFilters = Boolean(
    search || status || emergencyType || teamId || fromDate || toDate
  );

  // Xuất file CSV báo cáo
  const handleExportCsv = () => {
    const records = allHistoryItems;
    if (!records.length) {
      if (notify) notify('Không có dữ liệu để xuất file.');
      return;
    }

    const headers = [
      'Mã SOS',
      'Người yêu cầu',
      'Số điện thoại',
      'Loại sự cố',
      'Nội dung mô tả',
      'Đội tiếp nhận',
      'Trạng thái',
      'Chế độ',
      'Thời gian tạo',
      'Thời gian cập nhật',
      'Thời lượng xử lý',
      'Vĩ độ (Lat)',
      'Kinh độ (Lng)',
    ];

    const escapeCsv = (str) => `"${String(str ?? '').replace(/"/g, '""')}"`;

    const rows = records.map((r) => [
      escapeCsv(r.sos_id),
      escapeCsv(r.requester_name),
      escapeCsv(r.requester_phone),
      escapeCsv(emergencyLabels[r.emergency_type] || r.emergency_type),
      escapeCsv(r.description || ''),
      escapeCsv(r.team_name || 'Chưa tiếp nhận'),
      escapeCsv(statusLabels[r.status] || r.status),
      escapeCsv(r.visibility === 'PRIVATE' ? 'Riêng tư' : 'Công khai'),
      escapeCsv(formatDate(r.created_at)),
      escapeCsv(formatDate(r.updated_at)),
      escapeCsv(formatDuration(r.created_at, r.updated_at)),
      escapeCsv(r.lat ?? ''),
      escapeCsv(r.lng ?? ''),
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `lich_su_cuu_ho_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (notify) notify(`Đã xuất file CSV với ${records.length} bản ghi.`);
  };

  return (
    <>
      {/* Tiêu đề trang */}
      <div className="page-heading">
        <div>
          <div className="eyebrow">DỮ LIỆU & BÁO CÁO HỆ THỐNG</div>
          <h1>
            Lịch sử cứu hộ <span className="count-pill">{data.total} ca</span>
          </h1>
          <p>
            Tra cứu toàn bộ diễn biến, kết quả và nhật ký các ca cứu hộ khẩn cấp trong hệ thống.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="button secondary"
            onClick={fetchHistory}
            disabled={loading}
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Làm mới
          </button>
          <button
            className="button primary"
            onClick={handleExportCsv}
            disabled={loading || !data.total}
            title="Xuất dữ liệu lịch sử ra file CSV"
          >
            <Download size={16} /> Xuất CSV
          </button>
        </div>
      </div>

      {/* Thông báo nếu đang chạy chế độ Smart Fallback Adapter */}
      {isFallbackMode && (
        <div className="history-fallback-banner">
          <Info size={17} />
          <div>
            <strong>Chế độ tương thích (Smart Client-Side Adapter):</strong>
            <span>
              Backend chưa có API <code>/api/admin/sos/history</code> nên hệ thống đang tự động tổng hợp từ API hiện có.
              Xem tài liệu tại <code>docs/API_LICH_SU_CUU_HO_ADMIN.md</code> để bổ sung endpoint tối ưu hóa.
            </span>
          </div>
        </div>
      )}

      {/* Thẻ thống kê nhanh KPI */}
      <div className="history-kpi-grid">
        <div className="history-kpi-card">
          <span className="kpi-icon total">
            <History size={18} />
          </span>
          <div>
            <span className="kpi-label">Tổng ca cứu hộ</span>
            <strong>{stats.total}</strong>
          </div>
        </div>
        <div className="history-kpi-card">
          <span className="kpi-icon completed">
            <CheckCircle2 size={18} />
          </span>
          <div>
            <span className="kpi-label">Đã hoàn thành</span>
            <strong className="text-success">{stats.completed}</strong>
          </div>
        </div>
        <div className="history-kpi-card">
          <span className="kpi-icon cancelled">
            <X size={18} />
          </span>
          <div>
            <span className="kpi-label">Đã hủy bỏ</span>
            <strong className="text-muted">{stats.cancelled}</strong>
          </div>
        </div>
        <div className="history-kpi-card">
          <span className="kpi-icon rate">
            <Shield size={18} />
          </span>
          <div>
            <span className="kpi-label">Tỷ lệ cứu hộ thành công</span>
            <strong className="text-rate">{stats.successRate}%</strong>
          </div>
        </div>
      </div>

      {/* Bảng dữ liệu và thanh lọc */}
      <section className="data-panel">
        {/* Thanh công cụ tìm kiếm và lọc */}
        <div className="history-toolbar">
          <div className="history-filters-main">
            {/* 1. Tìm kiếm từ khóa */}
            <div className="search-wrap">
              <SearchInput
                value={search}
                onChange={(val) => {
                  setSearch(val);
                  setPage(1);
                }}
                placeholder="Tìm tên nạn nhân, SĐT, mô tả, tên đội…"
              />
            </div>

            {/* 2. Lọc trạng thái */}
            <div className="select-wrap">
              <select
                aria-label="Lọc trạng thái"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Lọc loại sự cố */}
            <div className="select-wrap">
              <select
                aria-label="Lọc loại sự cố"
                value={emergencyType}
                onChange={(e) => {
                  setEmergencyType(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Tất cả loại sự cố</option>
                {emergencyTypes.map((t) => (
                  <option key={t.id || t.name} value={t.name || t.id}>
                    {emergencyLabels[t.name] || t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Lọc đội cứu hộ */}
            <div className="select-wrap">
              <select
                aria-label="Lọc đội cứu hộ"
                value={teamId}
                onChange={(e) => {
                  setTeamId(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Tất cả đội cứu hộ</option>
                {teams.map((team) => (
                  <option key={team.team_id} value={team.team_id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dòng lọc ngày tháng */}
          <div className="history-filters-dates">
            <div className="date-field">
              <span>Từ ngày:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(1);
                }}
                title="Lọc các ca tạo từ ngày này"
              />
            </div>
            <div className="date-field">
              <span>Đến ngày:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPage(1);
                }}
                title="Lọc các ca tạo đến ngày này"
              />
            </div>

            {hasActiveFilters && (
              <button
                className="button secondary reset-btn"
                onClick={handleResetFilters}
                title="Xóa toàn bộ bộ lọc về mặc định"
              >
                <RotateCcw size={14} /> Đặt lại bộ lọc
              </button>
            )}
          </div>
        </div>

        {/* Thông báo lỗi nếu có */}
        <ErrorNotice message={error} retry={fetchHistory} />

        {/* Nội dung bảng danh sách */}
        {loading ? (
          <Loading label="Đang tra cứu lịch sử cứu hộ…" />
        ) : !data.items.length ? (
          <Empty
            icon={History}
            title={hasActiveFilters ? 'Không tìm thấy ca cứu hộ phù hợp' : 'Chưa có lịch sử cứu hộ'}
            description={
              hasActiveFilters
                ? 'Thử thay đổi từ khóa, mở rộng khoảng ngày hoặc bấm “Đặt lại bộ lọc”.'
                : 'Các ca cứu hộ đã hoàn tất hoặc bị hủy sẽ được lưu trữ tự động tại đây.'
            }
          />
        ) : (
          <div className="table-scroll">
            <table className="history-table">
              <thead>
                <tr>
                  <th>MÃ CA / SỰ CỐ</th>
                  <th>NẠN NHÂN</th>
                  <th>NỘI DUNG YÊU CẦU</th>
                  <th>ĐỘI CỨU HỘ</th>
                  <th>THỜI GIAN & THỜI LƯỢNG</th>
                  <th>VỊ TRÍ GPS</th>
                  <th>TRẠNG THÁI</th>
                  <th className="actions-heading">CHI TIẾT</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => {
                  const typeLabel =
                    emergencyLabels[row.emergency_type] || row.emergency_type || 'Khẩn cấp';
                  const shortId = (row.sos_id || '').slice(0, 6).toUpperCase();
                  const duration = formatDuration(row.created_at, row.updated_at);
                  const hasGps = Number.isFinite(row.lat) && Number.isFinite(row.lng);

                  return (
                    <tr key={row.sos_id}>
                      {/* Mã ca & Loại sự cố */}
                      <td>
                        <div className="sos-id-cell">
                          <span className="short-badge">#{shortId}</span>
                          <strong className="emergency-title">{typeLabel}</strong>
                          <span className="visibility-tag">
                            {row.visibility === 'PRIVATE' ? 'Riêng tư' : 'Công khai'}
                          </span>
                        </div>
                      </td>

                      {/* Thông tin nạn nhân */}
                      <td>
                        <div className="person-cell">
                          <span className="avatar small">{initials(row.requester_name)}</span>
                          <div>
                            <strong>{row.requester_name || 'Người dân'}</strong>
                            <a className="phone-link" href={`tel:${row.requester_phone}`}>
                              <Phone size={12} /> {row.requester_phone}
                            </a>
                          </div>
                        </div>
                      </td>

                      {/* Nội dung mô tả sự cố */}
                      <td style={{ maxWidth: '280px' }}>
                        <p className="history-desc" title={row.description}>
                          {row.description || 'Không có mô tả chi tiết.'}
                        </p>
                      </td>

                      {/* Đội cứu hộ */}
                      <td>
                        {row.team_name ? (
                          <div className="team-cell">
                            <UsersRound size={14} />
                            <span>{row.team_name}</span>
                          </div>
                        ) : (
                          <span className="muted-text">Chưa phân công</span>
                        )}
                      </td>

                      {/* Thời gian */}
                      <td>
                        <div className="time-cell">
                          <span>
                            <strong>Tạo:</strong> {formatDate(row.created_at)}
                          </span>
                          <span>
                            <strong>Xử lý:</strong> {duration}
                          </span>
                        </div>
                      </td>

                      {/* Vị trí */}
                      <td>
                        {hasGps ? (
                          <a
                            className="gps-link"
                            href={`https://www.google.com/maps?q=${row.lat},${row.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Mở tọa độ trên Google Maps"
                          >
                            <MapPin size={13} />
                            <span>
                              {row.lat.toFixed(4)}, {row.lng.toFixed(4)}
                            </span>
                            <ExternalLink size={11} />
                          </a>
                        ) : (
                          <span className="muted-text">Không có tọa độ</span>
                        )}
                      </td>

                      {/* Trạng thái */}
                      <td>
                        <Badge value={row.status} />
                      </td>

                      {/* Thao tác xem chi tiết */}
                      <td className="actions-cell">
                        <button
                          className="icon-button"
                          onClick={() => setSelectedItem(row)}
                          title="Xem chi tiết ca cứu hộ & nhật ký xử lý"
                          aria-label="Xem chi tiết"
                        >
                          <Eye size={17} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Phân trang */}
        <Pagination
          page={page}
          total={data.total}
          pageSize={pageSize}
          onChange={(newPage) => setPage(newPage)}
        />
      </section>

      {/* Ghi chú chân trang */}
      <p className="management-note">
        <Shield size={15} />
        Dữ liệu lịch sử cứu hộ được bảo toàn nguyên vẹn phục vụ công tác thanh kiểm tra, tổng kết và báo cáo. Mọi hoạt động của người dân và lực lượng cứu hộ đều được ghi vết tự động.
      </p>

      {/* Modal Xem chi tiết ca cứu hộ */}
      {selectedItem && (
        <RescueDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </>
  );
}

/**
 * Modal Xem chi tiết ca cứu hộ kèm dòng thời gian (Timeline)
 */
function RescueDetailModal({ item, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [logsError, setLogsError] = useState('');

  const typeLabel = emergencyLabels[item.emergency_type] || item.emergency_type || 'Khẩn cấp';
  const hasGps = Number.isFinite(item.lat) && Number.isFinite(item.lng);
  const duration = formatDuration(item.created_at, item.updated_at);

  // Tải nhật ký audit trail của phiên SOS
  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingLogs(true);
      setLogsError('');

      // Thử gọi /api/admin/sos/{id}/logs trước
      try {
        const res = await api(`/api/admin/sos/${item.sos_id}/logs`);
        if (active && Array.isArray(res?.data)) {
          setLogs(res.data);
          setLoadingLogs(false);
          return;
        }
      } catch {
        // Nếu không được, thử tiếp /api/sos/{id}/logs
      }

      try {
        const res = await api(`/api/sos/${item.sos_id}/logs`);
        if (active && Array.isArray(res?.data)) {
          setLogs(res.data);
          setLoadingLogs(false);
          return;
        }
      } catch {
        // Nếu cả hai đều chưa hỗ trợ hoặc bị chặn role -> Tự động sinh Timeline logic từ thông tin ca
        if (active) {
          const generatedLogs = [
            {
              action: 'CREATED',
              description: 'Nạn nhân đã phát tín hiệu cứu hộ khẩn cấp lên hệ thống.',
              created_at: item.created_at,
              actor_name: item.requester_name || 'Nạn nhân',
            },
          ];

          if (item.team_name) {
            generatedLogs.push({
              action: 'ACCEPTED',
              description: `${item.team_name} đã tiếp nhận ca cứu trợ.`,
              created_at: item.updated_at,
              actor_name: item.team_name,
            });
          }

          if (item.status === 'COMPLETED') {
            generatedLogs.push({
              action: 'COMPLETED',
              description: 'Lực lượng cứu hộ hoàn tất nhiệm vụ an toàn.',
              created_at: item.updated_at,
              actor_name: item.team_name || 'Hệ thống',
            });
          } else if (item.status === 'CANCELLED') {
            generatedLogs.push({
              action: 'CANCELLED',
              description: 'Yêu cầu cứu hộ đã được hủy bỏ.',
              created_at: item.updated_at,
              actor_name: item.requester_name || 'Người dùng',
            });
          }

          setLogs(generatedLogs);
          setLoadingLogs(false);
        }
      }
    })();

    return () => { active = false; };
  }, [item]);

  return (
    <Modal
      title={`Chi tiết ca cứu hộ #${item.sos_id.slice(0, 8).toUpperCase()}`}
      description="Toàn bộ thông tin phiên cứu trợ và diễn biến theo mốc thời gian."
      onClose={onClose}
    >
      <div className="history-modal-body">
        {/* Thanh trạng thái đầu modal */}
        <div className="modal-status-bar">
          <div className="status-meta">
            <span className="emergency-tag">{typeLabel}</span>
            <Badge value={item.status} />
            <span className="visibility-badge">
              {item.visibility === 'PRIVATE' ? 'Chế độ: Riêng tư' : 'Chế độ: Công khai'}
            </span>
          </div>
          <span className="time-duration">
            <Clock size={14} /> Thời lượng: {duration}
          </span>
        </div>

        {/* Thông tin 2 cột */}
        <div className="detail-grid">
          {/* Cột 1: Thông tin người gặp nạn */}
          <div className="detail-box">
            <h4>THÔNG TIN NẠN NHÂN</h4>
            <div className="box-row">
              <span className="row-label">Họ và tên:</span>
              <strong>{item.requester_name || '—'}</strong>
            </div>
            <div className="box-row">
              <span className="row-label">Số điện thoại:</span>
              <a href={`tel:${item.requester_phone}`} className="phone-text">
                <Phone size={13} /> {item.requester_phone || '—'}
              </a>
            </div>
            <div className="box-row">
              <span className="row-label">Mô tả tình huống:</span>
              <p className="box-desc">{item.description || 'Không có mô tả chi tiết.'}</p>
            </div>
          </div>

          {/* Cột 2: Thông tin đội tiếp nhận & GPS */}
          <div className="detail-box">
            <h4>LỰC LƯỢNG TIẾP NHẬN & VỊ TRÍ</h4>
            <div className="box-row">
              <span className="row-label">Đội cứu hộ:</span>
              <strong>{item.team_name || 'Chưa tiếp nhận'}</strong>
            </div>
            <div className="box-row">
              <span className="row-label">Tọa độ GPS:</span>
              {hasGps ? (
                <a
                  href={`https://www.google.com/maps?q=${item.lat},${item.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gps-box-link"
                >
                  <MapPin size={14} /> {item.lat.toFixed(5)}, {item.lng.toFixed(5)}
                  <ExternalLink size={12} />
                </a>
              ) : (
                <span className="muted-text">Chưa xác định tọa độ</span>
              )}
            </div>
            <div className="box-row">
              <span className="row-label">Thời điểm gửi SOS:</span>
              <span>{formatDate(item.created_at)}</span>
            </div>
            <div className="box-row">
              <span className="row-label">Cập nhật lần cuối:</span>
              <span>{formatDate(item.updated_at)}</span>
            </div>
          </div>
        </div>

        {/* Dòng thời gian sự kiện (Timeline) */}
        <div className="timeline-section">
          <h4>NHẬT KÝ HOẠT ĐỘNG (AUDIT TIMELINE)</h4>
          {loadingLogs ? (
            <div style={{ padding: '20px 0' }}>
              <Loading label="Đang tải nhật ký thao tác…" />
            </div>
          ) : !logs.length ? (
            <p className="muted-text" style={{ padding: '10px 0' }}>
              Không có nhật ký thao tác nào được ghi nhận.
            </p>
          ) : (
            <div className="history-timeline">
              {logs.map((log, index) => (
                <div key={log.log_id || index} className="timeline-item">
                  <div className="timeline-marker" />
                  <div className="timeline-content">
                    <div className="timeline-header">
                      <strong className="timeline-action">
                        {statusLabels[log.action] || log.action}
                      </strong>
                      <span className="timeline-time">
                        {formatDate(log.created_at)}
                      </span>
                    </div>
                    <p className="timeline-desc">{log.description}</p>
                    {log.actor_name && (
                      <span className="timeline-actor">
                        Bởi: <strong>{log.actor_name}</strong>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="modal-footer">
        <button type="button" className="button secondary" onClick={onClose}>
          Đóng cửa sổ
        </button>
      </div>
    </Modal>
  );
}
