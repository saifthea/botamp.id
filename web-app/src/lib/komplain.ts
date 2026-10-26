

export interface Komplain {
  id?: string;
  orderId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  complaintText?: string;
  adminNote?: string;
  status?: string;
  createdAt?: any;
  [key: string]: any;
}

// Getter token yang bisa di-set dari external (admin page.tsx)
let _authToken: string | null = null;

export function setKomplainAuthToken(token: string | null): void {
  _authToken = token;
}

function getToken(): string | null {
  return _authToken || localStorage.getItem("admin_token");
}

export async function getAllKomplain(): Promise<Komplain[]> {
  try {
    const token = getToken();
    console.log("[komplain] getAllKomplain", { hasToken: !!token });
    const res = await fetch("/api/admin/get-komplain", {
      headers: token ? { Authorization: `AdminSession ${token}` } : {},
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[komplain] getAllKomplain error:", res.status, err);
      return [];
    }
    const data: Komplain[] = await res.json();
    console.log("[komplain] getAllKomplain loaded:", data.length, "entries");
    return data;
  } catch (e) {
    console.error("Gagal memuat komplain:", e);
    return [];
  }
}

export async function updateKomplainNote(id: string, note: string): Promise<boolean> {
  try {
    const token = getToken();
    console.log("[komplain] updateKomplainNote", { id, hasToken: !!token, note });
    const res = await fetch("/api/admin/update-komplain-note", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `AdminSession ${token}` } : {}),
      },
      body: JSON.stringify({ id, adminNote: note }),
    });
    const data = await res.json().catch(() => null);
    console.log("[komplain] updateKomplainNote response:", { status: res.status, ok: res.ok, data });
    return res.ok && data?.ok === true;
  } catch (e) {
    console.error("Gagal update komplain note:", e);
    return false;
  }
}

export async function markKomplainSelesai(id: string): Promise<boolean> {
  try {
    const token = getToken();
    console.log("[komplain] markKomplainSelesai", { id, hasToken: !!token });
    const res = await fetch("/api/admin/update-komplain-note", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `AdminSession ${token}` } : {}),
      },
      body: JSON.stringify({ id, newStatus: "selesai" }),
    });
    const data = await res.json().catch(() => null);
    console.log("[komplain] markKomplainSelesai response:", { status: res.status, ok: res.ok, data });
    return res.ok && data?.ok === true;
  } catch (e) {
    console.error("Gagal tandai selesai:", e);
    return false;
  }
}
