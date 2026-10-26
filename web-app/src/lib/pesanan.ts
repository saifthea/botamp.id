import { db, collection, addDoc, getDocs, query, where, orderBy, Timestamp, serverTimestamp } from "./mongo";

export interface PesananItem {
  productName?: string;
  name?: string;
  variantName: string;
  quantity: number;
  price: number;
  total: number;
}

export interface Pesanan {
  id?: string;
  orderId: string;
  customerId?: string;
  customerPhone?: string;
  customerName: string;
  customerPhoneDisplay?: string;
  address: string;
  city: string;
  postal_code?: string;
  items: PesananItem[];
  subtotal: number;
  shippingCost: number;
  courier?: string;
  service?: string;
  service_type?: "instant" | "reguler";
  total: number;
  status?: string;
  paymentStatus?: "non_paid" | "paid" | "dibatalkan";
  waybillNumber?: string;
  canceledAt?: string;
  createdAt: Timestamp | null;
}

export async function savePesanan(data: Omit<Pesanan, "id" | "createdAt">): Promise<Pesanan> {
  const docRef = await addDoc(collection(db, "pesanan"), {
    ...data,
    createdAt: Timestamp.now(),
  });
  return { ...data, id: docRef.id, createdAt: null } as Pesanan;
}

export async function getAllPesanan(): Promise<Pesanan[]> {
  try {
    const q = query(collection(db, "pesanan"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as Pesanan));
  } catch (e) {
    console.error("Gagal memuat pesanan:", e);
    return [];
  }
}

export async function getCustomerPesanan(customerPhone: string): Promise<Pesanan[]> {
  try {
    const cleanPhone = customerPhone.replace(/\D/g, "");
    const q = query(
      collection(db, "pesanan"),
      where("customerPhone", "==", cleanPhone)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((d) => ({ ...d.data(), id: d.id } as Pesanan))
      .sort((a, b) => {
        const aTime = a.createdAt?.seconds ?? 0;
        const bTime = b.createdAt?.seconds ?? 0;
        return bTime - aTime;
      });
  } catch (e) {
    console.error("Gagal memuat pesanan customer:", e);
    return [];
  }
}
