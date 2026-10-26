"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Pesanan } from "@/lib/pesanan-types";
import DatePicker from "@/components/DatePicker";
import { config } from "@/config";
import { hashPassword, verifyPassword } from "@/lib/auth-utils";

type TabType = "pesanan" | "histori" | "poin" | "cart";

export default function ProfilePage() {
  const { customer, updateCustomer, logout, loading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("pesanan");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pesananList, setPesananList] = useState<Pesanan[]>([]);
  const [loadingPesanan, setLoadingPesanan] = useState(false);
  const [pesananStale, setPesananStale] = useState(false);
  const [cartItems, setCartItems] = useState<any[]>([]);
  // Expandable order details state
  const [expandedOrders, setExpandedOrders] = useState<string[]>([]);
  const toggleExpand = (id: string) => {
    setExpandedOrders(prev => prev.includes(id) ? prev.filter(o => o !== id) : [...prev, id]);
};
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [complaintOrderId, setComplaintOrderId] = useState<string | null>(null);
  const [complaintText, setComplaintText] = useState("");
  const [complaintSending, setComplaintSending] = useState(false);
  const [sendUnboxingVideo, setSendUnboxingVideo] = useState(false);

  const [form, setForm] = useState({
    name: customer?.name || "",
    phone: customer?.phone || "",
    gender: customer?.gender || "",
    birthDate: customer?.birthDate || "",
    address: customer?.address || "",
    city: customer?.city || "",
    postal_code: customer?.postal_code || "",
  });

  // ─── Ganti Password ──────────────────────────────────────────────
  const [pwdForm, setPwdForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState("");
  const [pwdError, setPwdError] = useState("");

  useEffect(() => {
    if (!loading && !customer) {
      router.replace("/auth?redirect=/profile");
    }
  }, [customer, loading, router]);

  useEffect(() => {
    if (customer) {
      setForm({
        name: customer.name,
        phone: customer.phone,
        gender: customer.gender || "",
        birthDate: customer.birthDate || "",
        address: customer.address || "",
        city: customer.city || "",
        postal_code: customer.postal_code || "",
      });
    }
  }, [customer]);

  useEffect(() => {
    const savedCart = JSON.parse(localStorage.getItem("cart") || "[]");
    setCartItems(savedCart);
  }, [activeTab]);

  useEffect(() => {
    if (customer && !loading) {
      fetchPesanan();
    }
  }, [customer, loading]);

  const handleSendComplaint = async () => {
    if (!complaintOrderId || !complaintText.trim()) return;
    setComplaintSending(true);
    try {
      console.log('[FRONTEND] Sending complaint:', { orderId: complaintOrderId, text: complaintText.trim() });
      // Simpan ke Firestore
      const res = await fetch("/api/admin/komplain/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: complaintOrderId,
          customerName: customer?.name || "-",
          customerPhone: customer?.phone || "-",
          complaintText: complaintText.trim(),
        }),
      });
      console.log('[FRONTEND] Response status:', res.status);
      if (res.status === 409) {
        alert("Komplain untuk pesanan ini sudah pernah diajukan.");
        setComplaintOpen(false);
        setComplaintOrderId(null);
        setComplaintText("");
        return;
      }
      // Buka WhatsApp
      let messageText = `Halo, saya ingin komplain pesanan:\n\n📦 ID Pesanan: ORD-${complaintOrderId}\n📝 Keterangan:\n${complaintText.trim()}`;
      if (sendUnboxingVideo) {
        messageText += `\n\n📹 Saya akan kirim video unboxing via chat ini`;
      }
      messageText += `\n\nMohon segera ditindaklanjuti. Terima kasih.`;
      const message = encodeURIComponent(messageText);
      const waUrl = `https://wa.me/${config.whatsappNumber}?text=${message}`;
      const link = document.createElement("a");
      link.href = waUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
      setComplaintOpen(false);
      setComplaintOrderId(null);
      setComplaintText("");
      setSendUnboxingVideo(false);
      fetchPesanan();
    } catch (e) {
      alert("Gagal mengirim komplain. Silakan coba lagi.");
    } finally {
      setComplaintSending(false);
    }
  };

  const handleMarkSelesai = async (orderId: string) => {
    if (!customer) return;
    if (!confirm("Yakin pesanan ini sudah selesai?")) return;
    try {
      const res = await fetch("/api/customer/mark-selesai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, customerPhone: customer.phone }),
      });
      if (res.ok) {
        fetchPesanan(true);
      } else {
        alert("Gagal menandai selesai");
      }
    } catch (e) {
      alert("Gagal menandai selesai. Silakan coba lagi.");
    }
  };

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateCustomer(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePwd = (field: string, value: string) => {
    setPwdForm((prev) => ({ ...prev, [field]: value }));
    setPwdError("");
    setPwdMsg("");
  };

  const handleGantiPassword = async () => {
    setPwdError("");
    setPwdMsg("");
    const { oldPassword, newPassword, confirmPassword } = pwdForm;

    if (!oldPassword || !newPassword || !confirmPassword) {
      setPwdError("Mohon isi semua field.");
      return;
    }
    if (newPassword.length < 6) {
      setPwdError("Password baru minimal 6 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError("Konfirmasi password tidak cocok.");
      return;
    }

    setPwdSaving(true);
    try {
      // Verifikasi password lama terhadap hash yang tersimpan
      if (customer?.passwordHash) {
        const valid = await verifyPassword(oldPassword, customer.passwordHash);
        if (!valid) {
          setPwdError("Password lama salah.");
          setPwdSaving(false);
          return;
        }
      }

      // Hash password baru dan simpan
      const newHash = await hashPassword(newPassword);
      await updateCustomer({ passwordHash: newHash });
      setPwdMsg("✓ Ganti Password Berhasil");
      setPwdForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
      setTimeout(() => setPwdMsg(""), 3000);
    } catch (e) {
      setPwdError("Gagal mengganti password. Silakan coba lagi.");
    } finally {
      setPwdSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  const fetchPesanan = async (force = false) => {
  if (!customer) return;
  // Selalu ambil data terbaru dari server (tanpa cache) agar status update terlihat
  setLoadingPesanan(true);
  try {
    const res = await fetch(`/api/pesanan/customer?phone=${encodeURIComponent(customer.phone)}&t=${Date.now()}`);
    const data = await res.json();
    setPesananList(data.pesanan || []);
  } finally {
    setLoadingPesanan(false);
  }
};

  const isCancelled = (order: Pesanan): boolean => {
    const s = (order.status || "").toLowerCase().trim();
    const ps = (order.paymentStatus || "").toLowerCase().trim();
    const cancelledStatuses = [
      "cancelled", "canceled", "cancel", "cancelled not paid",
      "dibatalkan", "dihapus"
    ];
    return cancelledStatuses.some(v => s.includes(v) || ps.includes(v));
  };

  const isHistori = (order: Pesanan): boolean => {
    const status = (order.status || "").trim().toLowerCase();
    const paymentStatus = (order.paymentStatus || "").trim().toLowerCase();

    // Jika customer sudah menandai selesai, masuk histori
    if (order.customerMarkedDone) return true;

    // Jika komplain sudah selesai, masuk histori
    if (order.komplainSelesai) return true;

    // Jika status sudah selesai (berbagai kemungkinan bentuk), masuk histori
    if (status.includes("selesai") || status === "completed" || status === "done") return true;

    // Jika komplain sudah selesai, masuk histori
    if (status.includes("komplain selesai") || status.includes("komplain_selesai")) return true;

    // Jika sudah dibatalkan, masuk histori
    if (isCancelled(order)) return true;

    // Cek apakah sudah 10 hari sejak order tanpa komplain
    const createdAt = order.createdAt;
    if (!createdAt) return false;

    const orderDate = typeof createdAt === "string" ? new Date(createdAt) : (createdAt?.seconds ? new Date(createdAt.seconds * 1000) : (createdAt instanceof Date ? createdAt : new Date(0)));
    const now = new Date();
    const diffDays = (now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24);

    // Jika sudah > 7 hari dan status bukan "komplain diajukan", masuk histori
    if (diffDays > 7 && !status.includes("komplain diajukan") && !status.includes("komplain_diajukan")) return true;

    return false;
  };

  const isCancelledNotPaid = (order: Pesanan): boolean => {
    return isCancelled(order);
  };

  const getStatusBadge = (status?: string) => {
    const colors: Record<string, string> = {
      belum_dibayar: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      dikemas: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      dikirim: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
      selesai: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      "komplain diajukan": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    };
    const labels: Record<string, string> = {
      belum_dibayar: "Belum Dibayar",
      dikemas: "Dikemas",
      dikirim: "Dikirim",
      selesai: "Selesai",
      "komplain diajukan": "Komplain Diajukan",
    };
    const c = colors[status || ""] || "bg-zinc-100 text-zinc-600";
    const l = labels[status || ""] || "";
    return <span className={`text-xs font-bold px-2 py-1 rounded-full ${c}`}>{l}</span>;
  };

  const joinedDate = customer ? new Date(customer.createdAt).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }) : "";

  if (loading || !customer) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-zinc-500">Memuat...</p>
        </div>
      );
  }

  return (
    <>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-green-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
            {customer.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-green-800 dark:text-green-200">{customer.name}</h1>
            <p className="text-sm text-zinc-500">📱 {customer.phone}</p>
            <p className="text-xs text-zinc-400 mt-0.5">📅 Bergabung {joinedDate}</p>
          </div>
        </div>

        {/* Menu Tabs */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-green-200 dark:border-green-800 overflow-hidden">
          <div className="grid grid-cols-4 border-b border-green-200 dark:border-green-800">
            {[
              { id: "pesanan" as TabType, label: "Pesanan Saya" },
              { id: "histori" as TabType, label: "Histori" },
              { id: "poin" as TabType, label: "Point Saya" },
              { id: "cart" as TabType, label: "Cart Saya" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === "pesanan" || tab.id === "histori") fetchPesanan();
                }}
                className={`py-4 text-sm font-bold transition-colors ${
                  activeTab === tab.id
                    ? "bg-green-600 text-white"
                    : "text-zinc-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-4 min-h-[300px]">
            {/* PESANAN SAYA */}
            {activeTab === "pesanan" && (
              <div className="space-y-3">
                {loadingPesanan ? (
                  <p className="text-center text-zinc-400 py-10">Memuat pesanan...</p>
                ) : pesananList.filter((o) => !isHistori(o)).length === 0 ? (
                  <div className="text-center py-10 text-zinc-400">
                    <p className="text-4xl mb-2">📦</p>
                    <p>Belum ada pesanan aktif</p>
                    <a href="/catalog" className="text-green-600 hover:underline text-sm mt-2 inline-block">
                      Belanja Sekarang
                    </a>
                  </div>
                ) : (
                  pesananList.filter((o) => !isHistori(o)).map((order) => (
                    <div key={order.orderId} className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 border border-zinc-100 dark:border-zinc-700">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-bold text-zinc-800 dark:text-zinc-200 text-sm">
                            ORD-{order.orderId}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {new Date(
                              typeof order.createdAt === "string"
                                ? order.createdAt
                                : order.createdAt?.seconds
                                ? order.createdAt.seconds * 1000
                                : Date.now()
                            ).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {isCancelledNotPaid(order) ? (
                            <span className="text-xs bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 px-2.5 py-1 rounded-full font-semibold">
                              Cancelled Not Paid
                            </span>
                          ) : order.paymentStatus === "paid" && !order.hasComplaint && !order.komplainSelesai && order.status !== "komplain diajukan" && order.status !== "selesai" && !order.customerMarkedDone && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => { setComplaintOrderId(order.orderId); setComplaintText(""); setComplaintOpen(true); }}
                                className="text-xs bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 px-2.5 py-1 rounded-full font-semibold hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                              >
                                ⚠ Komplain
                              </button>
                              <button
                                onClick={() => handleMarkSelesai(order.orderId)}
                                className="text-xs bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 px-2.5 py-1 rounded-full font-semibold hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                              >
                                ✓ Selesai
                              </button>
                            </div>
                          )}
                          {!isCancelledNotPaid(order) && (
                            order.komplainSelesai ? (
                              <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2.5 py-1 rounded-full font-semibold">
                                Complaint Resolved
                              </span>
                            ) : order.hasComplaint ? (
                              <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2.5 py-1 rounded-full font-semibold">
                                ⚠ Complaint
                              </span>
                            ) : (
                              getStatusBadge(order.status)
                            )
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleExpand(order.orderId)}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          {expandedOrders.includes(order.orderId) ? "▲" : "▼"} Detail
                        </button>
                      </div>
                      {expandedOrders.includes(order.orderId) ? (
                        <div className="mt-2 space-y-1">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="text-sm text-zinc-600 dark:text-zinc-400 flex justify-between">
                              <span>{item.productName || item.name}{item.variantName ? ' (' + item.variantName + ')' : ''} x {item.quantity}</span>
                              <span>Rp{(item.price * item.quantity).toLocaleString("id-ID")}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                          {order.items.length} produk · Rp{order.total.toLocaleString("id-ID")}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* HISTORI */}
            {activeTab === "histori" && (
              <div className="space-y-3">
                {pesananList.filter((o) => isHistori(o)).length === 0 ? (
                  <div className="text-center py-10 text-zinc-400">
                    <p className="text-4xl mb-2">📋</p>
                    <p>Belum ada histori pesanan</p>
                  </div>
                ) : (
                  pesananList.filter((o) => isHistori(o)).map((order) => (
                    <div key={order.orderId} className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 border border-zinc-100 dark:border-zinc-700">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-bold text-zinc-800 dark:text-zinc-200 text-sm">
                            ORD-{order.orderId}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {new Date(
                              typeof order.createdAt === "string"
                                ? order.createdAt
                                : order.createdAt?.seconds
                                ? order.createdAt.seconds * 1000
                                : Date.now()
                            ).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                        <div>
                          {isCancelledNotPaid(order) ? (
                            <span className="text-xs bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 px-2.5 py-1 rounded-full font-semibold">
                              Cancelled Not Paid
                            </span>
                          ) : order.komplainSelesai || order.customerMarkedDone ? (
                            <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2.5 py-1 rounded-full font-semibold">
                              Selesai
                            </span>
                          ) : (
                            getStatusBadge(order.status)
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleExpand(order.orderId)}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          {expandedOrders.includes(order.orderId) ? "▲" : "▼"} Detail
                        </button>
                      </div>
                      {expandedOrders.includes(order.orderId) ? (
                        <div className="mt-2 space-y-1">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="text-sm text-zinc-600 dark:text-zinc-400 flex justify-between">
                              <span>{item.productName || item.name}{item.variantName ? ' (' + item.variantName + ')' : ''} x {item.quantity}</span>
                              <span>Rp{(item.price * item.quantity).toLocaleString("id-ID")}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                          {order.items.length} produk · Rp{order.total.toLocaleString("id-ID")}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* POIN */}
            {activeTab === "poin" && (
              <div className="text-center py-10">
                <div className="inline-block bg-gradient-to-br from-yellow-400 to-orange-500 text-white rounded-2xl p-8 mb-4 shadow-lg">
                  <p className="text-5xl font-black">{customer.points ?? 0}</p>
                  <p className="text-sm opacity-80 mt-1">Points</p>
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Kumpulkan poin dari setiap pesanan!
                </p>
              </div>
            )}

            {/* CART SAYA */}
            {activeTab === "cart" && (
              <CartTab cartItems={cartItems} setCartItems={setCartItems} />
            )}
          </div>
        </div>

        {/* Edit Profil */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-green-200 dark:border-green-800 p-6 space-y-4">
          <h2 className="font-bold text-green-800 dark:text-green-200 border-b border-green-200 dark:border-green-800 pb-2">
            Edit Profil
          </h2>

          <div>
            <label className="text-xs font-semibold text-zinc-500">Nama Lengkap</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              className="w-full p-2.5 border rounded-lg mt-1 dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-green-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-500">No. WhatsApp</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              className="w-full p-2.5 border rounded-lg mt-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed"
              disabled
            />
            <p className="text-xs text-zinc-400 mt-1">Nomor WA tidak dapat diubah</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-zinc-500">Jenis Kelamin<span className="text-red-500 ml-0.5">*</span></label>
              <select
                value={form.gender}
                onChange={(e) => handleChange("gender", e.target.value)}
                className="w-full p-2.5 border rounded-lg mt-1 dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-green-500 focus:outline-none"
              >
                <option value="">Pilih</option>
                <option value="Laki-laki">Laki-laki</option>
                <option value="Perempuan">Perempuan</option>
              </select>
            </div>
            <div>
              <DatePicker
                label="Tanggal Lahir"
                value={form.birthDate}
                onChange={(v) => handleChange("birthDate", v)}
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-500">Alamat Kirim<span className="text-red-500 ml-0.5">*</span></label>
            <textarea
              value={form.address}
              onChange={(e) => handleChange("address", e.target.value)}
              placeholder="Contoh: Jl. Pluit Selatan Raya No.1, RT.4/RW.3, Penjaringan, Kecamatan Penjaringan, Jkt Utara, Daerah Khusus Ibukota Jakarta 14440 (Patokan dekat masjid/indomart.. selengkap mungkin)"
              className="w-full p-2.5 border rounded-lg mt-1 dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-green-500 focus:outline-none h-20 resize-none"
            />
            <p className="text-xs text-zinc-400 mt-1">Tulis alamat lengkap, agar abang kurir gampang nyarinya ya..</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-zinc-500">Kota / Kecamatan<span className="text-red-500 ml-0.5">*</span></label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => handleChange("city", e.target.value)}
                placeholder="Ketik Kota..."
                className="w-full p-2.5 border rounded-lg mt-1 dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-green-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-500">Kode Pos<span className="text-red-500 ml-0.5">*</span></label>
              <input
                type="text"
                value={form.postal_code}
                onChange={(e) => handleChange("postal_code", e.target.value)}
                placeholder="Kode Pos"
                className="w-full p-2.5 border rounded-lg mt-1 dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-green-500 focus:outline-none"
              />
            </div>
          </div>

          <AlamatLainnya
            addresses={customer.alamatLainnya || []}
            onSave={(updated) => updateCustomer({ alamatLainnya: updated })}
          />

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-zinc-400 text-white font-bold py-3 rounded-xl transition-colors"
            >
              {saving ? "Menyimpan..." : saved ? "✓ Tersimpan" : "Simpan Perubahan"}
            </button>
            <button
              onClick={handleLogout}
              className="px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors"
            >
              Keluar
            </button>
          </div>
        </div>

        {/* Ganti Password */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-green-200 dark:border-green-800 p-6 space-y-4">
          <h2 className="font-bold text-green-800 dark:text-green-200 border-b border-green-200 dark:border-green-800 pb-2">
            🔑 Ganti Password
          </h2>

          <div>
            <label className="text-xs font-semibold text-zinc-500">Password Lama</label>
            <input
              type="password"
              value={pwdForm.oldPassword}
              onChange={(e) => handleChangePwd("oldPassword", e.target.value)}
              placeholder="••••••••"
              className="w-full p-2.5 border rounded-lg mt-1 dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-green-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-500">Password Baru</label>
            <input
              type="password"
              value={pwdForm.newPassword}
              onChange={(e) => handleChangePwd("newPassword", e.target.value)}
              placeholder="Minimal 6 karakter"
              className="w-full p-2.5 border rounded-lg mt-1 dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-green-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-500">Konfirmasi Password Baru</label>
            <input
              type="password"
              value={pwdForm.confirmPassword}
              onChange={(e) => handleChangePwd("confirmPassword", e.target.value)}
              placeholder="Ulangi password baru"
              className="w-full p-2.5 border rounded-lg mt-1 dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-green-500 focus:outline-none"
            />
          </div>

          {pwdError && (
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">⚠ {pwdError}</p>
          )}
          {pwdMsg && (
            <p className="text-sm text-green-600 dark:text-green-400 font-medium">{pwdMsg}</p>
          )}

          <button
            onClick={handleGantiPassword}
            disabled={pwdSaving}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-zinc-400 text-white font-bold py-3 rounded-xl transition-colors"
          >
            {pwdSaving ? "Menyimpan..." : "Ganti Password"}
          </button>
        </div>
      </div>

      {/* Modal Komplain */}
      {complaintOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <p className="font-bold text-zinc-800 dark:text-zinc-200">⚠ Komplain Pesanan</p>
              <button onClick={() => setComplaintOpen(false)} className="text-zinc-400 hover:text-zinc-600 text-xl leading-none">✕</button>
            </div>
            <p className="text-xs text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-3 py-2 rounded-lg font-mono">
              ORD-{complaintOrderId}
            </p>
            <div>
              <label className="text-xs font-semibold text-zinc-500 mb-1.5 block">
                Keterangan Komplain<span className="text-red-500 ml-0.5">*</span>
              </label>
              <textarea
                value={complaintText}
                onChange={(e) => setComplaintText(e.target.value)}
                placeholder="Jelaskan masalah pesanan Anda..."
                rows={4}
                className="w-full p-3 border rounded-xl dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-red-400 focus:outline-none text-sm resize-none"
              />
            </div>
            <label className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={sendUnboxingVideo}
                onChange={(e) => setSendUnboxingVideo(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-zinc-300 text-yellow-600 focus:ring-yellow-500"
              />
              <div>
                <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">Kirim video unboxing via chat WA admin</p>
                <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-0.5">Video unboxing akan dikirim ke WhatsApp admin setelah komplain diajukan</p>
              </div>
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setComplaintOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 text-sm font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSendComplaint}
                disabled={!complaintText.trim() || complaintSending}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
              >
                {complaintSending ? "Mengirim..." : "Kirim Komplain"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CartTab({ cartItems, setCartItems }: { cartItems: any[]; setCartItems: (v: any[]) => void }) {
  const updateQuantity = (index: number, delta: number) => {
    const newCart = [...cartItems];
    newCart[index].quantity += delta;
    if (newCart[index].quantity <= 0) {
      newCart.splice(index, 1);
    }
    setCartItems(newCart);
    localStorage.setItem("cart", JSON.stringify(newCart));
  };

  const removeItem = (index: number) => {
    const newCart = cartItems.filter((_, i) => i !== index);
    setCartItems(newCart);
    localStorage.setItem("cart", JSON.stringify(newCart));
  };

  const subtotal = cartItems.reduce((acc, item) => acc + (item.price || 0) * item.quantity, 0);
  const totalWeight = cartItems.reduce((acc, item) => acc + ((item.weight || 200) * item.quantity), 0);

  return (
    <div className="space-y-4">
      {cartItems.length === 0 ? (
        <div className="text-center py-10 text-zinc-400">
          <p className="text-4xl mb-2">🛒</p>
          <p>Keranjang masih kosong</p>
          <a href="/catalog" className="text-green-600 hover:underline text-sm mt-2 inline-block">
            Belanja Sekarang
          </a>
        </div>
      ) : (
        <>
          {cartItems.map((item, idx) => (
            <div key={idx} className="flex gap-3 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-100 dark:border-zinc-700">
              {item.image && (
                <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-700 flex-shrink-0">
                  <img src={item.image} alt={item.productName} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-zinc-800 dark:text-zinc-200 truncate">{item.productName}</p>
                {item.variantName && <p className="text-xs text-zinc-500">{item.variantName}</p>}
                <p className="font-bold text-sm text-zinc-700 dark:text-zinc-300 mt-1">
                  Rp{(item.price || 0).toLocaleString("id-ID")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center border border-zinc-300 dark:border-zinc-600 rounded-lg overflow-hidden">
                  <button onClick={() => updateQuantity(idx, -1)} className="px-2 py-1 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 text-xs font-bold">-</button>
                  <span className="px-2 text-xs font-semibold">{item.quantity}</span>
                  <button onClick={() => updateQuantity(idx, 1)} className="px-2 py-1 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 text-xs font-bold">+</button>
                </div>
                <button onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700 text-xs p-1">✕</button>
              </div>
            </div>
          ))}

          <div className="border-t border-green-200 dark:border-green-800 pt-4 space-y-2 text-sm">
            <div className="flex justify-between text-zinc-500">
              <span>Total Item</span>
              <span>{cartItems.reduce((a, i) => a + i.quantity, 0)} item</span>
            </div>
            <div className="flex justify-between text-zinc-500">
              <span>Estimasi Berat</span>
              <span>{totalWeight} gram</span>
            </div>
            <div className="flex justify-between font-bold text-base pt-2 border-t border-green-200 dark:border-green-800">
              <span>Subtotal</span>
              <span>Rp{subtotal.toLocaleString("id-ID")}</span>
            </div>
          </div>

          <a
            href="/checkout"
            className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors"
          >
            Lanjut ke Checkout
          </a>
        </>
      )}
    </div>
  );
}

interface AlamatItem {
  id: string;
  nama: string;
  noHp: string;
  address: string;
  city: string;
}

function AlamatLainnya({
  addresses,
  onSave,
}: {
  addresses: AlamatItem[];
  onSave: (updated: AlamatItem[]) => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nama: "", noHp: "", address: "", city: "" });
  const [saving, setSaving] = useState(false);

  const set = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const handleSave = async () => {
    if (!form.nama || !form.noHp || !form.address || !form.city) {
      alert("Mohon isi semua field.");
      return;
    }
    setSaving(true);
    try {
      const updated = [
        ...addresses,
        { id: Date.now().toString(), ...form },
      ];
      await onSave(updated);
      setForm({ nama: "", noHp: "", address: "", city: "" });
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const updated = addresses.filter((a) => a.id !== id);
    await onSave(updated);
  };

  return (
    <div className="border-t border-green-200 dark:border-green-800 pt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-green-800 dark:text-green-200 text-sm">📍 Alamat Lainnya</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-bold transition-colors"
        >
          {showForm ? "Tutup" : "+ Tambah Alamat"}
        </button>
      </div>

      {showForm && (
        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 space-y-3 mb-3 border border-zinc-200 dark:border-zinc-700">
          <div>
            <label className="text-xs font-semibold text-zinc-500">Nama Penerima<span className="text-red-500 ml-0.5">*</span></label>
            <input
              type="text"
              value={form.nama}
              onChange={(e) => set("nama", e.target.value)}
              placeholder="Nama lengkap penerima"
              className="w-full p-2.5 border rounded-lg mt-1 dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-green-500 focus:outline-none text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-500">No. WhatsApp<span className="text-red-500 ml-0.5">*</span></label>
            <input
              type="tel"
              value={form.noHp}
              onChange={(e) => set("noHp", e.target.value)}
              placeholder="08xxxxxxxxxx"
              className="w-full p-2.5 border rounded-lg mt-1 dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-green-500 focus:outline-none text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-500">Alamat Lengkap<span className="text-red-500 ml-0.5">*</span></label>
            <textarea
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="Jalan, RT/RW, kelurahan..."
              className="w-full p-2.5 border rounded-lg mt-1 dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-green-500 focus:outline-none text-sm h-16 resize-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-500">Kota / Kecamatan<span className="text-red-500 ml-0.5">*</span></label>
            <input
              type="text"
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              placeholder="Ketik Kota..."
              className="w-full p-2.5 border rounded-lg mt-1 dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-green-500 focus:outline-none text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-zinc-400 text-white font-bold py-2 rounded-lg text-sm transition-colors"
            >
              {saving ? "Menyimpan..." : "Simpan Alamat"}
            </button>
            <button
              onClick={() => { setShowForm(false); setForm({ nama: "", noHp: "", address: "", city: "" }); }}
              className="px-4 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 text-zinc-700 dark:text-zinc-300 font-bold py-2 rounded-lg text-sm transition-colors"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {addresses.length === 0 && !showForm && (
        <p className="text-xs text-zinc-400 italic">Belum ada alamat tambahan.</p>
      )}

      {addresses.map((a) => (
        <div
          key={a.id}
          className="flex items-start justify-between p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-100 dark:border-zinc-700 mb-2"
        >
          <div>
            <p className="font-semibold text-sm text-zinc-800 dark:text-zinc-200">{a.nama}</p>
            <p className="text-xs text-zinc-500">📱 {a.noHp}</p>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">{a.address}</p>
            <p className="text-xs text-zinc-500">{a.city}</p>
          </div>
          <button
            onClick={() => handleDelete(a.id)}
            className="text-red-400 hover:text-red-600 text-sm font-bold ml-3 flex-shrink-0"
          >
            Hapus
          </button>
        </div>
      ))}
    </div>
  );
}
