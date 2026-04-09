export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

const pendingRequests = new Map<string, Promise<any>>();

export async function fetchAPI(path: string, options: RequestInit = {}) {
  const isGet = !options.method || options.method.toUpperCase() === 'GET';
  const cacheKey = `${path}:${JSON.stringify(options.body || '')}`;

  if (isGet && pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey);
  }

  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(user.role ? { 'user-role': user.role } : {}),
    ...(user.id ? { 'user-id': user.id } : {}),
    ...(options.headers || {}),
  };

  const requestPromise = (async () => {
    try {
      const response = await fetch(path, { ...options, headers });
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          if (window.location.pathname !== '/' && window.location.pathname !== '/login') {
            window.location.href = '/';
          }
        }
        
        const text = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(text);
        } catch (e) {
          errorData = { error: `Server Error (${response.status}): ${text.slice(0, 200)}` };
        }
        throw new Error(errorData.error || 'API request failed');
      }
      return response.json();
    } finally {
      if (isGet) {
        pendingRequests.delete(cacheKey);
      }
    }
  })();

  if (isGet) {
    pendingRequests.set(cacheKey, requestPromise);
  }

  return requestPromise;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.error(`API Error (${operationType}) at ${path}: `, error);
  throw error;
}
