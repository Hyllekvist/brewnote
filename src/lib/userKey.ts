export function getUserKey() {
  if (typeof window === "undefined") return "server";
  const k = localStorage.getItem("brewnote_user_key");
  if (k) return k;

  const newKey = crypto.randomUUID();
  localStorage.setItem("brewnote_user_key", newKey);
  return newKey;
}