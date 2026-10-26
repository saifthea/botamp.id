"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  containsXssPayload,
  validateName,
  validatePhone,
  validatePassword,
} from "@/lib/security";

export interface CustomerData {
  uid: string;
  name: string;
  phone: string;
  gender?: string;
  birthDate?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  points: number;
  createdAt: string;
  passwordHash?: string;
  alamatLainnya?: AlamatItem[];
}

export interface AlamatItem {
  id: string;
  nama: string;
  noHp: string;
  address: string;
  city: string;
}

interface AuthContextType {
  customer: CustomerData | null;
  loading: boolean;
  loginOrRegister: (phone: string, name: string, password: string) => Promise<void>;
  logout: () => void;
  updateCustomer: (data: Partial<CustomerData>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const encoder = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  const hashArray = new Uint8Array(hashBuffer);
  const combined = new Uint8Array(salt.length + hashArray.length);
  combined.set(salt);
  combined.set(hashArray, salt.length);

  return btoa(String.fromCharCode(...combined));
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const combined = Uint8Array.from(atob(storedHash), c => c.charCodeAt(0));
    const salt = combined.slice(0, 16);
    const hash = combined.slice(16);

    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );

    const hashBuffer = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      256
    );

    const newHash = new Uint8Array(hashBuffer);
    return hash.length === newHash.length && hash.every((v, i) => v === newHash[i]);
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Cek localStorage session
    const savedPhone = localStorage.getItem("customer_phone");
    if (savedPhone) {
      fetchCustomer(savedPhone);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchCustomer = async (phone: string) => {
    try {
      const cleanPhone = phone.replace(/\D/g, "");
      const res = await fetch("/api/customer/get", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone }),
      });
      const data = await res.json();
      if (res.ok && data.customer) {
        setCustomer(data.customer as CustomerData);
      } else {
        localStorage.removeItem("customer_phone");
        setCustomer(null);
      }
    } catch (e) {
      console.error("Gagal mengambil data customer:", e);
    } finally {
      setLoading(false);
    }
  };

  const loginOrRegister = async (phone: string, name: string, password: string) => {
    // Validasi ketat + sanitasi
    const nameRes = validateName(name);
    if (!nameRes.ok) throw new Error(nameRes.error);
    const phoneRes = validatePhone(phone);
    if (!phoneRes.ok) throw new Error(phoneRes.error);
    const pwdRes = validatePassword(password);
    if (!pwdRes.ok) throw new Error(pwdRes.error);

    const cleanName = nameRes.value!;
    const cleanPhone = phoneRes.value!;
    const cleanPassword = pwdRes.value!;

    // Cek customer existing
    const existingRes = await fetch("/api/customer/get", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: cleanPhone }),
    });
    const existingData = await existingRes.json();
    const existingCustomer = existingData.customer as CustomerData | null;

    let customerData: CustomerData;
    if (existingCustomer) {
      customerData = existingCustomer;

      // Jika customer sudah punya password, verifikasi
      if (customerData.passwordHash) {
        const valid = await verifyPassword(cleanPassword, customerData.passwordHash);
        if (!valid) {
          throw new Error("Password salah");
        }
      } else {
        // Customer lama tanpa password - set password baru
        const passwordHash = await hashPassword(cleanPassword);
        await fetch("/api/customer/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: cleanPhone, data: { passwordHash } }),
        });
        customerData = { ...customerData, passwordHash };
      }

      // Update nama jika berubah
      if (customerData.name !== cleanName) {
        customerData = { ...customerData, name: cleanName };
        await fetch("/api/customer/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: cleanPhone, data: { name: cleanName } }),
        });
      }
    } else {
      // Register baru
      const passwordHash = await hashPassword(cleanPassword);
      customerData = {
        uid: cleanPhone,
        name: cleanName,
        phone: cleanPhone,
        points: 0,
        createdAt: new Date().toISOString(),
        passwordHash,
      };
      await fetch("/api/customer/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone, data: customerData }),
      });
    }

    localStorage.setItem("customer_phone", cleanPhone);
    setCustomer(customerData);
  };

  const logout = () => {
    localStorage.removeItem("customer_phone");
    setCustomer(null);
  };

  const updateCustomer = async (data: Partial<CustomerData>) => {
    if (!customer) return;
    await fetch("/api/customer/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: customer.phone, data }),
    });
    setCustomer((prev) => (prev ? { ...prev, ...data } : null));
  };

  return (
    <AuthContext.Provider value={{ customer, loading, loginOrRegister, logout, updateCustomer }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus di dalam AuthProvider");
  return ctx;
}
