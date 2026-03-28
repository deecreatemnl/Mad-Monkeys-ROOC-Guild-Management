// This file replaces the Firebase SDK with a general API service for MySQL backend.

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

  const response = await fetch(path, { ...options, headers });
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'API request failed');
  }
  return response.json();
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.error(`API Error (${operationType}) at ${path}: `, error);
  throw error;
}

// Mocking Firebase Auth for compatibility with existing code
export const auth = {
  currentUser: null as any,
  onAuthStateChanged: (callback: (user: any) => void) => {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    callback(user);
    return () => {};
  },
  signOut: async () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.reload();
  }
};

// Mocking Firestore for compatibility with existing code
export const db = {
  // We will replace Firestore calls with fetchAPI in the pages
};

export default {};
