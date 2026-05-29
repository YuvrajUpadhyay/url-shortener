const API_BASE = import.meta.env.VITE_API_URL || '/api';

const handleResponse = async (res) => {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed with status ${res.status}`);
  return data;
};

export const shortenUrl = async ({ originalUrl, customAlias, expiresInHours }) => {
  const body = { originalUrl };
  if (customAlias) body.customAlias = customAlias;
  if (expiresInHours) body.expiresInHours = parseFloat(expiresInHours);

  const res = await fetch(`${API_BASE}/shorten`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return handleResponse(res);
};

export const getAnalytics = async (shortCode) => {
  const res = await fetch(`${API_BASE}/analytics/${shortCode}`);
  return handleResponse(res);
};

export const getUrls = async ({ page = 1, limit = 20 } = {}) => {
  const res = await fetch(`${API_BASE}/urls?page=${page}&limit=${limit}`);
  return handleResponse(res);
};

export const deleteUrl = async (shortCode) => {
  const res = await fetch(`${API_BASE}/urls/${shortCode}`, { method: 'DELETE' });
  return handleResponse(res);
};
