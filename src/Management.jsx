import { useEffect, useState } from 'react';
import { Check, ChevronDown, LoaderCircle, Pencil, Plus, Shield, Trash2, UsersRound } from 'lucide-react';
import { api, query } from './api';
import { useDebounce, useResource } from './hooks';
import { Badge, Empty, ErrorNotice, Loading, Modal, Pagination, SearchInput, formatDate, initials, roleLabels, statusLabels } from './components';

const config = {
  rescuers: { title: 'Quản lý rescuer', eyebrow: 'LỰC LƯỢNG CỨU HỘ', description: 'Quản lý đội viên, phân đội và quyền truy cập hệ thống.', singular: 'rescuer', add: 'Thêm rescuer', filter: 'role', options: roleLabels },
  teams: { title: 'Đội cứu hộ', eyebrow: 'TỔ CHỨC & ĐIỀU PHỐI', description: 'Tổ chức đội ngũ và theo dõi khả năng sẵn sàng ứng cứu.', singular: 'đội cứu hộ', add: 'Thêm đội cứu hộ', filter: 'status', options: { ACTIVE: 'Hoạt động', BUSY: 'Đang cứu hộ', INACTIVE: 'Tạm ngưng' } },
  users: { title: 'Quản lý người dùng', eyebrow: 'TÀI KHOẢN HỆ THỐNG', description: 'Quản lý hồ sơ, thông tin liên hệ và trạng thái tài khoản.', singular: 'người dùng', add: 'Thêm người dùng', filter: 'status', options: { ACTIVE: 'Hoạt động', DISABLED: 'Đã khóa' } },
};
const getId = (kind, row) => kind === 'rescuers' ? row.member_id : kind === 'teams' ? row.team_id : row.id;

export default function Management({ kind, onChanged, notify }) {
  const settings = config[kind];
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const debouncedSearch = useDebounce(search);
  const { data, loading, error, refresh } = useResource(`/api/admin/${kind}?${query({ q: debouncedSearch, [settings.filter]: filter, page, page_size: 10 })}`);
  const rows = data?.data || [];
  useEffect(() => {
    if (data && page > 1 && !data.data.length) setPage(Math.max(1, Math.ceil(data.total / 10)));
  }, [data, page]);
  const completed = (message) => { setModal(null); refresh(); onChanged(); notify(message); };

  return <>
    <div className="page-heading"><div><div className="eyebrow">{settings.eyebrow}</div><h1>{settings.title}</h1><p>{settings.description}</p></div><button className="button primary" onClick={() => setModal({ type: 'edit', row: null })}><Plus size={18}/>{settings.add}</button></div>
    <section className="data-panel"><div className="data-toolbar"><div className="data-title"><h2>Danh sách {settings.singular}</h2><span className="count-pill">{data?.total ?? '—'}</span></div><div className="data-filters"><SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder={kind === 'teams' ? 'Tìm tên đội, mô tả…' : 'Tìm theo tên, số điện thoại…'}/><div className="select-wrap"><select aria-label={`Lọc ${kind === 'rescuers' ? 'vai trò' : 'trạng thái'}`} value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1); }}><option value="">{kind === 'rescuers' ? 'Tất cả vai trò' : 'Tất cả trạng thái'}</option>{Object.entries(settings.options).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><ChevronDown size={15}/></div></div></div>
    <ErrorNotice message={error} retry={refresh}/>
    {loading ? <Loading/> : !rows.length ? <Empty icon={kind === 'teams' ? UsersRound : Shield} title={search || filter ? 'Không tìm thấy kết quả' : `Chưa có ${settings.singular}`} description={search || filter ? 'Thử từ khóa khác hoặc thay đổi bộ lọc.' : `Chọn “${settings.add}” để tạo bản ghi đầu tiên.`}/> : <div className="table-scroll"><table><thead><tr><th>{kind === 'teams' ? 'TÊN ĐỘI CỨU HỘ' : 'HỌ VÀ TÊN'}</th>{kind !== 'teams' && <th>SỐ ĐIỆN THOẠI</th>}{kind === 'rescuers' && <><th>ĐỘI CỨU HỘ</th><th>VAI TRÒ</th></>}{kind === 'teams' && <><th>THÀNH VIÊN</th><th>NGÀY TẠO</th></>}{kind === 'users' && <th>XÁC THỰC</th>}<th>TRẠNG THÁI</th><th className="actions-heading">THAO TÁC</th></tr></thead><tbody>{rows.map((row) => <tr key={getId(kind, row)}>
      <td><div className="person-cell"><span className={`avatar ${kind === 'teams' ? 'team-avatar' : ''}`}>{kind === 'teams' ? <UsersRound size={20}/> : initials(row.full_name)}</span><div><strong>{row.full_name || row.name}</strong><span>{kind === 'teams' ? row.description || 'Chưa có mô tả' : `ID: ${(row.user_id || row.id).slice(0, 8)}`}</span></div></div></td>
      {kind !== 'teams' && <td className="phone-cell"><a href={`tel:${row.phone}`}>{row.phone}</a></td>}
      {kind === 'rescuers' && <><td><span className="team-name">{row.team_name}</span></td><td><Badge value={row.role}/></td></>}
      {kind === 'teams' && <><td><button className="member-count" onClick={() => setModal({ type: 'members', row })}><UsersRound size={15}/>{row.member_count} thành viên</button></td><td className="muted-cell">{formatDate(row.created_at)}</td></>}
      {kind === 'users' && <td><span className={`verified ${row.is_valid ? 'yes' : ''}`}>{row.is_valid && <Check size={14}/>} {row.is_valid ? 'Đã xác thực' : 'Chưa xác thực'}</span></td>}
      <td><Badge value={row.account_status || row.status}/></td><td><div className="row-actions"><button className="icon-button" aria-label={`Sửa ${row.full_name || row.name}`} title="Chỉnh sửa" onClick={() => setModal({ type: 'edit', row })}><Pencil size={16}/></button><button className="icon-button danger-icon" aria-label={`Xóa ${row.full_name || row.name}`} title="Xóa" onClick={() => setModal({ type: 'delete', row })}><Trash2 size={16}/></button></div></td>
    </tr>)}</tbody></table></div>}
    <Pagination page={page} total={data?.total || 0} onChange={setPage}/></section>
    <p className="management-note"><Shield size={15}/>{kind === 'rescuers' ? 'Một người có thể tham gia nhiều đội. Xóa rescuer chỉ gỡ thành viên khỏi đội, tài khoản vẫn được giữ lại.' : kind === 'teams' ? 'Trạng thái “Đang cứu hộ” được cập nhật tự động theo ca SOS của đội.' : 'Tài khoản có lịch sử SOS được bảo toàn. Bạn có thể khóa tài khoản để ngừng quyền truy cập.'}</p>
    {modal?.type === 'edit' && <EditForm kind={kind} row={modal.row} onClose={() => setModal(null)} onSuccess={() => completed(modal.row ? 'Đã lưu thay đổi.' : `Đã thêm ${settings.singular}.`)}/>}
    {modal?.type === 'delete' && <DeleteForm kind={kind} row={modal.row} onClose={() => setModal(null)} onSuccess={() => completed(`Đã xóa ${settings.singular}.`)}/>}
    {modal?.type === 'members' && <TeamMembers team={modal.row} onClose={() => setModal(null)}/>}
  </>;
}

function EditForm({ kind, row, onClose, onSuccess }) {
  const isTeam = kind === 'teams';
  const isRescuer = kind === 'rescuers';
  const [values, setValues] = useState(isTeam ? { name: row?.name || '', description: row?.description || '', status: row?.status || 'ACTIVE' }
    : { full_name: row?.full_name || '', phone: row?.phone || '', account_status: row?.account_status || 'ACTIVE', ...(isRescuer ? { team_id: row?.team_id || '', role: row?.role || 'MEMBER' } : {}) });
  const [teams, setTeams] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(isRescuer);
  const [teamError, setTeamError] = useState('');
  const [teamsVersion, setTeamsVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!isRescuer) return;
    const controller = new AbortController();
    setLoadingTeams(true); setTeamError('');
    (async () => {
      const all = [];
      let page = 1;
      while (true) {
        const result = await api(`/api/admin/teams?page=${page}&page_size=200`, { signal: controller.signal });
        all.push(...result.data);
        if (all.length >= result.total) break;
        page++;
      }
      if (!controller.signal.aborted) setTeams(all);
    })().catch((error) => { if (!controller.signal.aborted) setTeamError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoadingTeams(false); });
    return () => controller.abort();
  }, [isRescuer, teamsVersion]);
  const field = (name) => ({ value: values[name], onChange: (event) => setValues((prev) => ({ ...prev, [name]: event.target.value })) });
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await api(`/api/admin/${kind}${row ? `/${getId(kind, row)}` : ''}`, { method: row ? 'PUT' : 'POST', body: values });
      onSuccess();
    } catch (error) { setError(error.message); setBusy(false); }
  };
  return <Modal title={`${row ? 'Chỉnh sửa' : 'Thêm'} ${config[kind].singular}`} description="Thông tin được lưu trực tiếp vào hệ thống cứu hộ." onClose={onClose} busy={busy}>
    <form onSubmit={submit}><div className="modal-body"><ErrorNotice message={error}/><fieldset disabled={busy}>
      {isTeam ? <><label className="field">Tên đội cứu hộ <span>*</span><input autoFocus required maxLength={100} placeholder="VD: Đội phản ứng nhanh Quận 1" {...field('name')}/></label><label className="field">Mô tả<textarea rows={3} maxLength={2000} placeholder="Khu vực hoạt động, chuyên môn của đội…" {...field('description')}/></label><label className="field">Trạng thái<select {...field('status')} disabled={row?.status === 'BUSY'}><option value="ACTIVE">Hoạt động</option><option value="INACTIVE">Tạm ngưng</option>{row?.status === 'BUSY' && <option value="BUSY">Đang cứu hộ</option>}</select></label></>
        : <><label className="field">Họ và tên <span>*</span><input autoFocus required maxLength={100} autoComplete="name" placeholder="Nhập họ và tên" {...field('full_name')}/></label><label className="field">Số điện thoại <span>*</span><input type="tel" autoComplete="tel" required maxLength={20} placeholder="090 123 4567" {...field('phone')}/></label>
        {isRescuer && <><ErrorNotice message={teamError} retry={() => setTeamsVersion((value) => value + 1)}/><div className="form-row"><label className="field">Đội cứu hộ <span>*</span><select required disabled={loadingTeams || !!teamError} {...field('team_id')}><option value="">{loadingTeams ? 'Đang tải đội…' : 'Chọn đội cứu hộ'}</option>{teams.map((team) => <option value={team.team_id} key={team.team_id}>{team.name}</option>)}</select></label><label className="field">Vai trò <span>*</span><select {...field('role')}>{Object.entries(roleLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>{!loadingTeams && !teamError && !teams.length && <p className="form-hint">Chưa có đội cứu hộ. Hãy tạo đội trước khi thêm rescuer.</p>}</>}
        <label className="field">Trạng thái tài khoản<select {...field('account_status')}><option value="ACTIVE">Hoạt động</option><option value="DISABLED">Đã khóa</option></select></label>
        {isRescuer && !row && <p className="form-hint">Nếu số điện thoại đã tồn tại, hệ thống thêm tài khoản đó vào đội và giữ nguyên hồ sơ. Role ADMIN cho phép truy cập toàn bộ trang quản trị.</p>}
        {isRescuer && row && <p className="form-hint">Họ tên, số điện thoại và trạng thái được cập nhật cho tài khoản này trong tất cả các đội.</p>}</>}
    </fieldset></div><div className="modal-footer"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>Hủy bỏ</button><button className="button primary" disabled={busy || (isRescuer && (loadingTeams || !!teamError || !teams.length))}>{busy ? <LoaderCircle size={16} className="spin"/> : <Check size={16}/>} {row ? 'Lưu thay đổi' : 'Thêm mới'}</button></div></form>
  </Modal>;
}

function DeleteForm({ kind, row, onClose, onSuccess }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const remove = async () => {
    setBusy(true); setError('');
    try { await api(`/api/admin/${kind}/${getId(kind, row)}`, { method: 'DELETE' }); onSuccess(); }
    catch (error) { setError(error.message); setBusy(false); }
  };
  return <Modal title={`Xóa ${config[kind].singular}?`} onClose={onClose} busy={busy}><div className="modal-body"><span className="delete-symbol"><Trash2 size={25}/></span><p className="delete-description">Bạn đang xóa <strong>{row.name || row.full_name}</strong>{kind === 'rescuers' ? <> khỏi đội <strong>{row.team_name}</strong>. Tài khoản người dùng vẫn được giữ lại.</> : kind === 'teams' ? '. Các thành viên sẽ được gỡ khỏi đội, tài khoản vẫn được giữ lại. Đội có lịch sử SOS sẽ không thể xóa.' : '. Thao tác này không thể hoàn tác.'}</p><ErrorNotice message={error}/></div><div className="modal-footer"><button className="button secondary" disabled={busy} onClick={onClose}>Hủy bỏ</button><button className="button danger" disabled={busy} onClick={remove}>{busy && <LoaderCircle className="spin" size={16}/>} Xác nhận xóa</button></div></Modal>;
}

function TeamMembers({ team, onClose }) {
  const [page, setPage] = useState(1);
  const { data, loading, error, refresh } = useResource(`/api/admin/rescuers?team_id=${team.team_id}&page=${page}&page_size=10`);
  return <Modal title={team.name} description="Danh sách thành viên của đội cứu hộ." onClose={onClose}><div className="modal-body"><ErrorNotice message={error} retry={refresh}/>{loading ? <Loading/> : !data?.data.length ? <Empty icon={UsersRound} title="Đội chưa có thành viên" description="Thêm thành viên tại mục Quản lý rescuer."/> : <div className="member-list">{data.data.map((member) => <div key={member.member_id}><span className="avatar">{initials(member.full_name)}</span><div><strong>{member.full_name}</strong><a href={`tel:${member.phone}`}>{member.phone}</a></div><Badge value={member.role}/></div>)}</div>}</div><Pagination page={page} total={data?.total || 0} onChange={setPage}/></Modal>;
}
