const BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const TOKEN_KEY = 'sos-admin-token';

export const session = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  set: (token) => sessionStorage.setItem(TOKEN_KEY, token),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
};

export async function api(path, { body, signal, ...options } = {}) {
  const token = session.get();
  const timeout = AbortSignal.timeout(20000);
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...options,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('Không kết nối được máy chủ. Kiểm tra backend và thử lại.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.detail;
    const message = Array.isArray(detail) ? detail.map((item) => item.msg.replace('Value error, ', '')).join(' · ')
      : typeof detail === 'string' ? detail : detail?.message || 'Có lỗi xảy ra. Vui lòng thử lại.';
    if (path.startsWith('/api/admin/') && [401, 403].includes(response.status)) {
      window.dispatchEvent(new CustomEvent('session-expired', { detail: message }));
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

export function query(params) {
  const values = Object.entries(params).filter(([, value]) => value !== '' && value != null);
  return new URLSearchParams(values).toString();
}
