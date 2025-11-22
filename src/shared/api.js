import axios from "axios";

// Vite faqat VITE_ bilan boshlangan o'zgaruvchilarni browserga chiqaradi
const API_BASE = import.meta.env.VITE_API_URL || "https://pos-1-o5b5.onrender.com/api";

const api = axios.create({
  baseURL: API_BASE,
});

export function setAuthToken(token) {
  if (token) api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  else delete api.defaults.headers.common["Authorization"];
}

export default api;