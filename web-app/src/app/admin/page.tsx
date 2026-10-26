"use client";
import React from 'react';

import { useState, useEffect, useRef } from "react";
import { Pesanan } from "@/lib/pesanan-types";
import { getAllKomplain, updateKomplainNote, markKomplainSelesai, setKomplainAuthToken } from "@/lib/komplain";
import { config } from "@/config";
import Link from "next/link";


type Tab = "pesanan" | "import" | "migrate" | "export-products" | "export-orders" | "customers" | "komplain" | "chat" | "dibatalkan" | "products";

const getToken = () => localStorage.getItem("admin_token");
const setToken = (t: string) => localStorage.setItem("admin_token", t);
const clearToken = () => localStorage.removeItem("admin_token");

async function verifyDeletePassword(pwd: string): Promise<boolean> {
  try {
    const res = await fetch("/api/admin/verify-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pwd }),
    });
    const data = await res.json();
    return data.ok === true;
  } catch {
    return false;
  }
}

export default function AdminPage() {
  const fmt = (n: number | undefined | null) => Number(n ?? 0).toLocaleString("id-ID");
  const [password, setPassword] = useState("");
  const [logged, setLogged] = useState(false);
  const [orders, setOrders] = useState<Pesanan[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("pesanan");
  const [pesananSubTab, setPesananSubTab] = useState<"semua" | "instan" | "perlu_diproses" | "selesai">("semua");
  const [sortByCourier, setSortByCourier] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  // ─── Customers ───────────────────────────────────────────────
  interface CustomerRow {
    id: string;
    name?: string;
    phone?: string;
    gender?: string;
    birthDate?: string;
    address?: string;
    city?: string;
    points?: number;
    createdAt?: any;
    passwordHash?: string;
    alamatLainnya?: any[];
  }
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerLoading, setCustomerLoading] = useState(false);
  const [downloadPwd, setDownloadPwd] = useState("");
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [pwdError, setPwdError] = useState("");

  // ─── By Date filter ──────────────────────────────────────────
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedOrders, setExpandedOrders] = useState<string[]>([]);
  const [expandedComplaints, setExpandedComplaints] = useState<string[]>([]);
  const toggleExpand = (id: string) => {
    setExpandedOrders(prev => prev.includes(id) ? prev.filter(o => o !== id) : [...prev, id]);
  };
  const toggleExpandComplaint = (id: string) => {
    setExpandedComplaints(prev => prev.includes(id) ? prev.filter(o => o !== id) : [...prev, id]);
  };

  // ─── Delete / Cancel State ─────────────────────────────────────
  const [deletePwdModal, setDeletePwdModal] = useState(false);
  const [deletePwd, setDeletePwd] = useState("");
  const [isDeleteAuth, setIsDeleteAuth] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // ─── Komplain State ─────────────────────────────────────────────
  interface KomplainItem {
    id: string;
    orderId: string;
    customerName: string;
    customerPhone: string;
    complaintText: string;
    status: "on_proses" | "selesai";
    adminNote: string;
    createdAt: string | null;
  }
  const [komplainList, setKomplainList] = useState<KomplainItem[]>([]);
  const [komplainLoading, setKomplainLoading] = useState(false);
  const [komplainSearch, setKomplainSearch] = useState("");
  const [komplainFilter, setKomplainFilter] = useState<"semua" | "on_proses" | "selesai">("semua");
  const [editingKomplain, setEditingKomplain] = useState<string | null>(null);
  const [editNote, setEditNote] = useState("");
  const [saveNoteMsg, setSaveNoteMsg] = useState("");
// ─── Products State ─────────────────────────────────────────────
interface ProductItem {
  id: string;
  name: string;
  sku: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  images: string[];
  variants: { id: string; name: string; sku: string; price: number; stock: number; weight: number }[];
  isActive?: boolean;
}
const [productList, setProductList] = useState<ProductItem[]>([]);
const [productLoading, setProductLoading] = useState(false);
const [productSearch, setProductSearch] = useState("");
const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
const [showAddProductModal, setShowAddProductModal] = useState(false);
const [editingProductId, setEditingProductId] = useState<string | null>(null);
const [newProduct, setNewProduct] = useState({
  id: "",
  name: "",
  sku: "",
  description: "",
  category: "",
  price: 0,
  stock: 0,
  images: "",
  variants: "",
});
const [productMsg, setProductMsg] = useState("");

// Variant rows editor (bukan JSON string)
const [variantRows, setVariantRows] = useState<{id:string;name:string;sku:string;price:number;stock:number;weight:number}[]>([]);

  useEffect(() => {
    const t = getToken();
    if (t) {
      setSessionToken(t);
      setToken(t);
      setKomplainAuthToken(t);
      setLogged(true);
    }
  }, []);

  useEffect(() => {
    if (logged && activeTab === "pesanan") {
      loadOrders();
    }
  }, [logged, activeTab]);

  const getAuth = (): Record<string, string> => {
    const token = sessionToken || getToken();
    if (token) return { Authorization: `AdminSession ${token}` };
    return {};
  };

  const handleLogin = async () => {
    const res = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (data.ok && data.token) {
      setSessionToken(data.token);
      setToken(data.token);
      setKomplainAuthToken(data.token);
      setLogged(true);
    } else {
      alert("Password salah!");
    }
  };

  const handleLogout = () => {
    clearToken();
    setSessionToken(null);
    setKomplainAuthToken(null);
    setLogged(false);
    setActiveTab("pesanan");
  };

  const loadCustomers = async (search = "") => {
    setCustomerLoading(true);
    try {
      const res = await fetch("/api/customers/all");
      const data = await res.json();
      const allCustomers = data.customers || [];
      const filtered: CustomerRow[] = (search
        ? allCustomers.filter(
            (c: any) =>
              (c.name || "").toLowerCase().includes(search.toLowerCase()) ||
              (c.phone || "").includes(search)
          )
        : allCustomers) as CustomerRow[];
      setCustomers(filtered);
    } catch (e) {
      console.error("Gagal memuat customers:", e);
    }
    setCustomerLoading(false);
  };

  const handleDownloadCustomers = async () => {
    setPwdError("");
    const res = await fetch("/api/admin/export-customers", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuth() },
      body: JSON.stringify({ password: downloadPwd }),
    });
    if (res.status === 403) {
      setPwdError("Password salah!");
      return;
    }
    if (!res.ok) { alert("Gagal mengunduh"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "data-customers.csv";
    a.click();
    URL.revokeObjectURL(url);
    setShowPwdModal(false);
    setDownloadPwd("");
  };



const AUTO_CANCEL_MINUTES = 60;
// Helper: parse timestamp from either Timestamp object or ISO string
const parseTimestamp = (val: any): Date => {
  if (!val) return new Date(0);
  if (val instanceof Date) return val;
  if (typeof val === "number") return new Date(val);
  if (typeof val === "string") {
    const n = Number(val);
    if (!isNaN(n) && val.trim() !== "") return new Date(n);
    return new Date(val);
  }
  if (val.toDate) return val.toDate();
  if (val.seconds) return new Date(val.seconds * 1000);
  return new Date(0);
};

  const loadOrders = async () => {
    setLoading(true);
    const res = await fetch("/api/pesanan/all");
    const data = await res.json();
    const orders = data.pesanan || [];
    // Auto‑cancel unpaid orders older than timeout
    const now = new Date();
    for (const o of orders) {
      if (o.paymentStatus === "non_paid" && o.createdAt) {
        const created = parseTimestamp(o.createdAt);
        if (now.getTime() - created.getTime() > AUTO_CANCEL_MINUTES * 60 * 1000) {
          if (o.id) {
            try {
              await fetch("/api/admin/update-order-status", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...getAuth() },
                body: JSON.stringify({ orderId: o.orderId, action: "cancel" }),
              });
            } catch (e) {
              console.error("Gagal auto-cancel order:", e);
            }
            // Reflect changes locally
            o.paymentStatus = "dibatalkan";
            o.status = "dibatalkan";
            o.canceledAt = now.toISOString();
          }
        }
      }
    }
    setOrders(orders);
    setSelectedIds(new Set());
    setLoading(false);
  };

  useEffect(() => {
    // Refresh orders every minute to reflect auto‑cancel changes
    const interval = setInterval(() => {
      if (logged && activeTab === "pesanan") {
        loadOrders();
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [logged, activeTab]);

  useEffect(() => {
    if (logged && activeTab === "customers") {
      loadCustomers(customerSearch);
    }
  }, [activeTab, logged, customerSearch]);

  // ─── Load Komplain ─────────────────────────────────────────────
  const loadKomplain = async () => {
    setKomplainLoading(true);
    try {
      const data = await getAllKomplain();
      console.log("[loadKomplain] Loaded", data.length, "komplain entries");
      setKomplainList(data as any);
    } catch (e) {
      console.error("Gagal memuat komplain:", e);
    } finally {
      setKomplainLoading(false);
    }
  };

  useEffect(() => {
    if (logged && activeTab === "komplain") {
      loadKomplain();
      loadOrders();
    }
  }, [activeTab, logged]);

  const filteredKomplain = komplainList.filter((k) => {
    if (komplainFilter !== "semua" && k.status !== komplainFilter) return false;
    if (komplainSearch) {
      const q = komplainSearch.toLowerCase();
      return k.orderId.toLowerCase().includes(q) || k.customerName.toLowerCase().includes(q) || k.complaintText.toLowerCase().includes(q);
    }
    return true;
  });

  const handleSaveNote = async (id: string) => {
    setSaveNoteMsg("");
    try {
      const ok = await updateKomplainNote(id, editNote);
      console.log("[handleSaveNote] Result:", ok, "for id:", id);
      if (ok) {
        setSaveNoteMsg("✓ Catatan tersimpan");
        setEditingKomplain(null);
        setEditNote("");
        await loadKomplain();
        console.log("[handleSaveNote] Komplain reloaded");
      } else {
        setSaveNoteMsg("Gagal menyimpan");
      }
    } catch (e) {
      console.error("[handleSaveNote] Error:", e);
      setSaveNoteMsg("Gagal menyimpan");
    }
  };


  // ─── Products helpers ─────────────────────────────────────────
  const loadProducts = async (): Promise<ProductItem[]> => {
    setProductLoading(true);
    try {
      const res = await fetch("/api/products/all");
      const data = await res.json();
      const fetchedProducts: any[] = Array.isArray(data) ? data : (data.products || []);
      // Hapus duplicate berdasarkan ID (pertahankan yang pertama)
      const seen = new Set<string>();
      const unique = fetchedProducts.filter((p: any) => {
        const pid = p.id || "";
        if (seen.has(pid)) {
          console.warn(`Duplicate product ID ditemukan dan diabaikan: ${pid}`);
          return false;
        }
        seen.add(pid);
        return true;
      });
      console.log("[loadProducts] Setting productList with", unique.length, "items");
      setProductList(unique);
      return unique;
    } catch (e) {
      console.error("Gagal memuat products:", e);
      return [];
    } finally {
      setProductLoading(false);
    }
  };

  useEffect(() => {
    if (logged && activeTab === "products") {
      loadProducts();
    }
  }, [activeTab, logged]);

  const filteredProducts = productList.filter((p: ProductItem) => {
    if (!productSearch) return true;
    const q = productSearch.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
  });

  const toggleSelectAllProduct = () => {
    if (selectedProductIds.size === filteredProducts.length) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(filteredProducts.map((p) => p.id)));
    }
  };

  const toggleOneProduct = (id: string) => {
    const next = new Set(selectedProductIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedProductIds(next);
  };

  const parseImages = (val: string): string[] => {
    return val.split(",").map((s) => s.trim()).filter(Boolean);
  };

  const parseVariants = (val: string): { id: string; name: string; sku: string; price: number; stock: number; weight: number }[] => {
    try {
      const arr = JSON.parse(val);
      if (!Array.isArray(arr)) return [];
      return arr;
    } catch {
      return [];
    }
  };

  const handleSaveProduct = async () => {
    setProductMsg("");
    const { id, name, sku, description, category, price, stock, images, variants } = newProduct;
    if (!id?.trim() || !sku?.trim()) {
      setProductMsg("ID dan SKU wajib diisi");
      return;
    }
    const body: any = {
      id: id.trim(),
      name: name || "",
      sku: sku.trim(),
      description: description || "",
      category: category || "",
      price: Number(price) || 0,
      stock: Number(stock) || 0,
      images: parseImages(images),
      variants: variantRows,
    };
    try {
      let ok: boolean;
      if (editingProductId) {
        // Mode Edit - gunakan API update
        const res = await fetch("/api/products/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: id.trim(), ...body }),
        });
        const data = await res.json();
        ok = data.ok === true;
      } else {
        // Mode Tambah - gunakan API add
        const res = await fetch("/api/products/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        ok = data.ok === true;
      }
      if (ok) {
        setProductMsg("✓ Product tersimpan");
        setShowAddProductModal(false);
        setEditingProductId(null);
        setNewProduct({ id: "", name: "", sku: "", description: "", category: "", price: 0, stock: 0, images: "", variants: "" });
        loadProducts();
      } else {
        setProductMsg("Gagal menyimpan");
      }
    } catch (e) {
      setProductMsg("Gagal menyimpan");
    }
  };

  const handleToggleProductActive = async (id: string, isActive: boolean) => {
    console.log("[frontend] Toggle clicked:", { id, isActive });
    console.log("[frontend] Current productList:", productList.map(p => ({ id: p.id, isActive: p.isActive })));
    // Optimistic update: langsung update state lokal sebelum fetch
    setProductList(prev => prev.map(p => p.id === id ? { ...p, isActive } : p));
    try {
      const res = await fetch("/api/admin/toggle-product-active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_products: id, isActive }),
      });
      console.log("[frontend] Response status:", res.status);
      if (res.ok) {
        console.log("[frontend] Reloading...");
        const data = await loadProducts();
        const updated = data?.find(p => p.id === id);
        console.log("[frontend] After reload:", { id, isActive: updated?.isActive });
      } else {
        alert("Gagal mengubah status");
        // Rollback state jika gagal
        setProductList(prev => prev.map(p => p.id === id ? { ...p, isActive: !isActive } : p));
      }
    } catch (e) {
      alert("Gagal mengubah status");
      // Rollback state jika error
      setProductList(prev => prev.map(p => p.id === id ? { ...p, isActive: !isActive } : p));
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Hapus product ini?")) return;
    try {
      const res = await fetch("/api/products/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.ok) {
    // Refresh orders immediately after payment simulation
    const freshRes = await fetch("/api/pesanan/all");
    const freshData = await freshRes.json();
    const fresh = freshData.pesanan || [];
    setOrders(fresh);
    // Show waybill number if available
    if (data.waybillNumber) {
        alert(`✅ Pembayaran disimulasikan!\nWaybill: ${data.waybillNumber}`);
    } else {
        alert(`✅ Pembayaran disimulasikan!\nWaybill gagal dibuat (coba lagi)`);
    }

        loadProducts();
      } else {
        alert("Gagal meng hapus");
      }
    } catch (e) {
      alert("Gagal meng hapus");
    }
  };

  const handleEditProduct = (p: ProductItem) => {
    setEditingProductId(p.id);
    setNewProduct({
      id: p.id,
      name: p.name || "",
      sku: p.sku || "",
      description: p.description || "",
      category: p.category || "",
      price: p.price ?? 0,
      stock: p.stock ?? 0,
      images: Array.isArray(p.images) ? p.images.join(", ") : "",
      variants: "",
    });
    setVariantRows(Array.isArray(p.variants) ? [...p.variants] : []);
    setShowAddProductModal(true);
  };

  const handleMarkSelesai = async (id: string) => {
    try {
      const ok = await markKomplainSelesai(id);
      console.log("[handleMarkSelesai] Result:", ok, "for id:", id);
      if (ok) {
        await loadKomplain();
        console.log("[handleMarkSelesai] Komplain reloaded");
      } else {
        alert("Gagal mengubah status");
      }
    } catch (e) {
      console.error("[handleMarkSelesai] Error:", e);
      alert("Gagal mengubah status");
    }
  };

  // Filter orders by date range and sub-tab
  const filteredOrders = orders.filter((o) => {
    // 1. Search Filter
    if (orderSearch) {
      const q = orderSearch.toLowerCase();
      const matchId = o.orderId.toLowerCase().includes(q);
      const matchName = o.customerName.toLowerCase().includes(q);
      if (!matchId && !matchName) return false;
    }
    // 2. Date Filter
    if (!dateFrom && !dateTo) return true;
    const dt = parseTimestamp(o.createdAt);
    const start = dateFrom ? new Date(dateFrom) : new Date(0);
    const end = dateTo ? new Date(dateTo + "T23:59:59") : new Date("9999-12-31");
    return dt >= start && dt <= end;
  });

  // Filter pesanan yang dibatalkan/dihapus (paymentStatus === "dibatalkan" || status === "dibatalkan")
  const canceledOrders = filteredOrders.filter(o => o.paymentStatus === "dibatalkan" || o.status === "dibatalkan");

  // Sub-tab filtering
  const subTabFilteredOrders = filteredOrders.filter((o) => {
    switch (pesananSubTab) {
      case "instan":
        // Filter pesanan yang menggunakan kurir instan/sameday
        return o.service_type === "instant";
      case "perlu_diproses":
        // Filter pesanan yang sudah Paid tapi belum dikirim/diproses
        return o.paymentStatus === "paid" && o.status !== "printed" && o.status !== "dibatalkan";
      case "selesai":
        // Filter pesanan yang SUDAH di-print oleh admin (hanya status "printed")
        return o.status === "printed";
      default:
        // "semua" - tampilkan semua kecuali dibatalkan (akan di-handle di activeOrders)
        return true;
    }
  });

  const activeOrders = subTabFilteredOrders.filter(o => o.status !== "dibatalkan");

  // Apply sort by courier if enabled (for "Perlu Diproses" tab)
  const sortedActiveOrders = sortByCourier && pesananSubTab === "perlu_diproses"
    ? [...activeOrders].sort((a, b) => {
        const courierA = (a.courier || "").toLowerCase();
        const courierB = (b.courier || "").toLowerCase();
        return courierA.localeCompare(courierB);
      })
    : activeOrders;

  // Calculate counts for each sub-tab (based on filteredOrders with search & date filters)
  const allCount = filteredOrders.filter(o => o.status !== "dibatalkan").length;
  const instanCount = filteredOrders.filter(o => o.service_type === "instant" && o.status !== "dibatalkan").length;
  const perluDiprosesCount = filteredOrders.filter(o => o.paymentStatus === "paid" && o.status !== "printed" && o.status !== "dibatalkan").length;
  const selesaiCount = filteredOrders.filter(o => o.status === "printed").length;

  const pesananTabCounts: Record<string, number> = {
    semua: allCount,
    instan: instanCount,
    perlu_diproses: perluDiprosesCount,
    selesai: selesaiCount,
  };

  // ─── Print helpers ───────────────────────────────────────────
  const markAsPrinted = async (orderId: string) => {
    try {
      await fetch("/api/admin/update-order-status", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuth() },
        body: JSON.stringify({ orderId, action: "markPrinted" }),
      });
    } catch (e) {
      console.error("Gagal update status:", e);
    }
  };

  const handlePrint = async (order: Pesanan) => {
    const isInstan = order.service_type === "instant";
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(printResiHTML(order, isInstan));
    win.document.close();
    await markAsPrinted(order.orderId);
    // Refresh order list to update status badge
    const freshRes = await fetch("/api/pesanan/all");
    const freshData = await freshRes.json();
    const fresh = freshData.pesanan || [];
    setOrders(fresh);
  };

  const handlePrintKwitansi = async (order: Pesanan) => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(printKwitansiHTML(order));
    win.document.close();
  };

  const handlePrintSelected = () => {
    const selected = sortedActiveOrders.filter((o) => selectedIds.has(o.id ?? ''));
    if (selected.length === 0) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html><head><title>Cetak Resi Terpilih</title>
      <style>
        @page { size: 10cm 15cm; margin: 0; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; width: 10cm; height: 15cm; padding: 0; }
        .label-box { border: 1px solid #000; padding: 5px 7px; page-break-inside: avoid; background: white; height: 15cm; overflow: hidden; }
        .label-title { font-size: 11px; font-weight: bold; text-align: center; margin-bottom: 2px; }
        .label-order { font-size: 13px; font-weight: bold; color: #15803d; text-align: center; margin: 2px 0; letter-spacing: 0.5px; }
        .label-row { display: flex; justify-content: space-between; font-size: 9px; line-height: 1.3; }
        .label-label { color: #333; }
        .label-value { font-weight: 600; text-align: right; max-width: 58%; }
        .qr-row { display: flex; justify-content: space-around; align-items: flex-start; margin: 3px 0; }
        .qr-col { text-align: center; }
        .qr-col img { width: 60px; height: 60px; image-rendering: pixelated; }
        .qr-label { font-size: 7px; color: #333; margin-top: 2px; font-weight: 600; }
        .footer { font-size: 7px; color: #999; text-align: center; margin-top: 2px; border-top: 1px dashed #ccc; padding-top: 2px; }
        .items-title { font-size: 9px; font-weight: bold; margin-top: 2px; margin-bottom: 2px; color: #333; }
        .item-line { display: flex; align-items: flex-start; gap: 3px; font-size: 8px; line-height: 1.3; margin: 1px 0; }
        .item-num { background: #dc2626; color: white; border-radius: 50%; width: 13px; height: 13px; display: inline-flex; align-items: center; justify-content: center; font-size: 8px; font-weight: bold; flex-shrink: 0; margin-top: 1px; }
        .item-text { flex: 1; overflow: hidden; }
        .item-name { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .item-variant { font-size: 7px; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        @media print { body { width: 10cm; height: 15cm; } }
      </style></head><body>
      ${selected.map((o) => {
        const isInstan = o.service_type === "instant";
        const courierQR = o.waybillNumber
          ? `<div class="qr-col"><img src="https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${encodeURIComponent(o.waybillNumber)}" alt="courier" style="width:60px;height:60px;image-rendering:pixelated;"/><div class="qr-label">${o.courier || 'KURIR'} ${o.waybillNumber}</div></div>`
          : '';
        return `
        <div class="label-box">
          <div class="label-title">${isInstan ? "🚀 KURIR INSTAN" : "📦 KURIR REGULER"}</div>
          <div class="label-order">ORD-${o.orderId}</div>
          <div class="qr-row">
            <div class="qr-col"><img src="https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${encodeURIComponent('ORD-' + o.orderId)}" alt="barcode" style="width:60px;height:60px;image-rendering:pixelated;"/><div class="qr-label">ORD-${o.orderId}</div></div>
            ${courierQR}
          </div>
          <div class="label-row"><span class="label-label">Penerima</span><span class="label-value">${o.customerName}</span></div>
          <div class="label-row"><span class="label-label">No. HP</span><span class="label-value">${o.customerPhone}</span></div>
          <div class="label-row"><span class="label-label">Alamat</span><span class="label-value">${o.address}</span></div>
          <div class="label-row"><span class="label-label">Kota</span><span class="label-value">${o.city}</span></div>
          <div class="items-title">Isi Paket:</div>
          ${o.items.map((item: any, idx: number) => {
            const name = item.productName || item.name || "-";
            const variantSku = item.sku || item.variantSku || "-";
            const variantName = item.variantName || "";
            const qty = item.quantity || 1;
            return `<div class="item-line"><span class="item-num">${idx + 1}</span><span class="item-text"><div class="item-name">${qty}x ${name}</div><div class="item-variant">${variantName} · ${variantSku}</div></span></div>`;
          }).join("")}
          <div class="footer">Cetak: ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</div>
        </div>`;
      }).join("")}
      </body></html>`);
    win.document.close();
  };

  const handlePrintAll = () => {
    // Print all based on current view (sub-tab)
    let listToPrint: Pesanan[];
    if (activeTab === "dibatalkan") {
      listToPrint = canceledOrders;
    } else if (activeTab === "pesanan") {
      listToPrint = sortedActiveOrders;
    } else {
      listToPrint = activeOrders;
    }
    if (listToPrint.length === 0) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html><head><title>Cetak Semua Resi</title>
      <style>
        @page { size: 10cm 15cm; margin: 0; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; width: 10cm; height: 15cm; padding: 0; }
        .label-box { border: 1px solid #000; padding: 5px 7px; page-break-inside: avoid; background: white; height: 15cm; overflow: hidden; }
        .label-title { font-size: 11px; font-weight: bold; text-align: center; margin-bottom: 2px; }
        .label-order { font-size: 13px; font-weight: bold; color: #15803d; text-align: center; margin: 2px 0; letter-spacing: 0.5px; }
        .label-row { display: flex; justify-content: space-between; font-size: 9px; line-height: 1.3; }
        .label-label { color: #333; }
        .label-value { font-weight: 600; text-align: right; max-width: 58%; }
        .qr-row { display: flex; justify-content: space-around; align-items: flex-start; margin: 3px 0; }
        .qr-col { text-align: center; }
        .qr-col img { width: 60px; height: 60px; image-rendering: pixelated; }
        .qr-label { font-size: 7px; color: #333; margin-top: 2px; font-weight: 600; }
        .footer { font-size: 7px; color: #999; text-align: center; margin-top: 2px; border-top: 1px dashed #ccc; padding-top: 2px; }
        .items-title { font-size: 9px; font-weight: bold; margin-top: 2px; margin-bottom: 2px; color: #333; }
        .item-line { display: flex; align-items: flex-start; gap: 3px; font-size: 8px; line-height: 1.3; margin: 1px 0; }
        .item-num { background: #dc2626; color: white; border-radius: 50%; width: 13px; height: 13px; display: inline-flex; align-items: center; justify-content: center; font-size: 8px; font-weight: bold; flex-shrink: 0; margin-top: 1px; }
        .item-text { flex: 1; overflow: hidden; }
        .item-name { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .item-variant { font-size: 7px; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        @media print { body { width: 10cm; height: 15cm; } }
      </style></head><body>
      ${listToPrint.map((o) => {
        const isInstan = o.service_type === "instant";
        const courierQR = o.waybillNumber
          ? `<div class="qr-col"><img src="https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${encodeURIComponent(o.waybillNumber)}" alt="courier" style="width:60px;height:60px;image-rendering:pixelated;"/><div class="qr-label">${o.courier || 'KURIR'} ${o.waybillNumber}</div></div>`
          : '';
        return `
        <div class="label-box">
          <div class="label-title">${isInstan ? "🚀 KURIR INSTAN" : "📦 KURIR REGULER"}</div>
          <div class="label-order">ORD-${o.orderId}</div>
          <div class="qr-row">
            <div class="qr-col"><img src="https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${encodeURIComponent('ORD-' + o.orderId)}" alt="barcode" style="width:60px;height:60px;image-rendering:pixelated;"/><div class="qr-label">ORD-${o.orderId}</div></div>
            ${courierQR}
          </div>
          <div class="label-row"><span class="label-label">Penerima</span><span class="label-value">${o.customerName}</span></div>
          <div class="label-row"><span class="label-label">No. HP</span><span class="label-value">${o.customerPhone}</span></div>
          <div class="label-row"><span class="label-label">Alamat</span><span class="label-value">${o.address}</span></div>
          <div class="label-row"><span class="label-label">Kota</span><span class="label-value">${o.city}</span></div>
          <div class="items-title">Isi Paket:</div>
          ${o.items.map((item: any, idx: number) => {
            const name = item.productName || item.name || "-";
            const variantSku = item.sku || item.variantSku || "-";
            const variantName = item.variantName || "";
            const qty = item.quantity || 1;
            return `<div class="item-line"><span class="item-num">${idx + 1}</span><span class="item-text"><div class="item-name">${qty}x ${name}</div><div class="item-variant">${variantName} · ${variantSku}</div></span></div>`;
          }).join("")}
          <div class="footer">Cetak: ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</div>
        </div>`;
      }).join("")}
      </body></html>`);
    win.document.close();
  };

  const parseAddressParts = (addr: string): { desa: string; kecamatan: string; kabupaten: string } => {
    if (!addr) return { desa: "-", kecamatan: "-", kabupaten: "-" };
    let desa = "-", kecamatan = "-", kabupaten = "-";
    const kabMatch = addr.match(/(?:Kab\.|Kabupaten\s+)([A-Za-z\s]+?)(?:,|\s+Jawa|\s+Jl|\s+Ruko|\s+Gg|\s+Jr|\s+Jln|\s+RT|\s+RW|\s+Kec)/i);
    if (kabMatch) kabupaten = kabMatch[1].trim();
    const kecMatch = addr.match(/(?:Kec\.|Kecamatan\s+)([A-Za-z\s]+?)(?:,|\s+Kab|\s+Kabupaten|\s+Jawa|\s+Jl|\s+Ruko|\s+Gg|\s+Jr|\s+Jln|\s+RT|\s+RW)/i);
    if (kecMatch) kecamatan = kecMatch[1].trim();
    const kecIdx = addr.search(/(?:Kec\.|Kecamatan\s+)/i);
    if (kecIdx > -1) {
      const before = addr.substring(0, kecIdx).trim();
      const parts = before.split(",");
      for (let i = parts.length - 1; i >= 0; i--) {
        const t = parts[i].trim();
        if (t && !/Kec\.|Kabupaten|Kab\.|Jl\.|Jawa|RT\.|RW\.|Ruko|No\.|Gg\.|Jr\.|Jln|RT\.01\/RW/.test(t) && t.length > 2) {
          desa = t;
          break;
        }
      }
    }
    return { desa, kecamatan, kabupaten };
  };

  const printResiHTML = (order: Pesanan, isInstan: boolean) => {
    const courierQR = order.waybillNumber
      ? `<img src="https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${encodeURIComponent(order.waybillNumber)}" alt="courier" style="width:60px;height:60px;image-rendering:pixelated;"/>`
      : '';
    const receiverParts = parseAddressParts(order.address);
    return `<!DOCTYPE html>
<html><head><title>Resi - ORD-${order.orderId}</title>
<style>
  @page { size: 10cm 15cm; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; width: 10cm; height: 15cm; padding: 0; }
  .label-box { border: 1px solid #000; padding: 4px 5px; background: white; height: 15cm; overflow: hidden; position: relative; }
  .label-header { text-align: center; border-bottom: 1px solid #000; padding-bottom: 3px; margin-bottom: 3px; }
  .label-title { font-size: 11px; font-weight: bold; }
  .label-order { font-size: 13px; font-weight: bold; color: #15803d; margin-top: 1px; letter-spacing: 0.5px; }
  .qr-row { display: flex; justify-content: space-around; align-items: flex-start; margin: 3px 0; }
  .qr-col { text-align: center; }
  .qr-col img { width: 60px; height: 60px; image-rendering: pixelated; }
  .qr-label { font-size: 7px; color: #000; margin-top: 2px; font-weight: 600; }
  .divider { border-top: 1px solid #000; margin: 3px 0; }
  .address-section { position: relative; border-bottom: 1px solid #000; }
  .address-section::before, .address-section::after { content: ""; position: absolute; top: 0; bottom: 0; width: 1px; background: #000; }
  .address-section::before { left: -5px; }
  .address-section::after { right: -5px; }
  .two-col { display: flex; border-bottom: 1px solid #000; }
  .col { flex: 1; padding: 3px 5px; font-size: 9px; line-height: 1.3; color: #000; }
  .col:first-child { border-right: 1px solid #000; }
  .col-title { font-weight: bold; margin-bottom: 2px; font-size: 10px; color: #000; }
  .col-line { margin: 1px 0; color: #000; }
  .region-row { display: flex; border-bottom: 1px solid #000; }
  .region-col { flex: 1; padding: 3px 5px; font-size: 9px; line-height: 1.3; text-align: center; color: #000; border-right: 1px solid #000; }
  .region-col:last-child { border-right: none; }
  .region-title { font-weight: bold; margin-bottom: 2px; font-size: 9px; color: #000; }
  .items-title { font-size: 10px; font-weight: bold; margin: 3px 0 2px; color: #000; }
  .item-line { display: flex; align-items: flex-start; gap: 3px; font-size: 9px; line-height: 1.3; margin: 1px 0; }
  .item-num { background: #dc2626; color: white; border-radius: 50%; width: 13px; height: 13px; display: inline-flex; align-items: center; justify-content: center; font-size: 8px; font-weight: bold; flex-shrink: 0; margin-top: 1px; }
  .item-text { flex: 1; }
  .item-name { font-weight: normal; font-size: 9px; white-space: normal; color: #000; }
  .item-variant { font-size: 8px; color: #000; }
  .footer { display: flex; justify-content: space-between; font-size: 7px; color: #999; border-top: 1px dashed #ccc; padding-top: 2px; }
  .footer-right { text-align: right; }
  @media print { body { width: 10cm; height: 15cm; } }
</style></head><body>
<div class="label-box">
  <div class="label-header">
    <div class="label-title">${isInstan ? "🚀 KURIR INSTAN" : "📦 KURIR REGULER"}</div>
    <div class="label-order">ORD-${order.orderId}</div>
  </div>
  <div class="qr-row">
    <div class="qr-col"><img src="https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${encodeURIComponent('ORD-' + order.orderId)}" alt="barcode"/><div class="qr-label">ORD-${order.orderId}</div></div>
    <div class="qr-col">${courierQR ? `<img src="https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${encodeURIComponent(order.waybillNumber)}" alt="courier"/><div class="qr-label">${order.courier || 'KURIR'} ${order.waybillNumber}</div>` : ''}</div>
  </div>
  <div class="divider"></div>
  <div class="address-section">
    <div class="two-col">
      <div class="col">
        <div class="col-title">PENGIRIM</div>
        <div class="col-line">BOTAMP.ID</div>
        <div class="col-line">WA: 0877-8038-6866</div>
        <div class="col-line">Ruko Wonderland, Jl. Raya Pondok Rajeg No.1, Tengah, Kec. Cibinong, Kabupaten Bogor, Jawa Barat 16914</div>
      </div>
      <div class="col">
        <div class="col-title">PENERIMA</div>
        <div class="col-line">${order.customerName}</div>
        <div class="col-line">No. HP: ${order.customerPhone}</div>
        <div class="col-line">${order.address}</div>
      </div>
    </div>
    <div class="region-row">
      <div class="region-col">
        <div class="region-title">KABUPATEN</div>
        <div>${receiverParts.kabupaten}</div>
      </div>
      <div class="region-col">
        <div class="region-title">KECAMATAN</div>
        <div>${receiverParts.kecamatan}</div>
      </div>
      <div class="region-col">
        <div class="region-title">DESA/KEL</div>
        <div>${receiverParts.desa}</div>
      </div>
    </div>
  </div>
  <div class="items-title">ISI PAKET</div>
  ${order.items.map((item: any, idx: number) => {
    const rawName = item.productName || item.name || "-";
    const variantSku = item.sku || item.variantSku || "-";
    let variantName = item.variantName || "";
    if (!variantName && /\(([^)]+)\)$/.test(rawName)) {
      const m = rawName.match(/\(([^)]+)\)$/);
      variantName = m ? m[1] : "";
    }
    const qty = item.quantity || 1;
    return `<div class="item-line"><span class="item-num">${idx + 1}</span><span class="item-text"><div class="item-name">${qty}x ${rawName}</div><div class="item-variant">${variantName} · ${variantSku}</div></span></div>`;
  }).join("")}
  <div class="footer">
    <span>Cetak: ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span>
    <span class="footer-right">Terima Kasih!</span>
  </div>
</div></body></html>`;
  };

  const printKwitansiHTML = (order: Pesanan) => {
    const items = order.items.length > 0 ? order.items : [{ productName: "Produk", variantName: "Standard", sku: "-", quantity: 1, price: order.subtotal, total: order.subtotal }];
    return `<!DOCTYPE html>
<html><head><title>Kwitansi - ORD-${order.orderId}</title>
<style>
  @page { size: 15cm auto; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; width: 15cm; padding: 0; }
  .kwitansi { border: 1px solid #000; padding: 10px 12px; background: white; }
  .kwitansi-header { text-align: center; margin-bottom: 10px; }
  .kwitansi-title { font-size: 16px; font-weight: bold; }
  .kwitansi-order { font-size: 14px; color: #15803d; margin-top: 2px; font-weight: bold; }
  .kwitansi-barcode { text-align: center; margin: 8px 0; }
  .kwitansi-barcode img { width: 100px; height: 100px; image-rendering: pixelated; }
  .kwitansi-divider { border-top: 1px dashed #ccc; margin: 8px 0; }
  .kwitansi-row { display: flex; justify-content: space-between; font-size: 10px; margin: 2px 0; }
  .kwitansi-label { color: #555; }
  .kwitansi-value { font-weight: 600; text-align: right; }
  .kwitansi-items-title { font-size: 10px; font-weight: bold; margin-top: 6px; margin-bottom: 3px; color: #333; }
  .kwitansi-item-line { display: flex; align-items: flex-start; gap: 4px; font-size: 10px; margin: 2px 0; }
  .kwitansi-num { background: #16a34a; color: white; border-radius: 50%; width: 14px; height: 14px; display: inline-flex; align-items: center; justify-content: center; font-size: 8px; font-weight: bold; flex-shrink: 0; margin-top: 1px; }
  .kwitansi-item-text { flex: 1; }
  .kwitansi-item-name { font-weight: normal; font-size: 9px; }
  .kwitansi-item-detail { font-size: 8px; color: #666; }
  .kwitansi-address-row { display: block; font-size: 10px; line-height: 1.4; margin: 2px 0; }
  .kwitansi-address-row .kwitansi-address-prefix { color: #555; font-weight: bold; }
  .kwitansi-address-row .kwitansi-address-val { color: #333; }
  .kwitansi-total { font-size: 11px; font-weight: bold; border-top: 2px solid #333; margin-top: 6px; padding-top: 4px; }
  .kwitansi-total span:last-child { color: #15803d; }
  .kwitansi-footer { font-size: 8px; color: #999; text-align: center; margin-top: 8px; }
  @media print { body { width: 15cm; } }
</style></head><body>
<div class="kwitansi">
  <div class="kwitansi-header">
    <div class="kwitansi-title">${config.brandName}</div>
    <div class="kwitansi-order">ORD-${order.orderId}</div>
  </div>
  <div class="kwitansi-barcode"><img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent('ORD-' + order.orderId)}" alt="barcode"/></div>
  <div class="kwitansi-divider"></div>
  <div class="kwitansi-address-row"><span class="kwitansi-address-prefix">Penerima:</span> <span class="kwitansi-address-val">${order.customerName}</span></div>
  <div class="kwitansi-address-row"><span class="kwitansi-address-prefix">No. HP:</span> <span class="kwitansi-address-val">${order.customerPhone}</span></div>
  <div class="kwitansi-address-row"><span class="kwitansi-address-prefix">alamat:</span> <span class="kwitansi-address-val">${order.address}</span></div>
  <div class="kwitansi-address-row"><span class="kwitansi-address-prefix">Kota:</span> <span class="kwitansi-address-val">${order.city}</span></div>
  <div class="kwitansi-divider"></div>
  <div class="kwitansi-items-title">Detail Pesanan:</div>
  ${items.map((item: any, idx: number) => {
    const name = item.productName || item.name || "-";
    const variant = item.variantName || "";
    const sku = item.sku || item.variantSku || "-";
    const qty = item.quantity || 1;
    const total = item.total || item.price * qty;
    return `<div class="kwitansi-item-line"><span class="kwitansi-num">${idx + 1}</span><span class="kwitansi-item-text"><div class="kwitansi-item-name">${qty}x ${name} (${variant})</div><div class="kwitansi-item-detail">SKU: ${sku}</div></span><span style="font-weight:600;flex-shrink:0;">Rp${total.toLocaleString("id-ID")}</span></div>`;
  }).join("")}
  <div class="kwitansi-divider"></div>
  <div class="kwitansi-row"><span class="kwitansi-label">Subtotal</span><span class="kwitansi-value">Rp${fmt(order.subtotal)}</span></div>
  <div class="kwitansi-row"><span class="kwitansi-label">Ongkos Kirim (${order.service_type === "instant" ? "Instan" : "Reguler"})</span><span class="kwitansi-value">Rp${fmt(order.shippingCost)}</span></div>
  <div class="kwitansi-row kwitansi-total"><span>TOTAL PEMBAYARAN</span><span>Rp${fmt(order.total)}</span></div>
  <div class="kwitansi-footer">Cetak: ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</div>
</div></body></html>`;
  };

  // ─── TAB: IMPORT ─────────────────────────────────────────────
  const handleImport = async (file: File) => {
    setImportStatus("Mengunggah...");
    const isJson = file.name.toLowerCase().endsWith(".json");
    const isCsv = file.name.toLowerCase().endsWith(".csv");
    if (!isJson && !isCsv) {
      setImportStatus("❌ Format tidak didukung. Gunakan .json atau .csv");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const endpoint = isJson ? "/api/admin/import-products" : "/api/admin/import-products-csv";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { ...getAuth() },
      body: formData,
    });
    const data = await res.json();
    if (res.ok) {
      setImportStatus(`✅ ${data.addedProducts} baru, ${data.updatedProducts} produk diperbarui`);
    } else {
      setImportStatus(`❌ ${data.error || "Gagal import"}`);
    }
  };

  // ─── TAB: EXPORT PRODUK ──────────────────────────────────────
  const handleExportProducts = async (format: "json" | "csv") => {
    const res = await fetch(`/api/admin/export-products?format=${format}`, {
      headers: getAuth(),
    });
    if (!res.ok) { alert("Akses ditolak"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = format === "csv" ? "produk.csv" : "produk.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── TAB: EXPORT PESANAN ─────────────────────────────────────
  const buildExportFilename = (format: "json" | "csv") => {
    const fmt = (d: string) => d.replace(/-/g, "");
    if (dateFrom && dateTo) return `pesanan-${fmt(dateFrom)}-${fmt(dateTo)}.${format}`;
    if (dateFrom) return `pesanan-${fmt(dateFrom)}-all.${format}`;
    if (dateTo) return `pesanan-all-${fmt(dateTo)}.${format}`;
    return `pesanan.${format}`;
  };

  const handleExportOrders = async (format: "json" | "csv") => {
    const params = new URLSearchParams({ format });
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    const res = await fetch(`/api/admin/export-orders?${params}`, {
      headers: getAuth(),
    });
    if (!res.ok) { alert("Akses ditolak"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = buildExportFilename(format);
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── LOGIN SCREEN ────────────────────────────────────────────
  if (!logged) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-green-200 dark:border-green-800 w-full max-w-sm space-y-6 shadow-xl">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-3xl">🔐</span>
            </div>
            <h1 className="text-2xl font-bold text-green-700 dark:text-green-300">Admin Panel</h1>
            <p className="text-center text-zinc-500 text-sm mt-1">Masukkan password untuk melanjutkan</p>
          </div>
          <input
            type="password"
            placeholder="Password"
            className="w-full p-3 border-2 border-green-200 dark:border-green-800 rounded-xl dark:bg-zinc-800 dark:border-zinc-700 text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-green-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
          <button
            onClick={handleLogin}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-colors"
          >
            Masuk
          </button>
          <a href="/" className="block text-center text-sm text-zinc-500 hover:text-green-600 transition-colors">
            ← Kembali ke Toko
          </a>
        </div>
      </div>
    );
  }

  // ─── ADMIN DASHBOARD ─────────────────────────────────────────
  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "pesanan", label: "Pesanan", icon: "📦" },
    { key: "import", label: "Import Produk", icon: "📥" },
    { key: "migrate", label: "Migrasi ID", icon: "🔄" },
    { key: "export-products", label: "Export Produk", icon: "📤" },
    { key: "export-orders", label: "Export Pesanan", icon: "📊" },
    { key: "customers", label: "Customers", icon: "👥" },
    { key: "komplain", label: "Komplain", icon: "⚠️" },
    { key: "chat", label: "Live Chat", icon: "💬" },
    { key: "dibatalkan", label: "Dibatalkan/Dihapus", icon: "❌" },
    { key: "products", label: "Products", icon: "🛍️" },
  ];

  // Sub-tabs for Pesanan filter
  const pesananTabs: { key: "semua" | "instan" | "perlu_diproses" | "selesai"; label: string; icon: string }[] = [
    { key: "semua", label: "Semua", icon: "📋" },
    { key: "instan", label: "Instan / Sameday", icon: "🚀" },
    { key: "perlu_diproses", label: "Perlu Diproses", icon: "📦" },
    { key: "selesai", label: "Telah Diproses", icon: "✅" }
  ];

  const toggleSelectAll = () => {
    const listToSelect = activeTab === "dibatalkan" ? canceledOrders : (activeTab === "pesanan" ? sortedActiveOrders : activeOrders);
    if (selectedIds.size === listToSelect.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(listToSelect.map((o) => o.id!)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h1 className="text-2xl font-bold text-green-800 dark:text-green-200">📋 Admin Panel — {config.brandName}</h1>
        <button onClick={handleLogout} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors">
          Keluar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t.key
                ? "bg-green-600 text-white"
                : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/20"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: PESANAN ── */}
      {activeTab === "pesanan" && (
        <div className="space-y-4">
          {/* Sub-tabs Navigation */}
          <div className="flex flex-wrap gap-2">
            {pesananTabs.map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  setPesananSubTab(t.key);
                  setSortByCourier(false); // Reset sort when switching tabs
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pesananSubTab === t.key
                    ? "bg-blue-600 text-white"
                    : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                }`}
              >
                {t.icon} {t.label} ({pesananTabCounts[t.key] ?? 0})
              </button>
            ))}
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap gap-2 items-center">
            <button onClick={loadOrders} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors">
              🔄 Refresh
            </button>
            <button onClick={handlePrintAll} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
              🖨️ Semua Resi ({activeOrders.length})
            </button>
            <button
              onClick={handlePrintSelected}
              disabled={selectedIds.size === 0}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-400 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
            >
              🖨️ Print Terpilih ({selectedIds.size})
            </button>

            {/* Perlu Diproses specific controls */}
            {pesananSubTab === "perlu_diproses" && (
              <div className="flex items-center gap-2 ml-2 border-l border-green-300 dark:border-green-700 pl-4">
                <label className="flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sortByCourier}
                    onChange={(e) => setSortByCourier(e.target.checked)}
                    className="w-4 h-4 accent-green-600"
                  />
                  Sort by Kurir
                </label>
                <button
                  onClick={handlePrintSelected}
                  disabled={selectedIds.size === 0}
                  className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:bg-zinc-400 disabled:cursor-not-allowed text-white rounded-lg text-xs font-medium transition-colors"
                  title="Cetak Resi Terpilih (Mass Print)"
                >
                  🖨️ Print Terpilih
                </button>
                <button
                  onClick={() => {
                    const selected = activeOrders.filter((o) => selectedIds.has(o.id ?? ''));
                    if (selected.length === 0) return;
                    selected.forEach(order => handlePrint(order));
                  }}
                  disabled={selectedIds.size === 0}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-zinc-400 disabled:cursor-not-allowed text-white rounded-lg text-xs font-medium transition-colors"
                  title="Cetak Resi Satuan Terpilih (Buka per tab)"
                >
                  📄 Print Satuan
                </button>
              </div>
            )}

            <div className="flex-1 min-w-[200px] ml-auto">
              <input
                type="text"
                placeholder="🔍 Cari ID pesanan atau nama..."
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                className="w-full text-sm border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>
          </div>

          {/* By Date Filter */}
          <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-zinc-900 rounded-xl border border-green-200 dark:border-green-800 p-3">
            <span className="text-sm font-semibold text-green-700 dark:text-green-300">📅 By Date</span>
            <div className="flex items-center gap-1">
              <label className="text-xs text-zinc-500">Dari</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="text-sm border border-green-200 dark:border-green-800 rounded-lg px-2 py-1 dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>
            <span className="text-zinc-400">—</span>
            <div className="flex items-center gap-1">
              <label className="text-xs text-zinc-500">Sampai</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="text-sm border border-green-200 dark:border-green-800 rounded-lg px-2 py-1 dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(""); setDateTo(""); }}
                className="text-xs text-red-500 hover:text-red-600 ml-1"
              >
                ✕ Reset
              </button>
            )}
            {filteredOrders.length !== orders.length && (
              <span className="text-xs text-zinc-400 ml-auto">
                Menampilkan {sortedActiveOrders.length} pesanan
              </span>
            )}
          </div>

          {loading ? (
            <div className="text-center py-16">
              <div className="animate-pulse flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-zinc-500">Memuat pesanan...</p>
              </div>
            </div>
          ) : sortedActiveOrders.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-2xl border border-green-200 dark:border-green-800">
              <p className="text-zinc-500 text-lg">
                {orders.length === 0 ? "Belum ada pesanan masuk." : "Tidak ada pesanan yang sesuai."}
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-green-200 dark:border-green-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-green-50 dark:bg-green-900/20 text-left">
                      <th className="px-3 py-3 font-semibold text-green-800 dark:text-green-200 w-8">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === sortedActiveOrders.length && sortedActiveOrders.length > 0}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 accent-green-600 cursor-pointer"
                        />
                      </th>
                      <th className="px-4 py-3 font-semibold text-green-800 dark:text-green-200">ID</th>
                      <th className="px-4 py-3 font-semibold text-green-800 dark:text-green-200">Tanggal</th>
                      <th className="px-4 py-3 font-semibold text-green-800 dark:text-green-200">Penerima</th>
                      <th className="px-4 py-3 font-semibold text-green-800 dark:text-green-200">No. HP</th>
                      <th className="px-4 py-3 font-semibold text-green-800 dark:text-green-200">Total</th>
                      <th className="px-4 py-3 font-semibold text-green-800 dark:text-green-200">Ekspedisi</th>
                      <th className="px-4 py-3 font-semibold text-green-800 dark:text-green-200">Aksi</th>
                      <th className="px-4 py-3 font-semibold text-green-800 dark:text-green-200">Status Order</th>
                      <th className="px-4 py-3 font-semibold text-green-800 dark:text-green-200">Print</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-green-100 dark:divide-green-900/30">
                    {sortedActiveOrders.map((order) => {
                        return (
                      <React.Fragment key={order.id}>
                      <tr key={order.id} className="hover:bg-green-50/50 dark:hover:bg-green-900/10 transition-colors">
                        <td className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(order.id!)}
                            onChange={() => toggleOne(order.id!)}
                            className="w-4 h-4 accent-green-600 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-green-700 dark:text-green-300">ORD-{order.orderId}</td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                          {parseTimestamp(order.createdAt).toLocaleDateString("id-ID")}
                        </td>
                        <td className="px-4 py-3 font-medium">{order.customerName}</td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{order.customerPhone}</td>
                        <td className="px-4 py-3 font-bold text-green-700 dark:text-green-300">Rp{fmt(order.total)}</td>
                        <td className="px-4 py-3 text-xs">
                          {order.courier ? `${order.courier.toUpperCase()} ${order.service ? `- ${order.service}` : ""}` : "-"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handlePrintKwitansi(order)}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
                              title="Cetak Kwitansi"
                            >
                              🧾 Kwitansi
                            </button>
                            <button
                              onClick={() => toggleExpand(order.id!)}
                              className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-xs font-medium transition-colors"
                              title="Detail Produk"
                            >
                              📦 Detail
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            order.paymentStatus === "paid" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" :
                            order.paymentStatus === "dibatalkan" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" :
                            "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                          }`}>
                            {order.paymentStatus === "paid" ? "Paid" : order.paymentStatus === "dibatalkan" ? "Dibatalkan" : "Non Paid"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {(!order.paymentStatus || order.paymentStatus === "non_paid") && (
                            <button
                              onClick={async () => {
                                if (!confirm(`Simulasi pembayaran untuk ${order.orderId}?`)) return;
                                try {
                                  const authHeaders = getAuth();
                                  console.log("[Simpl Bayar] Auth headers:", authHeaders);
                                  const res = await fetch("/api/admin/update-order-status", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json", ...authHeaders },
                                    body: JSON.stringify({ orderId: order.orderId, action: "simulatePayment" }),
                                  });
                                  const data = await res.json();
                                  if (data.ok) {
                                    alert(`✅ Pembayaran disimulasikan!\n${data.waybillNumber ? `Waybill: ${data.waybillNumber}` : "Waybill gagal dibuat (coba lagi)"}`);
                                    const freshRes = await fetch("/api/pesanan/all");
                                    const freshData = await freshRes.json();
                                    const fresh = freshData.pesanan || [];
                                    setOrders(fresh);
                                  } else {
                                    alert("❌ Gagal: " + (data.error || "Unknown error") + (res.status === 401 ? "\nSilakan re-login (Logout -> Login kembali) ke Admin Panel untuk memperbarui token Anda." : ""));
                                  }
                                } catch (e) {
                                  alert("❌ Error: " + e);
                                }
                              }}
                              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium transition-colors mb-1"
                              title="Simulasikan pembayaran (trigger Biteship waybill)"
                            >
                              💳 Simpul Bayar
                            </button>
                          )}
                          <button
                            onClick={() => handlePrint(order)}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-colors"
                            title="Cetak Resi"
                          >
                            🖨️ Print
                          </button>
                          {order.waybillNumber && <p className="text-[10px] mt-1 font-mono">{order.waybillNumber}</p>}
                        </td>
                        <td className="px-4 py-3">
                          {order.status === "printed" && order.komplainSelesai ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                              ✓ Printed & Komplain/selesai
                            </span>
                          ) : order.status === "printed" && order.hasComplaint ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                              ✓ Printed & Komplain
                            </span>
                          ) : order.status === "printed" ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                              ✓ Printed
                            </span>
                          ) : order.status === "komplain diajukan" ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                              ⚠ Komplain
                            </span>
                          ) : order.paymentStatus === "non_paid" ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                              No Paid
                            </span>
                          ) : order.paymentStatus === "paid" ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                              On Proses
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
                              Pending
                            </span>)}
                        </td>
                      </tr>
                      {expandedOrders.includes(order.id!) && (
                        <tr>
                          <td colSpan={10} className="px-4 py-3 bg-gray-50 dark:bg-gray-800">
                            <ul className="space-y-1">
  {order.items?.map((item, idx) => (
    <li key={idx} className="flex justify-between text-sm">
      <span>{item.productName || item.name}{item.variantName ? ` (${item.variantName})` : ''} x {item.quantity}</span>
      <span>Rp{fmt(item.total)}</span>
    </li>
  ))}
</ul>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )}
                )}
                </tbody>
                </table>
              </div>
              <div className="px-4 py-3 bg-green-50 dark:bg-green-900/20 border-t border-green-200 dark:border-green-800 text-sm text-zinc-500 dark:text-zinc-400">
                Total: {sortedActiveOrders.length} pesanan
                {selectedIds.size > 0 && ` · Terpilih: ${selectedIds.size}`}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: IMPORT PRODUK ── */}
      {activeTab === "import" && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-green-200 dark:border-green-800 p-6 space-y-4">
          <h2 className="text-lg font-bold text-green-800 dark:text-green-200">📥 Import / Update Produk</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Upload file <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">.json</code> atau <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">.csv</code>.
            <br />
            SKU yang <strong>sama</strong> akan di-update, SKU baru akan ditambahkan.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.csv"
            className="block w-full text-sm text-zinc-500 dark:text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-green-100 dark:file:bg-green-900/30 file:text-green-700 dark:file:text-green-300 hover:file:bg-green-200 dark:hover:file:bg-green-900/50"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImport(file);
            }}
          />
          {importStatus && (
            <p className={`text-sm font-medium ${importStatus.startsWith("✅") ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
              {importStatus}
            </p>
          )}
          <details className="text-sm text-zinc-500 dark:text-zinc-400">
            <summary className="cursor-pointer hover:text-green-600 select-none">Format JSON Import (Nested — persis seperti src/products.json)</summary>
            <pre className="mt-2 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg overflow-x-auto text-xs">
{`[
  {
    "id": "56304927737",
    "name": "Toples Tabung Jar Silinder 800ml",
    "sku": "TJS-800",
    "description": "...",
    "category": "Food Storage",
    "price": 4400,
    "stock": 2800,
    "images": ["https://...", "https://..."],
    "variants": [
      { "id": "425455482094", "name": "Tutup Buram", "sku": "TJS-800-BU-SET", "price": 4400, "stock": 1400, "weight": 210 },
      { "id": "425455482095", "name": "Tutup Bening", "sku": "TJS-800-BE-SET", "price": 4600, "stock": 1400, "weight": 210 }
    ]
  }
]`}
            </pre>
          </details>
        </div>
      )}

      {/* ── TAB: MIGRASI PRODUK ── */}
      {activeTab === "migrate" && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-green-200 dark:border-green-800 p-6 space-y-4">
          <h2 className="text-lg font-bold text-green-800 dark:text-green-200">🔄 Migrasi ID Produk</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Ubah field <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">id</code> menjadi <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">id_products</code> pada semua dokumen products.
            <br />
            <span className="text-yellow-600 dark:text-yellow-400">Wajib dilakukan sekali setelah awal setup.</span>
          </p>
          <button
            onClick={async () => {
              const res = await fetch("/api/migrate-products", { method: "POST" });
              const data = await res.json();
              alert(data.status === "ok" ? `✅ Berhasil: ${data.migrated} produk dimigrasi (${data.total} total)` : `❌ Gagal: ${data.message}`);
            }}
            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium text-sm transition-colors"
          >
            🔄 Jalankan Migrasi
          </button>
        </div>
      )}

      {/* ── TAB: EXPORT PRODUK ── */}
      {activeTab === "export-products" && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-green-200 dark:border-green-800 p-6 space-y-4">
          <h2 className="text-lg font-bold text-green-800 dark:text-green-200">📤 Export Produk</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Unduh semua data produk dari Firestore.</p>
          <div className="flex gap-3">
            <button
              onClick={() => handleExportProducts("json")}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              📄 Download JSON
            </button>
            <button
              onClick={() => handleExportProducts("csv")}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              📊 Download CSV
            </button>
          </div>
        </div>
      )}

      {/* ── TAB: EXPORT PESANAN ── */}
      {activeTab === "export-orders" && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-green-200 dark:border-green-800 p-6 space-y-4">
          <h2 className="text-lg font-bold text-green-800 dark:text-green-200">📊 Export Pesanan</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Unduh semua data pesanan dari Firestore.</p>

          {/* Date filter */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-green-700 dark:text-green-300">📅 By Date</span>
            <div className="flex items-center gap-1">
              <label className="text-xs text-zinc-500">Dari</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="text-sm border border-green-200 dark:border-green-800 rounded-lg px-2 py-1 dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>
            <span className="text-zinc-400">—</span>
            <div className="flex items-center gap-1">
              <label className="text-xs text-zinc-500">Sampai</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="text-sm border border-green-200 dark:border-green-800 rounded-lg px-2 py-1 dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(""); setDateTo(""); }}
                className="text-xs text-red-500 hover:text-red-600"
              >
                ✕ Reset
              </button>
            )}
            {filteredOrders.length !== orders.length && (
              <span className="text-xs text-zinc-400">
                Export: {filteredOrders.length} dari {orders.length} pesanan
              </span>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => handleExportOrders("json")}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              📄 Download JSON
            </button>
            <button
              onClick={() => handleExportOrders("csv")}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              📊 Download CSV
            </button>
          </div>
          <p className="text-xs text-zinc-400">Total: {orders.length} pesanan tersimpan</p>
        </div>
      )}

      {/* ── TAB: CUSTOMERS ── */}
      {activeTab === "customers" && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-green-200 dark:border-green-800 p-6 space-y-4">
          <h2 className="text-lg font-bold text-green-800 dark:text-green-200">👥 Customers</h2>

          {/* Search */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Cari nama atau no HP..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="flex-1 min-w-[200px] text-sm border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
            <button
              onClick={() => loadCustomers(customerSearch)}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              🔍 Cari
            </button>
            <button
              onClick={() => { setCustomerSearch(""); loadCustomers(); }}
              className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200 rounded-lg text-sm font-medium transition-colors"
            >
              Reset
            </button>
            <button
              onClick={() => setShowPwdModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              📥 Download CSV
            </button>
          </div>

          {customerLoading ? (
            <div className="text-center py-12">
              <div className="animate-pulse flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-zinc-500 text-sm">Memuat data customer...</p>
              </div>
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-12 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
              <p className="text-zinc-500">
                {customerSearch ? "Tidak ada customer yang cocok." : "Belum ada data customer."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-green-50 dark:bg-green-900/20 text-left">
                    <th className="px-4 py-3 font-semibold text-green-800 dark:text-green-200">Nama</th>
                    <th className="px-4 py-3 font-semibold text-green-800 dark:text-green-200">No HP</th>
                    <th className="px-4 py-3 font-semibold text-green-800 dark:text-green-200">Password</th>
                    <th className="px-4 py-3 font-semibold text-green-800 dark:text-green-200">Gender</th>
                    <th className="px-4 py-3 font-semibold text-green-800 dark:text-green-200">Kota</th>
                    <th className="px-4 py-3 font-semibold text-green-800 dark:text-green-200">Poin</th>
                    <th className="px-4 py-3 font-semibold text-green-800 dark:text-green-200">Total Transaksi</th>
                    <th className="px-4 py-3 font-semibold text-green-800 dark:text-green-200">Total (Rp)</th>
                    <th className="px-4 py-3 font-semibold text-green-800 dark:text-green-200">Bergabung</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-green-100 dark:divide-green-900/30">
                  {customers.map((c: any) => {
                    const joined = c.createdAt ? new Date(c.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-";
                    return (
                      <tr key={c.id} className="hover:bg-green-50/50 dark:hover:bg-green-900/10 transition-colors">
                        <td className="px-4 py-3 font-medium">{c.name || "-"}</td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 font-mono">{c.phone || "-"}</td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 font-mono">
                          {c.passwordHash ? "****" : <span className="text-zinc-400 dark:text-zinc-600">-</span>}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{c.gender || "-"}</td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{c.city || "-"}</td>
                        <td className="px-4 py-3 font-bold text-green-700 dark:text-green-300">{c.points ?? 0}</td>
                        <td className="px-4 py-3 font-bold text-green-700 dark:text-green-300">{c.totalTransactions ?? 0}</td>
                        <td className="px-4 py-3 font-bold text-green-700 dark:text-green-300">{(c.totalSpent ?? 0).toLocaleString("id-ID")}</td>
                        <td className="px-4 py-3 text-zinc-500 text-xs">{joined}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-zinc-400">Total: {customers.length} customer</p>
        </div>
      )}

      {/* ── TAB: DIBATALKAN ── */}
      {activeTab === "dibatalkan" && (
        <div className="space-y-4">
          {!isDeleteAuth ? (
            <div className="max-w-sm mx-auto bg-white dark:bg-zinc-900 rounded-2xl border border-green-200 dark:border-green-800 p-6 space-y-4 mt-10">
              <div className="text-center">
                <span className="text-4xl mb-2 block">🔒</span>
                <h3 className="font-bold text-lg text-green-800 dark:text-green-200">Akses Dibatalkan</h3>
                <p className="text-sm text-zinc-500">Masukkan password untuk melihat & menghapus pesanan.</p>
              </div>
              <input
                type="password"
                placeholder="Password"
                value={deletePwd}
                onChange={(e) => setDeletePwd(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    verifyDeletePassword(deletePwd).then((ok) => {
                      if (ok) { setIsDeleteAuth(true); setDeleteError(""); }
                      else setDeleteError("Password salah!");
                    });
                  }
                }}
                className="w-full p-3 border-2 border-green-200 dark:border-green-800 rounded-xl dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-green-500 text-center"
              />
              {deleteError && <p className="text-sm text-red-500 text-center">{deleteError}</p>}
              <button
                onClick={() => {
                  verifyDeletePassword(deletePwd).then((ok) => {
                    if (ok) { setIsDeleteAuth(true); setDeleteError(""); }
                    else setDeleteError("Password salah!");
                  });
                }}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl transition-colors"
              >
                Buka
              </button>
            </div>
          ) : (
            <>
              {/* Toolbar */}
              <div className="flex flex-wrap gap-2 items-center">
                <button onClick={loadOrders} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors">
                  🔄 Refresh
                </button>
                <button
                  onClick={() => setDeletePwdModal(true)}
                  disabled={selectedIds.size === 0}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-zinc-400 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <span>🗑️ Hapus Terpilih ({selectedIds.size})</span>
                </button>
                <div className="flex-1 min-w-[200px] ml-auto">
                  <input
                    type="text"
                    placeholder="🔍 Cari ID pesanan atau nama..."
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    className="w-full text-sm border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>

              {loading ? (
                <div className="text-center py-16">
                  <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-zinc-500">Memuat pesanan...</p>
                  </div>
                </div>
              ) : canceledOrders.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-2xl border border-red-200 dark:border-red-800">
                  <p className="text-zinc-500 text-lg">Tidak ada pesanan yang ditemukan.</p>
                </div>
              ) : (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-red-200 dark:border-red-800 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-red-50 dark:bg-red-900/20 text-left">
                          <th className="px-3 py-3 font-semibold text-red-800 dark:text-red-200 w-8">
                            <input
                              type="checkbox"
                              checked={selectedIds.size === canceledOrders.length && canceledOrders.length > 0}
                              onChange={toggleSelectAll}
                              className="w-4 h-4 accent-red-600 cursor-pointer"
                            />
                          </th>
                          <th className="px-4 py-3 font-semibold text-red-800 dark:text-red-200">ID</th>
                          <th className="px-4 py-3 font-semibold text-red-800 dark:text-red-200">Tanggal</th>
                          <th className="px-4 py-3 font-semibold text-red-800 dark:text-red-200">Penerima</th>
                          <th className="px-4 py-3 font-semibold text-red-800 dark:text-red-200">No. HP</th>
                          <th className="px-4 py-3 font-semibold text-red-800 dark:text-red-200">Total</th>
                          <th className="px-4 py-3 font-semibold text-red-800 dark:text-red-200">Ongkir</th>
                          <th className="px-4 py-3 font-semibold text-red-800 dark:text-red-200">Status</th>
                          <th className="px-4 py-3 font-semibold text-red-800 dark:text-red-200 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-red-100 dark:divide-red-900/30">
                        {canceledOrders.map((order) => (
                          <tr key={order.id} className="hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-colors">
                            <td className="px-3 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(order.id!)}
                                onChange={() => toggleOne(order.id!)}
                                className="w-4 h-4 accent-red-600 cursor-pointer"
                              />
                            </td>
                            <td className="px-4 py-3 font-mono font-bold text-red-700 dark:text-red-300">ORD-{order.orderId}</td>
                            <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                              {parseTimestamp(order.createdAt).toLocaleDateString("id-ID")}
                            </td>
                            <td className="px-4 py-3 font-medium">{order.customerName}</td>
                            <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{order.customerPhone}</td>
                            <td className="px-4 py-3 font-bold text-red-700 dark:text-red-300">Rp{fmt(order.total)}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                order.service_type === "instant"
                                  ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                              }`}>
                                {order.service_type === "instant" ? "Instan" : "Reguler"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {order.paymentStatus === "dibatalkan" || order.paymentStatus === "non_paid" ? (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                  No Paid
                                </span>
                              ) : order.status === "printed" ? (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                  ✓ Printed
                                </span>
                              ) : order.status === "komplain diajukan" ? (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                  ⚠ Komplain
                                </span>
                              ) : order.paymentStatus === "paid" ? (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                  On Proses
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
                                  Pending
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => {
                                  setSelectedIds(new Set([order.id!]));
                                  setDeletePwdModal(true);
                                }}
                                className="w-8 h-8 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 flex items-center justify-center transition-colors mx-auto"
                                title="Hapus Permanen"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800 text-sm text-zinc-500 dark:text-zinc-400">
                    Total: {canceledOrders.length} pesanan
                    {selectedIds.size > 0 && ` · Terpilih: ${selectedIds.size}`}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modal Hapus Pesanan */}
      {deletePwdModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-red-200 dark:border-red-800 p-6 w-full max-w-sm space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-red-800 dark:text-red-200">⚠️ Hapus Permanen</h3>
            <p className="text-sm text-zinc-500">Anda akan menghapus <strong>{selectedIds.size}</strong> pesanan. Masukkan password hapus untuk konfirmasi.</p>
            <input
              type="password"
              placeholder="Password Hapus"
              value={deletePwd}
              onChange={(e) => setDeletePwd(e.target.value)}
              className="w-full p-3 border-2 border-red-200 dark:border-red-800 rounded-xl dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-red-500"
              autoFocus
            />
            {deleteError && <p className="text-sm text-red-500 font-medium">{deleteError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => { setDeletePwdModal(false); setDeletePwd(""); setDeleteError(""); }}
                className="flex-1 px-4 py-2 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200 rounded-lg text-sm font-medium transition-colors"
              >
                Batal
              </button>
              <button
                onClick={async () => {
                  setDeleteError("");
                  let success = 0;
                  for (const id of Array.from(selectedIds)) {
                    const order = orders.find(o => o.id === id);
                    if (!order) continue;
                    const res = await fetch("/api/admin/delete-order", {
                      method: "POST",
                      headers: { "Content-Type": "application/json", ...getAuth() },
                      body: JSON.stringify({ orderId: order.orderId, password: deletePwd.trim() })
                    });
                    if (res.ok) success++;
                    else {
                      setDeleteError("Password salah atau gagal hapus");
                      return;
                    }
                  }
                  if (success > 0) {
                    setDeletePwdModal(false);
                    setDeletePwd("");
                    setSelectedIds(new Set());
                    loadOrders();
                  }
                }}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── TAB: KOMPLAIN ── */}
      {activeTab === "komplain" && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap gap-2 items-center">
            <button onClick={loadKomplain} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors">
              🔄 Refresh
            </button>
            <div className="flex gap-1">
              {(["semua", "on_proses", "selesai"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setKomplainFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    komplainFilter === f
                      ? "bg-green-600 text-white"
                      : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/20"
                  }`}
                >
                  {f === "semua" ? "Semua" : f === "on_proses" ? "On Proses" : "Selesai"}
                </button>
              ))}
            </div>
            <div className="flex-1 min-w-[200px] ml-auto">
              <input
                type="text"
                placeholder="🔍 Cari ID atau nama..."
                value={komplainSearch}
                onChange={(e) => setKomplainSearch(e.target.value)}
                className="w-full text-sm border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>
          </div>

          {komplainLoading ? (
            <div className="text-center py-16">
              <div className="animate-pulse flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-zinc-500">Memuat data komplain...</p>
              </div>
            </div>
          ) : filteredKomplain.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-2xl border border-green-200 dark:border-green-800">
              <p className="text-zinc-500 text-lg">Tidak ada data komplain.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-green-200 dark:border-green-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-green-50 dark:bg-green-900/20 text-left">
                      <th className="px-4 py-3 font-semibold text-green-800 dark:text-green-200">ID Pesanan</th>
                      <th className="px-4 py-3 font-semibold text-green-800 dark:text-green-200">Pelapor</th>
                      <th className="px-4 py-3 font-semibold text-green-800 dark:text-green-200">No. HP</th>
                      <th className="px-4 py-3 font-semibold text-green-800 dark:text-green-200">Keterangan</th>
                      <th className="px-4 py-3 font-semibold text-green-800 dark:text-green-200">Status</th>
                      <th className="px-4 py-3 font-semibold text-green-800 dark:text-green-200">Catatan Admin</th>
                      <th className="px-4 py-3 font-semibold text-green-800 dark:text-green-200">Waktu</th>
                      <th className="px-4 py-3 font-semibold text-green-800 dark:text-green-200">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-green-100 dark:divide-green-900/30">
                    {filteredKomplain.map((k) => {
                      return (
                      <React.Fragment key={k.id}>
                      <tr key={k.id} className="hover:bg-green-50/50 dark:hover:bg-green-900/10 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-green-700 dark:text-green-300">ORD-{k.orderId}</td>
                        <td className="px-4 py-3 font-medium">{k.customerName}</td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 font-mono">{k.customerPhone}</td>
                        <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300 max-w-xs truncate">{k.complaintText}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            k.status === "selesai"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                              : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                          }`}>
                            {k.status === "selesai" ? "✓ Selesai" : "⏳ On Proses"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 max-w-xs truncate">
                          {k.adminNote || "—"}
                        </td>
                        <td className="px-4 py-3 text-zinc-500 text-xs">
                          {k.createdAt ? new Date(k.createdAt).toLocaleString("id-ID") : "-"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => toggleExpandComplaint(k.id)}
                            className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-xs font-medium transition-colors"
                            title="Detail Produk"
                          >
                            📦 Detail
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {editingKomplain === k.id ? (
                            <div className="flex flex-col gap-1 items-center">
                              <input
                                type="text"
                                value={editNote}
                                onChange={(e) => setEditNote(e.target.value)}
                                placeholder="Catatan..."
                                className="text-xs border border-green-300 dark:border-green-700 rounded px-2 py-1 dark:bg-zinc-800 w-36"
                              />
                              <div className="flex gap-1">
                                <button onClick={() => handleSaveNote(k.id)} className="text-xs bg-green-600 text-white px-2 py-0.5 rounded hover:bg-green-700">✓</button>
                                <button onClick={() => { setEditingKomplain(null); setEditNote(""); }} className="text-xs bg-zinc-300 dark:bg-zinc-600 text-zinc-700 dark:text-zinc-200 px-2 py-0.5 rounded">✕</button>
                              </div>
                              {saveNoteMsg && <p className="text-xs text-green-600">{saveNoteMsg}</p>}
                            </div>
                          ) : k.status === "on_proses" ? (
                            <div className="flex flex-col gap-1 items-center">
                              <button
                                onClick={() => handleMarkSelesai(k.id)}
                                className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 font-medium"
                              >
                                ✓ Tandai Selesai
                              </button>
                              <button
                                onClick={() => { setEditingKomplain(k.id); setEditNote(k.adminNote || ""); setSaveNoteMsg(""); }}
                                className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-3 py-1 rounded hover:bg-green-200 dark:hover:bg-green-900/50 font-medium"
                              >
                                Edit Catatan
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                              ✓ Komplain Selesai
                            </span>
                          )}
                        </td>
                      </tr>
                      {expandedComplaints.includes(k.id!) && (
                        <tr>
                          <td colSpan={10} className="px-4 py-3 bg-gray-50 dark:bg-gray-800">
                            {(() => {
                              const order = orders.find(o => o.orderId === k.orderId);
                              const items = order?.items || [];
                              if (items.length === 0) {
                                return <p className="text-sm text-zinc-500">Detail produk tidak tersedia</p>;
                              }
                              return (
                                <ul className="space-y-1">
                                  {items.map((item: any, idx) => (
                                    <li key={idx} className="flex justify-between text-sm">
                                      <span>{item.productName || item.name}{item.variantName ? ` (${item.variantName})` : ''} x {item.quantity}</span>
                                      <span>Rp{fmt(item.total)}</span>
                                    </li>
                                  ))}
                                </ul>
                              );
                            })()}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 bg-green-50 dark:bg-green-900/20 border-t border-green-200 dark:border-green-800 text-sm text-zinc-500 dark:text-zinc-400">
                Total: {filteredKomplain.length} komplain
                {komplainFilter !== "semua" && ` · Filter: ${komplainFilter}`}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: LIVE CHAT ── */}
      {activeTab === "chat" && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-green-200 dark:border-green-800 p-6">
          <Link href="/admin/chat" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Buka Live Chat
          </Link>
          <p className="text-sm text-zinc-500 mt-3">Klik tombol di atas untuk membuka halaman chat dengan customer.</p>
        </div>
      )}

      {/* ── TAB: PRODUCTS ── */}
      {activeTab === "products" && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap gap-2 items-center">
            <button onClick={loadProducts} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors">
              🔄 Refresh
            </button>
            <button onClick={() => { setNewProduct({ id: "", name: "", sku: "", description: "", category: "", price: 0, stock: 0, images: "", variants: "" }); setEditingProductId(null); setShowAddProductModal(true); }} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
              ➕ Tambah Produk
            </button>
            <div className="flex-1 min-w-[200px] ml-auto">
              <input
                type="text"
                placeholder="🔍 Cari nama, SKU, kategori..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full text-sm border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>
          </div>

          {productMsg && (
            <div className={`px-3 py-2 rounded-lg text-sm font-medium ${productMsg.startsWith("✓") ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"}`}>
              {productMsg}
            </div>
          )}

          {productLoading ? (
            <div className="text-center py-16">
              <div className="animate-pulse flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-zinc-500">Memuat produk...</p>
              </div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-2xl border border-green-200 dark:border-green-800">
              <p className="text-zinc-500 text-lg">Tidak ada produk ditemukan.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-green-200 dark:border-green-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-green-50 dark:bg-green-900/20 text-left">
                      <th className="px-3 py-3 font-semibold text-green-800 dark:text-green-200 w-8">
                        <input
                          type="checkbox"
                          checked={selectedProductIds.size === filteredProducts.length && filteredProducts.length > 0}
                          onChange={toggleSelectAllProduct}
                          className="w-4 h-4 accent-green-600 cursor-pointer"
                        />
                      </th>
                      <th className="px-4 py-3 font-semibold text-green-800 dark:text-green-200">ID</th>
                      <th className="px-4 py-3 font-semibold text-green-800 dark:text-green-200">Nama</th>
                      <th className="px-4 py-3 font-semibold text-green-800 dark:text-green-200">SKU</th>
                      <th className="px-4 py-3 font-semibold text-green-800 dark:text-green-200">Kategori</th>
                      <th className="px-4 py-3 font-semibold text-green-800 dark:text-green-200">Harga</th>
                      <th className="px-4 py-3 font-semibold text-green-800 dark:text-green-200">Stok</th>
                      <th className="px-4 py-3 font-semibold text-green-800 dark:text-green-200 text-center">Status</th>
                      <th className="px-4 py-3 font-semibold text-green-800 dark:text-green-200 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-green-100 dark:divide-green-900/30">
                    {filteredProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-green-50/50 dark:hover:bg-green-900/10 transition-colors">
                        <td className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedProductIds.has(p.id)}
                            onChange={() => toggleOneProduct(p.id)}
                            className="w-4 h-4 accent-green-600 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-green-700 dark:text-green-300">{p.id}</td>
                        <td className="px-4 py-3 font-medium max-w-xs truncate">{p.name}</td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 font-mono">{p.sku}</td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{p.category}</td>
                        <td className="px-4 py-3 font-bold text-green-700 dark:text-green-300">Rp{fmt(p.price)}</td>
                        <td className="px-4 py-3 font-medium">{p.stock}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleToggleProductActive(p.id, p.isActive === false)}
                            className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                              p.isActive !== false
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50"
                                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50"
                            }`}
                            title={p.isActive !== false ? "Klik untuk nonaktifkan" : "Klik untuk mengaktifkan"}
                          >
                            {p.isActive !== false ? "Aktif" : "Nonaktif"}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex gap-1 justify-center">
                            <button
                              onClick={() => handleEditProduct(p)}
                              className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-colors"
                              title="Edit"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p.id)}
                              className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors"
                              title="Hapus"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 bg-green-50 dark:bg-green-900/20 border-t border-green-200 dark:border-green-800 text-sm text-zinc-500 dark:text-zinc-400">
                Total: {filteredProducts.length} produk
                {selectedProductIds.size > 0 && ` · Terpilih: ${selectedProductIds.size}`}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Add / Edit Product */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-green-200 dark:border-green-800 p-6 w-full max-w-6xl space-y-4 shadow-xl max-h-[95vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-green-800 dark:text-green-200">
              {editingProductId ? "✏️ Edit Produk" : "➕ Tambah Produk Baru"}
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">ID (wajib, unik)</label>
                <input
                  type="text"
                  value={newProduct.id}
                  onChange={(e) => setNewProduct({ ...newProduct, id: e.target.value })}
                  disabled={!!editingProductId}
                  className="w-full text-sm border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="contoh: PROD-001"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">SKU (wajib)</label>
                <input
                  type="text"
                  value={newProduct.sku}
                  onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                  className="w-full text-sm border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="contoh: SKU-123"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Nama Produk</label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  className="w-full text-sm border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="Nama produk"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Deskripsi</label>
                <textarea
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  rows={14}
                  className="w-full text-sm border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-green-500 resize-y"
                  placeholder="Deskripsi produk (bisa multiline)"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Kategori</label>
                <input
                  type="text"
                  value={newProduct.category}
                  onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                  className="w-full text-sm border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="contoh: Food Storage"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Harga</label>
                <input
                  type="number"
                  value={newProduct.price}
                  onChange={(e) => setNewProduct({ ...newProduct, price: Number(e.target.value) })}
                  className="w-full text-sm border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Stok</label>
                <input
                  type="number"
                  value={newProduct.stock}
                  onChange={(e) => setNewProduct({ ...newProduct, stock: Number(e.target.value) })}
                  className="w-full text-sm border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="0"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Gambar (pisahkan koma)</label>
                <input
                  type="text"
                  value={newProduct.images}
                  onChange={(e) => setNewProduct({ ...newProduct, images: e.target.value })}
                  className="w-full text-sm border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="https://img1.jpg, https://img2.jpg"
                />
                {newProduct.images && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {newProduct.images.split(",").map((url, i) => url.trim() && (
                      <img
                        key={i}
                        src={url.trim()}
                        alt={`Preview ${i + 1}`}
                        className="w-20 h-20 object-cover rounded-lg border border-green-200 dark:border-green-800"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Variants</label>
                <div className="border border-green-200 dark:border-green-800 rounded-lg p-3 space-y-2 max-h-64 overflow-y-auto">
                  {variantRows.length === 0 ? (
                    <p className="text-xs text-zinc-400 text-center py-2">Belum ada variant. Klik "＋ Tambah" untuk menambahkan.</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-zinc-500 dark:text-zinc-400">
                          <th className="pb-1">ID</th>
                          <th className="pb-1">Nama</th>
                          <th className="pb-1">SKU</th>
                          <th className="pb-1 text-right">Harga</th>
                          <th className="pb-1 text-right">Stok</th>
                          <th className="pb-1 text-right">Berat</th>
                          <th className="pb-1 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-green-100 dark:divide-green-900/30">
                        {variantRows.map((v, idx) => (
                          <tr key={idx}>
                            <td className="py-1 pr-1">
                              <input
                                type="text"
                                value={v.id}
                                onChange={(e) => {
                                  const rows = [...variantRows];
                                  rows[idx].id = e.target.value;
                                  setVariantRows(rows);
                                }}
                                className="w-full border border-green-200 dark:border-green-800 rounded px-1 py-0.5 dark:bg-zinc-800 text-xs"
                                placeholder="v1"
                              />
                            </td>
                            <td className="py-1 pr-1">
                              <input
                                type="text"
                                value={v.name}
                                onChange={(e) => {
                                  const rows = [...variantRows];
                                  rows[idx].name = e.target.value;
                                  setVariantRows(rows);
                                }}
                                className="w-full border border-green-200 dark:border-green-800 rounded px-1 py-0.5 dark:bg-zinc-800 text-xs"
                                placeholder="Nama variant"
                              />
                            </td>
                            <td className="py-1 pr-1">
                              <input
                                type="text"
                                value={v.sku}
                                onChange={(e) => {
                                  const rows = [...variantRows];
                                  rows[idx].sku = e.target.value;
                                  setVariantRows(rows);
                                }}
                                className="w-full border border-green-200 dark:border-green-800 rounded px-1 py-0.5 dark:bg-zinc-800 text-xs"
                                placeholder="SKU"
                              />
                            </td>
                            <td className="py-1 pr-1 text-right">
                              <input
                                type="number"
                                value={v.price}
                                onChange={(e) => {
                                  const rows = [...variantRows];
                                  rows[idx].price = Number(e.target.value);
                                  setVariantRows(rows);
                                }}
                                className="w-full border border-green-200 dark:border-green-800 rounded px-1 py-0.5 dark:bg-zinc-800 text-xs text-right"
                                placeholder="0"
                              />
                            </td>
                            <td className="py-1 pr-1 text-right">
                              <input
                                type="number"
                                value={v.stock}
                                onChange={(e) => {
                                  const rows = [...variantRows];
                                  rows[idx].stock = Number(e.target.value);
                                  setVariantRows(rows);
                                }}
                                className="w-full border border-green-200 dark:border-green-800 rounded px-1 py-0.5 dark:bg-zinc-800 text-xs text-right"
                                placeholder="0"
                              />
                            </td>
                            <td className="py-1 pr-1 text-right">
                              <input
                                type="number"
                                value={v.weight}
                                onChange={(e) => {
                                  const rows = [...variantRows];
                                  rows[idx].weight = Number(e.target.value);
                                  setVariantRows(rows);
                                }}
                                className="w-full border border-green-200 dark:border-green-800 rounded px-1 py-0.5 dark:bg-zinc-800 text-xs text-right"
                                placeholder="0"
                              />
                            </td>
                            <td className="py-1 text-center">
                              <button
                                type="button"
                                onClick={() => setVariantRows(variantRows.filter((_, i) => i !== idx))}
                                className="text-red-500 hover:text-red-700 px-2"
                                title="Hapus"
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <button
                    type="button"
                    onClick={() => setVariantRows([...variantRows, { id: "", name: "", sku: "", price: 0, stock: 0, weight: 0 }])}
                    className="mt-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    ＋ Tambah Variant
                  </button>
                </div>
              </div>
            </div>
            {productMsg && (
              <div className={`px-3 py-2 rounded-lg text-sm font-medium ${productMsg.startsWith("✓") ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"}`}>
                {productMsg}
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => { setShowAddProductModal(false); setEditingProductId(null); setNewProduct({ id: "", name: "", sku: "", description: "", category: "", price: 0, stock: 0, images: "", variants: "" }); setVariantRows([]); }}
                className="flex-1 px-4 py-2 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200 rounded-lg text-sm font-medium transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSaveProduct}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {editingProductId ? "💾 Simpan Perubahan" : "➕ Tambah Produk"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPwdModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-green-200 dark:border-green-800 p-6 w-full max-w-sm space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-green-800 dark:text-green-200">🔒 Masukkan Password</h3>
            <p className="text-sm text-zinc-500">Password diperlukan untuk mengunduh data customer.</p>
            <input
              type="password"
              placeholder="Password"
              value={downloadPwd}
              onChange={(e) => setDownloadPwd(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleDownloadCustomers()}
              className="w-full p-3 border-2 border-green-200 dark:border-green-800 rounded-xl dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-green-500"
              autoFocus
            />
            {pwdError && <p className="text-sm text-red-500 font-medium">{pwdError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowPwdModal(false); setDownloadPwd(""); setPwdError(""); }}
                className="flex-1 px-4 py-2 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200 rounded-lg text-sm font-medium transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleDownloadCustomers}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
