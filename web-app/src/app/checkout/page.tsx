"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { config } from "@/config";
import { Pesanan } from "@/lib/pesanan-types";
import Script from "next/script";

// Load Midtrans Snap JS SDK
declare global {
  interface Window {
    snap: any;
  }
}

interface ShippingOption {
  courier: string;
  name: string;
  cost: number;
  estimated: string;
  service?: string;
  service_name?: string;
  service_type?: "instant" | "reguler";
}

interface CitySuggestion {
  id: number | string;
  name: string;
  province: string;
  postal_code?: string;
  type?: string;
}

export default function CheckoutPage() {
  const { customer, loading: authLoading } = useAuth();
  const router = useRouter();
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [inactiveProducts, setInactiveProducts] = useState<string[]>([]);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [shippingRate, setShippingRate] = useState<number>(0);
  const [loadingRate, setLoadingRate] = useState(false);
  const [selectedCourier, setSelectedCourier] = useState<string>("");
  const [selectedService, setSelectedService] = useState<string>("");
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [selectedCityId, setSelectedCityId] = useState<string>("");
  const [selectedAreaId, setSelectedAreaId] = useState<string>("");
  const [destinationLat, setDestinationLat] = useState<number | null>(null);
  const [destinationLng, setDestinationLng] = useState<number | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [customerForm, setCustomerForm] = useState({
    name: "",
    phone: "",
    address: "",
    city: "",
    postal_code: "",
    recipientName: "",
    recipientPhone: "",
  });
  const [shippingError, setShippingError] = useState<string>("");
  const [isPaying, setIsPaying] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [savedOrder, setSavedOrder] = useState<Pesanan | null>(null);
  const [pollingOrderId, setPollingOrderId] = useState<string | null>(null);

  // Poll order status when waiting for payment confirmation (QRIS/VA flow)
  useEffect(() => {
    if (!pollingOrderId || savedOrder) return;
    console.log(`[Polling] Checking status for ${pollingOrderId}...`);
    fetch(`/api/order/status?orderId=${encodeURIComponent(pollingOrderId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.data) {
          const status = data.data.status;
          if (status === "dikemas" || status === "dikirim") {
            console.log("[Polling] Payment confirmed! Status:", status);
            setSavedOrder(prev => prev ? { ...prev, status } : null);
            setPollingOrderId(null);
          } else if (status === "dibatalkan") {
            console.log("[Polling] Order cancelled");
            alert("Pesanan ini sudah dibatalkan.");
            setPollingOrderId(null);
          }
        }
      })
      .catch(console.error);
  }, [pollingOrderId, savedOrder]);


  useEffect(() => {
    if (!authLoading && !customer) {
      router.replace("/auth?redirect=/checkout");
      return;
    }
    if (customer) {
      setCustomerForm({
        name: customer.name,
        phone: customer.phone,
        address: customer.address || "",
        city: customer.city || "",
        postal_code: customer.postal_code || "",
        recipientName: "",
        recipientPhone: "",
      });
      setSelectedAddressId("");
      setShippingRate(0);
    }
  }, [customer, authLoading, router]);

  useEffect(() => {
    const savedCart = JSON.parse(localStorage.getItem("cart") || "[]");
    setCartItems(savedCart);
  }, []);

  // Validasi status produk saat checkout dibuka
  useEffect(() => {
    const checkProductStatus = async () => {
      if (cartItems.length === 0) {
        setCheckingStatus(false);
        return;
      }
      const inactive: string[] = [];
      for (const item of cartItems) {
        try {
          const product = await (await fetch(`/api/products/${item.productId}`)).json();
          if (!product || product.isActive === false) {
            inactive.push(item.productName);
          }
        } catch (e) {
          console.error(`Error checking product ${item.productId}:`, e);
        }
      }
      setInactiveProducts(inactive);
      setCheckingStatus(false);
    };
    checkProductStatus();
  }, [cartItems.length]);

  const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const totalWeight = cartItems.reduce((acc, item) => acc + (item.weight || 200) * item.quantity, 0);

  const handleSelectCourier = (courierCode: string, serviceCode?: string) => {
    setSelectedCourier(courierCode);
    if (serviceCode) setSelectedService(serviceCode);
    const option = shippingOptions.find(o => o.courier === courierCode && (!serviceCode || o.service === serviceCode));
    if (option) {
      setShippingRate(option.cost || 0);
    }
  };

  const fetchCitySuggestions = async (query: string) => {
    setCitySearch(query);
    if (query.length < 2) {
      setCitySuggestions([]);
      return;
    }
    try {
      const res = await fetch("/api/shipping/cities?q=" + encodeURIComponent(query));
      const data = await res.json();
      setCitySuggestions(data.data || []);
      setShowCitySuggestions(true);
    } catch (e) {
      console.error("Gagal fetch city suggestions:", e);
    }
  };

  const handleSelectCity = (city: CitySuggestion) => {
    setCustomerForm({ 
      ...customerForm, 
      city: city.name,
      postal_code: city.postal_code || "",
    });
    // Save city ID for later use in shipping calculation and Midtrans validation
    setSelectedCityId(city.id?.toString() || "");
    setSelectedAreaId(city.id?.toString() || "");
    setCitySearch(city.name);
    setCitySuggestions([]);
    setShowCitySuggestions(false);
    // Reset shipping rate when city changes
    setShippingRate(0);
    setShippingOptions([]);
    setDestinationLat(null);
    setDestinationLng(null);
    setDistanceKm(null);
    setSelectedCourier("");
    setSelectedService("");
    // Trigger real-time calculation
    setTimeout(() => autoCalculateShipping(city.postal_code || "", city.name), 100);
  };

  const autoCalculateShipping = async (postalCode: string, city: string) => {
    if (!postalCode || !customerForm.address) return;
    
    setLoadingRate(true);
    setShippingOptions([]);
    try {
      const shippingRes = await fetch("/api/shipping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination_postal_code: postalCode,
          weight: totalWeight,
          city_name: city,
          city_id: selectedCityId,
        })
      });
      const shippingData = await shippingRes.json();
      if (shippingRes.ok && shippingData.data?.length > 0) {
        setShippingOptions(shippingData.data);
        // Store coordinates for Midtrans validation
        if (shippingData.destination_lat && shippingData.destination_lng) {
          setDestinationLat(shippingData.destination_lat);
          setDestinationLng(shippingData.destination_lng);
        }
        // Show distance info if available
        if (shippingData.distance_km) {
          setDistanceKm(shippingData.distance_km);
          console.log(`[Checkout] Distance to store: ${shippingData.distance_km} km`);
        }
        // Auto-select cheapest option
        const cheapest = shippingData.data.reduce((min: any, r: any) => 
          (r.cost || 0) < (min.cost || 0) ? r : min
        );
        setSelectedCourier(cheapest.courier);
        if (cheapest.service) setSelectedService(cheapest.service);
        setShippingRate(cheapest.cost || 0);
        setLoadingRate(false);
        return;
      } else {
        throw new Error(shippingData.error || "No rates found");
      }
    } catch (e: any) {
      console.error("BiteShip API gagal:", e);
      // Don't show alert for real-time failures - just log
      setLoadingRate(false);
    }
  };

  // Auto-calculate shipping when postal code or address changes (real-time)
  useEffect(() => {
    if (customerForm.postal_code && customerForm.address) {
      autoCalculateShipping(customerForm.postal_code, customerForm.city);
    }
  }, [customerForm.postal_code, customerForm.address]);

  // Auto-fetch city suggestions and calculate shipping on mount if data already populated
  // This handles the case when user has saved profile/default address data
  useEffect(() => {
    // If city and address exist from user profile, pre-fetch city suggestions
    // and try to calculate shipping automatically
    if (customerForm.city && customerForm.address && customerForm.postal_code) {
      console.log("[Checkout Auto-init] City and address pre-populated, triggering fetchCitySuggestions and shipping calculation");

      // Fetch city suggestions based on the pre-filled city name
      const fetchCitySuggestionsOnMount = async () => {
        try {
          const res = await fetch("/api/shipping/cities?q=" + encodeURIComponent(customerForm.city));
          const data = await res.json();
          setCitySuggestions(data.data || []);
          if (data.data && data.data.length > 0) {
            console.log(`[Checkout Auto-init] Found ${data.data.length} city suggestions for "${customerForm.city}"`);
          }
        } catch (e) {
          console.error("[Checkout Auto-init] Failed to fetch city suggestions:", e);
        }
      };

      fetchCitySuggestionsOnMount();

      // Auto-calculate shipping if postal code is available
      if (!loadingRate) {
        autoCalculateShipping(customerForm.postal_code, customerForm.city);
      }
    }
  }, [customerForm.city, customerForm.address, customerForm.postal_code]);

  const generateOrderId = () => {
    return Date.now().toString();
  };

  const handleCheckout = async () => {
    if (!customer) {
      router.replace("/auth?redirect=/checkout");
      return;
    }
    // Proteksi klik ganda dan state reset
    if (isProcessing) return; // tolak klik ganda
    if (!customerForm.name || !customerForm.phone || !customerForm.address || shippingRate === 0) {
      alert("Mohon lengkapi data diri dan hitung ongkir.");
      return;
    }
    // Cegah checkout jika ada produk nonaktif
    if (inactiveProducts.length > 0) {
      alert(`Produk berikut sudah tidak tersedia: ${inactiveProducts.join(", ")}. Silakan hapus dari keranjang.`);
      return;
    }

    setIsProcessing(true);

    // Pre-fetch semua produk ke cache (1 read untuk semua) agar validasi stok tidak baca Firestore per-item
    await fetch("/api/products/all");

    // Validasi stok terhadap Firestore
    for (const item of cartItems) {
      const res = await fetch(`/api/products/${item.productId}`);
      const data = await res.json();
      const product = data.error ? null : data;
      if (!product) {
        alert(`Produk "${item.productName}" tidak ditemukan.`);
        setIsProcessing(false);
        return;
      }
      if (item.variantId) {
        const variant = product.variants?.find((v: any) => v.sku === item.variantId);
        if (!variant) {
          alert(`Varian "${item.variantName}" tidak ditemukan untuk produk "${item.productName}".`);
          setIsProcessing(false);
          return;
        }
        if ((variant.stock || 0) < item.quantity) {
          alert(`⚠️ Stok varian "${item.variantName}" (${product.name}) hanya ${variant.stock} pcs, tidak cukup untuk ${item.quantity} pcs.`);
          setIsProcessing(false);
          return;
        }
      } else {
        if ((product.stock || 0) < item.quantity) {
          alert(`⚠️ Stok "${item.productName}" hanya ${product.stock} pcs, tidak cukup untuk ${item.quantity} pcs.`);
          setIsProcessing(false);
          return;
        }
      }
    }

    const orderId = generateOrderId();
    const total = subtotal + shippingRate;
    const items = cartItems.map((item) => ({
      productName: item.productName,
      variantName: item.variantName,
      sku: item.sku || "",
      parentSku: item.parentSku || "",
      quantity: item.quantity,
      price: item.price,
      weight: item.weight || 200,
      total: item.price * item.quantity
    }));

    const selectedOption = shippingOptions.find(
      o => o.courier === selectedCourier && o.service === selectedService
    );
    const orderData = {
      orderId,
      customerId: customer.phone,
      customerPhone: customer.phone,
      customerName: customerForm.name,
      address: customerForm.address,
      city: customerForm.city,
      postal_code: customerForm.postal_code,
      items,
      subtotal,
      shippingCost: shippingRate,
      courier: selectedCourier || undefined,
      service: selectedService || undefined,
      service_type: selectedOption?.service_type,
      paymentStatus: "non_paid" as "non_paid" | "paid" | "dibatalkan" | undefined,
      total
    };

    try {
      const res = await fetch("/api/pesanan/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });
      const saved = await res.json();
      if (!res.ok) {
        throw new Error(saved.error || "Gagal menyimpan pesanan");
      }
      // Kurangi stok di Firestore
      const stockUpdates = cartItems.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      }));
      await fetch("/api/products/update-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: stockUpdates, mode: "decrease" }),
      });
      setSavedOrder(saved);
      localStorage.removeItem("cart");

      // Dapatkan token Midtrans dari server, lalu gunakan Snap.pay(token) di client
      try {
        console.log("🚀 Calling Midtrans snap API...", { orderId: saved.orderId, amount: saved.total });
        // Find the selected shipping option to get service_type
        const selectedOption = shippingOptions.find(
          o => o.courier === selectedCourier && o.service === selectedService
        );
        // Get the cityId from the selected city
        const cityId = selectedCityId;

        const midtransRes = await fetch("/api/midtrans/snap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: saved.orderId,
            amount: saved.total,
            items: (saved.items || []).map((it: any) => ({
              id: it.sku || it.productName,
              name: it.productName || it.name,
              quantity: it.quantity,
              price: it.price,
            })),
            customerName: saved.customerName,
            customerPhone: saved.customerPhone,
            address: saved.address,
            city: saved.city,
            postal_code: saved.postal_code,
            courier: saved.courier,
            service: saved.service,
            // Shipping validation fields for backend guard
            shippingCourier: selectedCourier,
            shippingService: selectedService,
            shippingServiceType: selectedOption?.service_type || "reguler",
            destinationLat: destinationLat,
            destinationLng: destinationLng,
            cityId: cityId,
          }),
        });
        const midtransData = await midtransRes.json();
        console.log("Midtrans response:", midtransData);

        if (!midtransRes.ok || !midtransData.token) {
          console.error("Midtrans error:", midtransData);
          const errMsg = midtransData.error || "Midtrans error";
          alert("Gagal membuat payment token: " + errMsg);
          setIsProcessing(false);
          return;
        }

        // Jika Snap SDK tidak tersedia, fallback ke redirect
        if (typeof window === "undefined" || !window.snap) {
          console.warn("⚠️ Snap SDK tidak tersedia, melakukan redirect ke Midtrans");
          if (midtransData.redirect_url) {
            window.location.href = midtransData.redirect_url;
          }
          setIsProcessing(false);
          return;
        }

        // Tunggu Snap SDK siap (maks 5 detik)
        let snapReady = false;
        for (let i = 0; i < 50 && !snapReady; i++) {
          await new Promise(r => setTimeout(r, 100));
          snapReady = !!window.snap;
        }

        if (window.snap) {
          console.log("✅ Snap SDK ready, opening...");
          window.snap.pay(midtransData.token, {
            onSuccess: async function (result: any) {
              console.log("Pembelian sukses:", result);
              setSavedOrder(saved);
              setIsProcessing(false);

              // Panggil webhook langsung agar Biteship waybill dibuat & status diupdate
              try {
                const webhookRes = await fetch("/api/midtrans/webhook", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    order_id: saved.orderId,
                    transaction_status: "settlement",
                    fraud_status: "accept",
                    payment_type: result.payment_type,
                    transaction_time: new Date().toISOString(),
                    gross_amount: String(saved.total),
                    signature_key: result.signature,
                  }),
                });
                if (webhookRes.ok) {
                  console.log("[Checkout] Webhook called successfully");
                } else {
                  console.warn("[Checkout] Webhook failed:", webhookRes.status);
                }
              } catch (whErr) {
                console.error("[Checkout] Webhook error:", whErr);
              }
            },
            onError: function (err: any) {
              console.error("Snap error:", err);
              if (midtransData.redirect_url) {
                window.location.href = midtransData.redirect_url;
              }
              setIsProcessing(false);
            },
            onClose: function () {
              console.log("User menutup Snap");
              setIsProcessing(false);
              // Start polling for payment status (QRIS/VA flow)
              if (savedOrder?.orderId) {
                console.log("[Snap onClose] Starting status polling for", savedOrder.orderId);
                setPollingOrderId(savedOrder.orderId);
              }
            }
          });
        } else {
          console.warn("⚠️ Snap SDK timeout, redirect ke Midtrans");
          if (midtransData.redirect_url) {
            window.location.href = midtransData.redirect_url;
          }
          setIsProcessing(false);
        }
      } catch (midtransErr) {
        console.error("❌ Midtrans error:", midtransErr);
        setIsProcessing(false);
      }
    } catch (e) {
      console.error("Gagal simpan pesanan:", e);
      setSavedOrder({ ...orderData, createdAt: null } as Pesanan);
      setIsProcessing(false);
    } finally {
      // Ensure processing flag reset in case of early returns
      // (already handled in many branches, but final safeguard)
      // Note: If the flow succeeded and Snap UI takes over, we keep the flag until callbacks reset.
    }
  };

  const sendToWhatsApp = () => {
    const lastDigits = savedOrder?.orderId?.slice(-3) || "000";
    let message = `Halo ${config.brandName}, saya sudah melakukan pembayaran.\n\n`;
    message += `Kode Pesanan: ORD-${savedOrder?.orderId}\n`;
    message += `Nama: ${savedOrder?.customerName}\n`;
    message += `Total Transfer: Rp${(savedOrder?.total || subtotal).toLocaleString("id-ID")}\n`;
    message += `3 digit terakhir: ${lastDigits}\n\n`;
    message += `Detail Pesanan:\n`;
    (savedOrder?.items || []).forEach((item, idx) => {
      message += `${idx + 1}. ${item.productName || item.name} (${item.variantName}) - ${item.quantity}x @ Rp${item.price.toLocaleString("id-ID")} = Rp${item.total.toLocaleString("id-ID")}\n`;
    });
    message += `\nSubtotal: Rp${subtotal.toLocaleString("id-ID")}`;
    message += `\nOngkir: Rp${shippingRate.toLocaleString("id-ID")}`;
    message += `\nTotal: Rp${(subtotal + shippingRate).toLocaleString("id-ID")}\n\n`;
    message += `Mohon segera diproses. Terima kasih!`;

    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${config.whatsappNumber}?text=${encoded}`, "_blank");
  };

  // ===== LOADING STATE =====
  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-zinc-500">Memuat...</p>
      </div>
    );
  }

  // ===== NOT LOGGED IN =====
  if (!customer) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-4">Anda harus masuk terlebih dahulu untuk checkout.</p>
        <a href="/auth" className="inline-block bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-3 rounded-xl transition-colors">
          Masuk / Daftar
        </a>
      </div>
    );
  }

  // ===== PAYMENT SCREEN =====
  if (savedOrder) {
    const last3 = savedOrder.orderId.slice(-3);
    return (
      <div className="max-w-md mx-auto space-y-6">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-green-200 dark:border-green-800 p-6 text-center space-y-4">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto">
            <span className="text-3xl">✅</span>
          </div>
          <h1 className="text-xl font-bold text-green-800 dark:text-green-200">
            Pesanan <span className="font-mono">ORD-{savedOrder.orderId}</span> harus dibuat!
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Selesaikan pembayaran dalam <strong className="text-green-600">24 jam</strong>, jika tidak stok otomatis dilepas kembali.
          </p>

          <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl p-5 space-y-3">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Total transfer (sudah termasuk kode unik)</p>
            <p className="text-3xl font-black text-green-700 dark:text-green-300">
              Rp{savedOrder.total.toLocaleString("id-ID")}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              3 digit terakhir (<strong className="text-green-600">{last3}</strong>) wajib persis, buat pencocokan otomatis
            </p>
            <div className="pt-2 border-t border-green-200 dark:border-green-800 text-xs text-zinc-500 dark:text-zinc-400 text-left">
              <p>Subtotal: Rp{savedOrder.subtotal.toLocaleString("id-ID")}</p>
              <p>Ongkir ({savedOrder.courier?.toUpperCase() || "Reguler"}{savedOrder.service ? ` - ${savedOrder.service}` : ""}): Rp{savedOrder.shippingCost.toLocaleString("id-ID")}</p>
            </div>
          </div>

          {/* REKENING */}
          <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 text-left space-y-2">
            <p className="font-semibold text-sm text-zinc-700 dark:text-zinc-300">Transfer ke:</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                BSI
              </div>
              <div>
                <p className="font-bold text-zinc-800 dark:text-zinc-200">BSI</p>
                <p className="text-xs text-zinc-500">a.n. {config.rekening.nama}</p>
                <p className="font-mono font-bold text-green-700 dark:text-green-300">{config.rekening.nomor}</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Setelah transfer, kirim screenshot bukti pembayaran ke WhatsApp admin beserta kode pesanan <strong>ORD-{savedOrder.orderId}</strong>
          </p>

          <button
            onClick={sendToWhatsApp}
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-4 rounded-xl transition-colors text-base"
          >
            Kirim Bukti Transfer via WhatsApp
          </button>

          <button
            onClick={() => { localStorage.removeItem("cart"); window.location.href = "/"; }}
            className="w-full text-sm text-zinc-500 hover:text-green-600 py-2"
          >
            Selesai
          </button>
        </div>
      </div>
    );
  }

  // ===== CHECKOUT FORM =====
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Script
        src="https://app.sandbox.midtrans.com/snap/snap.js"
        data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || ""}
        strategy="afterInteractive"
      />
      <h1 className="text-2xl font-bold text-green-800 dark:text-green-200">Checkout Pesanan</h1>

      {/* Peringatan produk nonaktif */}
      {inactiveProducts.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-red-500 text-lg">⚠️</span>
            <div>
              <p className="font-semibold text-red-700 dark:text-red-400">
                Produks berikut sudah tidak tersedia:
              </p>
              <ul className="mt-1 text-sm text-red-600 dark:text-red-300 list-disc list-inside">
                {inactiveProducts.map((name, i) => (
                  <li key={i}>{name}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                Silakan kembali ke keranjang dan menghapus produk tersebut terlebih dahulu.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* FORM */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-green-200 dark:border-green-800 space-y-4">
          <h2 className="font-bold text-green-800 dark:text-green-200 border-b border-green-200 dark:border-green-800 pb-2">Detail Pengiriman</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-zinc-500">Nama Penerima</label>
              <input
                type="text"
                placeholder="Nama Lengkap"
                className="w-full p-2.5 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-green-500 focus:outline-none"
                value={customerForm.name}
                onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
              />
              <p className="text-xs text-zinc-400 mt-1">Sesuai dengan akun Anda</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-500">No. WhatsApp</label>
              <input
                type="tel"
                placeholder="08xxxx"
                className="w-full p-2.5 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-green-500 focus:outline-none"
                value={customerForm.phone}
                onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
              />
            </div>
            <div className="relative">
              <label className="text-xs font-semibold text-zinc-500">Kota/Kecamatan</label>
              <input
                type="text"
                placeholder="Ketik nama kota/kecamatan (contoh: Pluit, Jakarta...)"
                className="w-full p-2.5 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-green-500 focus:outline-none"
                value={customerForm.city}
                onChange={(e) => {
                  setCustomerForm({ ...customerForm, city: e.target.value, postal_code: "" });
                  fetchCitySuggestions(e.target.value);
                }}
                onBlur={() => setTimeout(() => setShowCitySuggestions(false), 200)}
                onFocus={() => { if (citySuggestions.length > 0) setShowCitySuggestions(true); }}
              />
              {showCitySuggestions && citySuggestions.length > 0 && (
                <ul className="absolute z-20 w-full mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {citySuggestions.map((city: CitySuggestion, idx: number) => (
                    <li key={idx}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSelectCity(city)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-green-50 dark:hover:bg-green-900/30 border-b border-zinc-100 dark:border-zinc-700 last:border-b-0"
                      >
                        <p className="font-medium text-zinc-800 dark:text-zinc-200 text-xs">
                          {city.name}
                        </p>
                        <p className="text-[10px] text-zinc-400">
                          {city.province} {city.postal_code ? `• Kode Pos: ${city.postal_code}` : ""}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-500">Kode Pos</label>
              <input
                type="text"
                placeholder="Kode Pos (otomatis/manual)"
                className="w-full p-2.5 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-green-500 focus:outline-none"
                value={customerForm.postal_code}
                onChange={(e) => setCustomerForm({ ...customerForm, postal_code: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-500">Alamat Lengkap</label>
              <textarea
                placeholder="Nama jalan, nomor rumah, RT/RW..."
                className="w-full p-2.5 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-green-500 focus:outline-none h-24 resize-none"
                value={customerForm.address}
                onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
              />
            </div>

            {/* Pilih Alamat Tersimpan */}
            {(customer.alamatLainnya || []).length > 0 && (
              <div className="border-t border-green-200 dark:border-green-800 pt-3">
                <label className="text-xs font-semibold text-zinc-500 mb-2 block">Pilih Alamat Tersimpan</label>
                <div className="space-y-2">
                  {/* Alamat default */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAddressId("");
                      setShippingRate(0);
                      setCustomerForm({
                        name: customer.name,
                        phone: customer.phone,
                        address: customer.address || "",
                        city: customer.city || "",
                        postal_code: "",
                        recipientName: "",
                        recipientPhone: "",
                      });
                    }}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                      selectedAddressId === ""
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                        : "border-zinc-200 dark:border-zinc-700"
                    }`}
                  >
                    <p className="font-semibold text-sm text-zinc-800 dark:text-zinc-200">📍 Alamat Profil</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{customer.address || customer.city}</p>
                  </button>
                  {/* Alamat tersimpan */}
                  {(customer.alamatLainnya as any[]).map((a: any) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        setSelectedAddressId(a.id);
                        setShippingRate(0);
                        setCustomerForm({
                          name: a.nama,
                          phone: a.noHp,
                          address: a.address,
                          city: a.city,
                          postal_code: "",
                          recipientName: "",
                          recipientPhone: "",
                        });
                      }}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                        selectedAddressId === a.id
                          ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                          : "border-zinc-200 dark:border-zinc-700"
                      }`}
                    >
                      <p className="font-semibold text-sm text-zinc-800 dark:text-zinc-200">{a.nama}</p>
                      <p className="text-xs text-zinc-500">📱 {a.noHp}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{a.address}, {a.city}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Pilihan Kurir & Service - muncul setelah hitung ongkir */}
            {shippingOptions.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-zinc-500 mb-2 block">Pilih Kurir & Layanan</label>
                <select
                  value={selectedCourier + "|" + (selectedService || "")}
                  onChange={(e) => {
                    const [courier, service] = e.target.value.split("|");
                    handleSelectCourier(courier, service || undefined);
                  }}
                  className="w-full p-3 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-medium focus:border-green-500 focus:outline-none"
                >
                  <option value="">-- Pilih Kurir --</option>
                  {shippingOptions.map((opt: ShippingOption, idx: number) => {
                    const courierName = opt.name || opt.courier || "KURIR";
                    const cost = opt.cost || 0;
                    const estimated = opt.estimated || "1-3 hari";
                    const serviceType = opt.service_type || "reguler";
                    const serviceName = opt.service_name || opt.service || "";
                    const uniqueKey = `${opt.courier}-${opt.service || 'default'}-${idx}`;
                    const icon = serviceType === "instant" ? "⚡" : "📦";
                    return (
                      <option key={uniqueKey} value={opt.courier + "|" + (opt.service || "")}>
                        {icon} {courierName}{serviceName ? ` - ${serviceName}` : ""} | Rp{cost.toLocaleString("id-ID")} ({estimated})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* Distance Info & Loading Indicator */}
            {loadingRate && (
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                Menghitung ongkir...
              </div>
            )}
            {distanceKm !== null && distanceKm > 20 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  ⚠️ Jarak ke toko: <strong>{distanceKm} km</strong> (melebihi 20 km). Kurir instan/same-day tidak tersedia untuk jarak ini. Hanya layanan reguler atau kargo yang dapat dipilih.
                </p>
              </div>
            )}
            {distanceKm !== null && distanceKm <= 20 && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                <p className="text-xs text-green-700 dark:text-green-300">
                  ✅ Dalam jangkauan kurir instan ({distanceKm} km dari toko).
                </p>
              </div>
            )}
          </div>
        </div>

        {/* SUMMARY */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-green-200 dark:border-green-800 space-y-6 flex flex-col">
          <h2 className="font-bold text-green-800 dark:text-green-200 border-b border-green-200 dark:border-green-800 pb-2">Ringkasan Pesanan</h2>

          <div className="flex-1 space-y-3 overflow-y-auto max-h-[300px]">
            {cartItems.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="text-zinc-600 dark:text-zinc-400 w-2/3">
                  {item.quantity}x {item.productName} ({item.variantName})
                </span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  Rp{(item.price * item.quantity).toLocaleString("id-ID")}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-green-200 dark:border-green-800 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">Subtotal</span>
              <span>Rp{subtotal.toLocaleString("id-ID")}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">
                Ongkir (Est. {totalWeight}g{selectedCourier ? ` - ${selectedCourier.toUpperCase()}` : ""}{selectedService ? ` (${selectedService})` : ""})
              </span>
              <span>{shippingRate > 0 ? `Rp${shippingRate.toLocaleString("id-ID")}` : "Belum dihitung"}</span>
            </div>
            <div className="flex justify-between font-extrabold text-lg pt-2 border-t border-green-200 dark:border-green-800 text-green-700 dark:text-green-300">
              <span>Total Akhir</span>
              <span>Rp{(subtotal + shippingRate).toLocaleString("id-ID")}</span>
            </div>
          </div>

          <button
            onClick={handleCheckout}
            disabled={shippingRate === 0 || isProcessing || inactiveProducts.length > 0}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-zinc-400 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl shadow-lg shadow-green-600/30 transition-all"
          >
            Buat Pesanan
          </button>
        </div>
      </div>
    </div>
  );
}