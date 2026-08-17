// auth.js (client-side)
// Reads the logged-in user from localStorage, set by Login.jsx / Signup.jsx.

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem("triviaPool.user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getToken() {
  return localStorage.getItem("triviaPool.token");
}

export function logout() {
  localStorage.removeItem("triviaPool.token");
  localStorage.removeItem("triviaPool.user");
}