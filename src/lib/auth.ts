const KEY = "mindeval_admin_v1";

// La protección real vive en src/middleware.ts (cookie httpOnly verificada
// en el servidor). Este localStorage solo evita un parpadeo de UI mientras
// el middleware redirige; no debe usarse como control de seguridad.
export function isAdmin(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEY) === "true";
}

export async function login(pin: string): Promise<boolean> {
  const res = await fetch("/api/dashboard-auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  if (!res.ok) return false;
  localStorage.setItem(KEY, "true");
  return true;
}

export async function logout(): Promise<void> {
  await fetch("/api/dashboard-auth", { method: "DELETE" });
  localStorage.removeItem(KEY);
}
