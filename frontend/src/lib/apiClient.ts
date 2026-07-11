const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data: any = null) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

// Simple global toast utility for API errors
function showToast(message: string, isError = true) {
  if (typeof window === 'undefined') return;
  
  const toast = document.createElement('div');
  toast.className = `fixed bottom-4 right-4 p-4 rounded shadow-xl z-50 animate-in slide-in-from-bottom-5 fade-in duration-300 font-label-md max-w-sm ${isError ? 'bg-error text-on-error' : 'bg-surface-variant text-on-surface'}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('fade-out', 'opacity-0', 'transition-opacity');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

async function request(endpoint: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${endpoint}`;
  
  const headers = new Headers(options.headers || {});
  
  // Attach token if present
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null;
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Set default content type to json if body is provided and not FormData
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (e: any) {
    // Network error or timeout (cold start)
    showToast("Waking up server, this may take a moment...", false);
    throw new Error("Network error or cold start: " + e.message);
  }

  if (!response.ok) {
    let errorData = null;
    try {
      errorData = await response.json();
    } catch (e) {
      // Not JSON
    }
    
    // Handle specific errors like 401 Unauthorized globally if desired
    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('access_token');
        window.location.href = '/login';
      }
    }

    const errorMsg = errorData?.detail || response.statusText || 'An API error occurred';
    if (response.status !== 401) {
      showToast(errorMsg);
    }

    throw new ApiError(
      response.status, 
      errorMsg,
      errorData
    );
  }

  // 204 No Content
  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const apiClient = {
  get: (endpoint: string, options?: RequestInit) => request(endpoint, { ...options, method: 'GET' }),
  post: (endpoint: string, body?: any, options?: RequestInit) => request(endpoint, { ...options, method: 'POST', body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined }),
  patch: (endpoint: string, body?: any, options?: RequestInit) => request(endpoint, { ...options, method: 'PATCH', body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined }),
  put: (endpoint: string, body?: any, options?: RequestInit) => request(endpoint, { ...options, method: 'PUT', body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined }),
  delete: (endpoint: string, options?: RequestInit) => request(endpoint, { ...options, method: 'DELETE' }),
};
