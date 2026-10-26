import { db, collection, getDocs, query, doc, getDoc, setDoc, deleteDoc } from "./mongo";

export interface Customer {
  id?: string;
  name?: string;
  phone?: string;
  email?: string;
  totalTransactions?: number;
  totalSpent?: number;
  [key: string]: any;
}

export async function getAllCustomers(): Promise<Customer[]> {
  try {
    const customerSnapshot = await getDocs(query(collection(db, "customers")));
    const customers: any[] = customerSnapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    // Ambil semua pesanan untuk menghitung statistik
    const orderSnapshot = await getDocs(query(collection(db, "pesanan")));
    const orders: any[] = orderSnapshot.docs.map((d) => d.data());

    // Hitung statistik per customer (berdasarkan phone number)
    const statsMap = new Map<string, { totalTransactions: number; totalSpent: number }>();
    for (const order of orders) {
      const phone = (order.customerPhone || "").replace(/\D/g, "");
      if (!phone) continue;
      const stat = statsMap.get(phone) || { totalTransactions: 0, totalSpent: 0 };
      stat.totalTransactions += 1;
      stat.totalSpent += Number(order.total) || 0;
      statsMap.set(phone, stat);
    }

    const enriched = customers.map((c) => {
      const phone = (c.phone || "").replace(/\D/g, "");
      const stat = statsMap.get(phone) || { totalTransactions: 0, totalSpent: 0 };
      return { ...c, totalTransactions: stat.totalTransactions, totalSpent: stat.totalSpent };
    });

    return enriched;
  } catch (e) {
    console.error("Gagal memuat customers:", e);
    return [];
  }
}

export async function saveCustomer(data: Customer): Promise<boolean> {
  try {
    await setDoc(doc(db, "customers", data.id || ""), data, { merge: true });
    return true;
  } catch (e) {
    console.error("Gagal simpan customer:", e);
    return false;
  }
}

export async function deleteCustomer(id: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, "customers", id));
    return true;
  } catch (e) {
    console.error("Gagal hapus customer:", e);
    return false;
  }
}

export async function getCustomerByPhone(phone: string): Promise<any> {
  try {
    const docRef = doc(db, "customers", phone);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() };
    }
    return null;
  } catch (e) {
    console.error("Gagal ambil customer:", e);
    return null;
  }
}

export async function updateCustomerData(phone: string, data: Record<string, any>): Promise<boolean> {
  try {
    await setDoc(doc(db, "customers", phone), data, { merge: true });
    return true;
  } catch (e) {
    console.error("Gagal update customer:", e);
    return false;
  }
}