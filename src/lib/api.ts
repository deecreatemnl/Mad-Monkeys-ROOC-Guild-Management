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
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  console.log(`[fetchAPI] Path: ${path}, Role: ${user.role}`);
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(user.role ? { 'user-role': user.role } : {}),
    ...(user.id ? { 'user-id': user.id } : {}),
    ...(options.headers || {}),
  };

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
  } catch (error) {
    console.error(`API Error at ${path}:`, error);
    throw error;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.error(`API Error (${operationType}) at ${path}: `, error);
  throw error;
}
