const KEY = "mindeval_admin_v1";

export function isAdmin(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEY) === "true";
}

export function login(pin: string): boolean {
  const correct = process.env.NEXT_PUBLIC_ADMIN_PIN ?? "mindtalent2025";
  if (pin === correct) {
    localStorage.setItem(KEY, "true");
    return true;
  }
  return false;
}

export function logout(): void {
  localStorage.removeItem(KEY);
}
