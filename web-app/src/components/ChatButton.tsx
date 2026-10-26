"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { renderMessageText } from "@/lib/render-message-text";

const POLL_INTERVAL = 2000; // 2 detik polling
const PRELOAD_STORAGE_KEY = "chat_preload_msg";

function parseTimestamp(ts: any): Date {
  if (!ts) return new Date();
  if (ts instanceof Date) return ts;
  if (typeof ts === "string") return new Date(ts);
  if (ts._seconds !== undefined) return new Date(ts._seconds * 1000);
  if (ts.seconds !== undefined) return new Date(ts.seconds * 1000);
  return new Date();
}

function formatTime(ts: any): string {
  const d = parseTimestamp(ts);
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function formatDateDivider(ts: any): string {
  const d = parseTimestamp(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Hari Ini";
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Kemarin";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export default function ChatButton() {
  const { customer, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [productReferral, setProductReferral] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Chat session ID = customer phone
  const chatId = customer?.phone || "anon";

  // Auto open chat with pre-filled product message from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(PRELOAD_STORAGE_KEY);
    if (stored) {
      try {
        const { msg, id } = JSON.parse(stored);
        setProductReferral(id || null);
        setInput(msg);
        setOpen(true);
        localStorage.removeItem(PRELOAD_STORAGE_KEY);
      } catch (e) {
        localStorage.removeItem(PRELOAD_STORAGE_KEY);
      }
    }
  }, []);

  // Listen for "Chat Produk Ini" event from product page
  useEffect(() => {
    const handler = () => {
      const stored = localStorage.getItem(PRELOAD_STORAGE_KEY);
      if (stored) {
        try {
          const { msg, id } = JSON.parse(stored);
          setProductReferral(id || null);
          setInput(msg);
          setOpen(true);
          localStorage.removeItem(PRELOAD_STORAGE_KEY);
        } catch (e) {
          localStorage.removeItem(PRELOAD_STORAGE_KEY);
        }
      }
    };
    window.addEventListener("chat_product_request", handler);
    return () => window.removeEventListener("chat_product_request", handler);
  }, []);

  // Poll for messages every 2 seconds
  useEffect(() => {
    if (!open) return;

    const fetchMessages = async () => {
      try {
        const res = await fetch("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId, minutes: 0 }),
        });
        const data = await res.json();
        setMessages(data.messages || []);
      } catch (e) {
        console.error("Chat fetch error:", e);
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [open, chatId]);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Create chat if not exists
  useEffect(() => {
    if (!open || !chatId) return;
    // Create chat on first open
    fetch("/api/chat/send-customer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId,
        text: "",
        userName: customer?.name || "Tamu",
        userPhone: chatId,
      }),
    });
  }, [open]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");

    try {
      await fetch("/api/chat/send-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, text, userName: customer?.name || "Tamu", userPhone: chatId }),
      });
    } catch (e) {
      console.error("Send message error:", e);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Chat Window - dibuka otomatis oleh event chat_product_request */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setOpen(false)}
          />
          {/* Window */}
          <div className="fixed bottom-20 right-6 z-50 w-[calc(100vw-3rem)] sm:w-[380px] h-[500px] sm:h-[560px] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-green-200 dark:border-green-800 sm:bottom-6">
            {/* Header */}
            <div className="bg-green-600 text-white px-4 py-3 flex items-center gap-3 flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
                B
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">Botamp.id Support</p>
                <p className="text-xs text-green-200 flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-400 rounded-full inline-block animate-pulse"></span>
                  Online
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-white/80 hover:text-white p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-zinc-50 dark:bg-zinc-950"
            >
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2">💬</div>
                  <p className="text-zinc-500 text-sm">Mulai chat dengan kami</p>
                  <p className="text-zinc-400 text-xs mt-1">Kirim pesan, kami akan membalas secepatnya.</p>
                </div>
              )}
              {messages.map((msg, index) => {
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
                      <div
                        className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                          fromAdmin
                            ? "bg-blue-500 text-white rounded-bl-sm"
                            : "bg-green-600 text-white rounded-br-sm"
                        }`}
                      >
                        {renderMessageText(msg.text)}
                        <p className={`text-xs mt-1 text-right ${fromAdmin ? "text-blue-200" : "text-green-200"}`}>
                          {formatTime(msg.timestamp)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {sending && (
                <div className="flex justify-end">
                  <div className="bg-green-600 text-white px-3 py-2 rounded-2xl rounded-br-sm text-sm">
                    Mengirim...
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-zinc-200 dark:border-zinc-800 px-3 py-3 flex gap-2 bg-white dark:bg-zinc-900 flex-shrink-0">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ketik pesan..."
                className="flex-1 text-sm border border-zinc-300 dark:border-zinc-700 rounded-full px-4 py-2 dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
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
          </div>
        </>
      )}
    </>
  );
}
