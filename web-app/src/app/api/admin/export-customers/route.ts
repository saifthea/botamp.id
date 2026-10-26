import { NextResponse } from "next/server";
import { db, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy, serverTimestamp, Timestamp } from "@/lib/mongo"

const CUSTOMER_PASSWORD = process.env.CUSTOMER_PASSWORD || "0987";

function esc(v: any): string {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function formatDateFromField(c: any): string {
  if (c.createdAt) {
    const d = new Date(c.createdAt);
    return isNaN(d.getTime()) ? "-" : d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  }
  return "-";
}

export async function POST(req: Request) {
  const { password } = await req.json();

  if (password !== CUSTOMER_PASSWORD) {
    return NextResponse.json({ error: "Password salah" }, { status: 403 });
  }

  const snapshot = await getDocs(query(collection(db, "customers")));

  const customers = snapshot.docs.map((d) => ({
    id: d.id,
    ...(d.data() as any),
  }));

  // Flatten alamatLainnya into numbered columns
  let maxAlamat = 0;
  for (const c of customers) {
    const arr: any[] = c.alamatLainnya || [];
    if (arr.length > maxAlamat) maxAlamat = arr.length;
  }
  if (maxAlamat === 0) maxAlamat = 1;

  const header = [
    "ID", "Nama", "No HP", "Password (Hash)", "Gender", "Tanggal Lahir",
    "alamat", "Kota", "Kode Pos", "Poin", "Tanggal Bergabung",
  ];
  for (let i = 1; i <= maxAlamat; i++) {
    header.push(`Alamat ${i} Nama`, `Alamat ${i} No HP`, `Alamat ${i} Alamat`, `Alamat ${i} Kota`);
  }

  const rows = customers.map((c: any) => {
    const dateStr = formatDateFromField(c);
    const bd = c.birthDate ? new Date(c.birthDate).toLocaleDateString("id-ID") : "-";
    const cells = [
      esc(c.phone || c.id || ""),
      esc(c.name || ""),
      esc(c.phone || ""),
      esc(c.passwordHash || ""),
      esc(c.gender || ""),
      esc(bd),
      esc(c.address || ""),
      esc(c.city || ""),
      esc(c.postal_code || ""),
      esc(c.points ?? 0),
      esc(dateStr),
    ];
    const al = c.alamatLainnya || [];
    for (let i = 0; i < maxAlamat; i++) {
      if (al[i]) {
        cells.push(esc(al[i].nama || ""));
        cells.push(esc(al[i].noHp || ""));
        cells.push(esc(al[i].address || ""));
        cells.push(esc(al[i].city || ""));
      } else {
        for (let j = 0; j < 4; j++) cells.push("");
      }
    }
    return cells;
  });

  const csv = "\uFEFF" + [header.join(","), ...rows.map((r: string[]) => r.join(","))].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="data-customers.csv"',
    },
  });
}