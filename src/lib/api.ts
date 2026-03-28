export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export async function fetchAPI(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(path, { ...options, headers });
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Only redirect if we are not already on the login page or root
        if (window.location.pathname !== '/' && window.location.pathname !== '/login') {
          window.location.href = '/';
        }
      }
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'API request failed');
    }
    return response.json();
  } catch (error) {
    console.error(`API Error at ${path}:`, error);
    throw error;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.error(`API Error (${operationType}) at ${path}: `, error);
  throw error;
}
