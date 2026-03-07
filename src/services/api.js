/**
 * Client-side API wrapper for Arcwright server.
 *
 * All fetch calls to /api/* go through here. Provides typed helpers
 * for database and filesystem endpoints with consistent error handling.
 */

const API_BASE = '/api';

// ---------------------------------------------------------------------------
// Core fetch helpers
// ---------------------------------------------------------------------------

async function apiFetch(path, options = {}) {
    const url = `${API_BASE}${path}`;
    const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`API ${options.method || 'GET'} ${path} failed (${res.status}): ${body}`);
    }
    // Some endpoints return text (artifacts, generic file reads)
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        return res.json();
    }
    return res.text();
}

export function apiGet(path) {
    return apiFetch(path);
}

export function apiPost(path, body) {
    return apiFetch(path, { method: 'POST', body: JSON.stringify(body) });
}

export function apiPut(path, body) {
    return apiFetch(path, { method: 'PUT', body: JSON.stringify(body) });
}

export function apiDelete(path) {
    return apiFetch(path, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

export function healthCheck() {
    return apiGet('/health');
}
