"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { renderMessageText } from "@/lib/render-message-text";

interface Chat {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  status: string;
  lastMessage: string;
  createdAt: any;
}

interface Message {
  id: string;
  chatId?: string;
  sender: string;
  text: string;
  timestamp: any;
  read: boolean;
}

const POLL_INTERVAL = 2000; // 2 detik polling

export default function AdminChatPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Semua");
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [readChats, setReadChats] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load readChats from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("admin_read_chats");
      if (saved) {
        setReadChats(new Set(JSON.parse(saved)));
      }
    } catch (e) {
      console.error("Gagal load readChats:", e);
    }
  }, []);

  // Save readChats to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem("admin_read_chats", JSON.stringify(Array.from(readChats)));
    } catch (e) {
      console.error("Gagal save readChats:", e);
    }
  }, [readChats]);

  // Poll for all chats every 2 seconds
  useEffect(() => {
    const fetchChats = async () => {
      try {
        const res = await fetch("/api/chat/list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ minutes: 0 }), // ambil semua histori
        });
        const data = await res.json();
        setChats(data.chats || []);
      } catch (e) {
        console.error("Gagal memuat chats:", e);
      }
    };

    fetchChats();
    const interval = setInterval(fetchChats, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // Poll for messages in active chat every 2 seconds
  useEffect(() => {
    if (!activeChat) { setMessages([]); return; }

    const fetchMessages = async () => {
      try {
        const res = await fetch("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId: activeChat, minutes: 0 }),
        });
        const data = await res.json();
        setMessages(data.messages || []);
      } catch (e) {
        console.error("Gagal memuat messages:", e);
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [activeChat]);

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending || !activeChat) return;
    setSending(true);
    setInput("");

    try {
      await fetch("/api/chat/send-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: activeChat, text, sender: "admin" }),
      });
    } catch (e) {
      console.error("Send error:", e);
    } finally {
      setSending(false);
    }
  };

  const fetchProducts = async () => {
    if (products.length > 0) return;
    setLoadingProducts(true);
    try {
      const res = await fetch("/api/products/all");
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : (data.products || []));
    } catch (e) {
      console.error("Gagal load produk:", e);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleSelectProduct = (product: any) => {
    const origin = window.location.origin;
    const productUrl = `${origin}/products/${product.id}`;
    const text = `🛍️ *${product.name}*\n💰 Rp${product.price?.toLocaleString("id-ID")}\n🔗 ${productUrl}`;
    setInput((prev) => (prev ? prev + "\n" + text : text));
    setProductModalOpen(false);
  };

  // Chat status stays "open" by default, no action needed
  // Chat selalu dianggap open, tidak ada fitur close
  const closeChat = async (chatId: string) => {
    // No-op: chat selalu tetap open
  };

  const markAsRead = async (chatId: string) => {
    setReadChats((prev) => new Set(prev).add(chatId));
  };

  const parseTimestamp = (ts: any): Date => {
    if (!ts) return new Date();
    if (ts instanceof Date) return ts;
    if (typeof ts === "number") return new Date(ts);
    if (typeof ts === "string") return new Date(ts);
    if (ts.toDate && typeof ts.toDate === "function") return ts.toDate();
    if (ts._seconds !== undefined) return new Date(ts._seconds * 1000 + (ts._nanoseconds || 0) / 1e6);
    if (ts.seconds !== undefined) return new Date(ts.seconds * 1000 + (ts.nanoseconds || 0) / 1e6);
    return new Date();
  };

  const formatTime = (ts: any) => {
    const d = parseTimestamp(ts);
    return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDateDivider = (ts: any) => {
    const d = parseTimestamp(ts);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Hari Ini";
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Kemarin";
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  };

  const active = chats.find((c) => c.id === activeChat);

  return (
    <div className="flex gap-4 h-[calc(100vh-140px)]">
      {/* Chat List - LEFT side */}
      <div className="w-full md:w-80 bg-white dark:bg-zinc-900 rounded-2xl border border-green-200 dark:border-green-800 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10">
          <h2 className="font-bold text-green-800 dark:text-green-200">💬 Live Chat</h2>
          <p className="text-xs text-zinc-500 mt-1">{chats.length} percakapan</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {chats.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 text-sm">Belum ada chat masuk</div>
          ) : (
            [...chats]
              .sort((a, b) => parseTimestamp(b.createdAt).getTime() - parseTimestamp(a.createdAt).getTime())
              .map((c) => (
              <button
                key={c.id}
                onClick={() => { setActiveChat(c.id); markAsRead(c.id); }}
                className={`w-full text-left px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors ${
                  activeChat === c.id ? "bg-green-50 dark:bg-green-900/20" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 bg-green-600">
                    {(c.userName || c.userPhone || "?").charAt(0).toUpperCase()}
                    {/* Tampilkan badge merah hanya jika chat belum pernah dibuka/dibaca */}
                    {!readChats.has(c.id) && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-zinc-900"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`font-semibold text-sm truncate ${activeChat !== c.id ? "text-zinc-900 dark:text-zinc-100" : "text-green-700"}`}>
                        {c.userName || c.userPhone}
                      </p>
                      <span className="text-xs text-zinc-400 flex-shrink-0 ml-2">
                        {formatDateDivider(c.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 truncate mt-0.5">
                      {c.lastMessage || "Mulai percakapan..."}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Window - RIGHT side */}
      <div className="hidden md:flex flex-1 bg-white dark:bg-zinc-900 rounded-2xl border border-green-200 dark:border-green-800 flex-col overflow-hidden">
        {activeChat ? (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-green-50 dark:bg-zinc-900">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-green-600 flex items-center justify-center text-white text-sm font-bold">
                  {(active?.userName || active?.userPhone || "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                    {active?.userName || active?.userPhone || "?"}
                  </p>
                  <p className="text-xs text-zinc-500">{active?.userPhone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/admin"
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Link>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-zinc-50 dark:bg-zinc-950">
              {messages.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-sm">
                  Belum ada pesan.
                </div>
              ) : (
                messages.map((msg, index) => {
                  const fromAdmin = msg.sender === "admin";
                  
                  // Hitung apakah perlu menampilkan pembatas tanggal/hari
                  let showDateDivider = false;
                  const currentDateStr = parseTimestamp(msg.timestamp).toDateString();
                  if (index === 0) {
                    showDateDivider = true;
                  } else {
                    const prevDateStr = parseTimestamp(messages[index - 1].timestamp).toDateString();
                    if (currentDateStr !== prevDateStr) {
                      showDateDivider = true;
                    }
                  }

                  return (
                    <div key={msg.id || index}>
                      {showDateDivider && (
                        <div className="flex justify-center my-3">
                          <span className="bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs px-3 py-1 rounded-full shadow-sm font-medium">
                            {formatDateDivider(msg.timestamp)}
                          </span>
                        </div>
                      )}
                      <div className={`flex ${fromAdmin ? "justify-start" : "justify-end"} my-1.5`}>
                        <div className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm ${
                          fromAdmin
                            ? "bg-blue-500 text-white rounded-bl-sm"
                            : "bg-green-600 text-white rounded-br-sm"
                        }`}>
                          {renderMessageText(msg.text)}
                          <p className={`text-xs mt-1 text-right ${fromAdmin ? "text-blue-200" : "text-green-200"}`}>
                            {formatTime(msg.timestamp)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input */}
            <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center gap-2 bg-white dark:bg-zinc-950">
              <button
                onClick={() => { setProductModalOpen(true); fetchProducts(); }}
                className="w-9 h-9 bg-zinc-100 dark:bg-zinc-800 hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center font-bold text-lg transition-colors flex-shrink-0"
                title="Kirim Produk"
              >
                +
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Ketik balasan..."
                disabled={sending}
                className="flex-1 text-sm border border-zinc-300 dark:border-zinc-700 rounded-full px-4 py-2 dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={sending || !input.trim()}
                className="w-10 h-10 bg-green-600 hover:bg-green-700 disabled:bg-zinc-400 text-white rounded-full flex items-center justify-center transition-colors flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-400 text-sm">
            Pilih percakapan untuk mulai chat
          </div>
        )}
      </div>

      {/* Product Modal */}
      {productModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col border border-zinc-200 dark:border-zinc-700 shadow-2xl">
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
              <p className="font-bold text-sm text-zinc-800 dark:text-zinc-200">🛍️ Pilih Produk</p>
              <button onClick={() => setProductModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 text-xl leading-none">✕</button>
            </div>
            <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Cari produk..."
                className="w-full text-sm border border-zinc-300 dark:border-zinc-700 rounded-full px-4 py-2 dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {loadingProducts ? (
                <div className="text-center py-8 text-zinc-400 text-sm">Memuat produk...</div>
              ) : products.length === 0 ? (
                <div className="text-center py-8 text-zinc-400 text-sm">Belum ada produk</div>
              ) : (
                products
                  .filter((p) => {
                    if (!productSearch.trim()) return true;
                    return (p.name || "").toLowerCase().includes(productSearch.toLowerCase()) ||
                           (p.category || "").toLowerCase().includes(productSearch.toLowerCase());
                  })
                  .map((product) => (
                    <button
                      key={product.id}
                      onClick={() => handleSelectProduct(product)}
                      className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 text-left transition-colors"
                    >
                      <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex-shrink-0">
                        {product.images?.[0] ? (
                          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-400 text-xs">📷</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">{product.name}</p>
                        <p className="text-xs text-zinc-500">{product.category}</p>
                      </div>
                      <p className="text-sm font-bold text-green-600 dark:text-green-400 flex-shrink-0">
                        Rp{product.price?.toLocaleString("id-ID") || "—"}
                      </p>
                    </button>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
