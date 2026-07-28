const API_BASE = "https://lutr.sebhirsch.com";

async function call(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  if (response.status === 204) return null;
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(body?.error || `${path} failed (${response.status})`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

export const submitLut = (payload) => call("/submit", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

export const getSubmissionStatus = (id) => call(`/status/${encodeURIComponent(id)}`);

export const rateLut = (lutId, stars) => call("/rate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ lutId, stars }),
});

export const getRatings = (lutId) => call(`/ratings/${encodeURIComponent(lutId)}`);

export const beaconDownload = (lutId) => call(`/download/${encodeURIComponent(lutId)}`, {
  method: "POST",
});

export const getDownloadCount = (lutId) => call(`/downloads/${encodeURIComponent(lutId)}`);

export const reportLut = (lutId, category, detail) => call("/report", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ lutId, category, detail }),
});

export const communityStatusUrl = (id) => `${API_BASE}/status/${encodeURIComponent(id)}`;
