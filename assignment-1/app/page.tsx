"use client";

import { useState } from "react";
import {
  ParsedTransaction,
  ParseResult,
  DEFAULT_CATEGORIES,
  CategoryName,
} from "@/lib/types";
import { Send, Pencil, X, Check, RefreshCw, Share2, Sparkles, Zap } from "lucide-react";

// Preset Demo Cases ตามโจทย์กำหนด
const DEMO_CASES = [
  { label: "1. รายการเดียว", text: "ข้าวมันไก่ 50" },
  {
    label: "2. หลายรายการ",
    text: "ข้าวมันไก่ 50 น้ำเปล่า 7 แล้วก็ช้อปปิ้ง 500",
  },
  {
    label: "3. อ้างอิงเวลา",
    text: "เมื่อวานตอน 5 โมงครึ่ง ข้าวมันไก่ 50",
  },
];

export default function Home() {
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State สำหรับการแก้ไข Inline Edit
  const [editForm, setEditForm] = useState<{
    item_name: string;
    price: number;
    category: CategoryName;
  }>({
    item_name: "",
    price: 0,
    category: "อื่นๆ",
  });

  const handleParse = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim()) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error("Failed to parse text");

      const data: ParseResult = await res.json();
      setParseResult(data);
      if (textToSend) setInputText(textToSend);
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการแกะข้อความ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteItem = (itemId: string) => {
    if (!parseResult) return;
    const updated = parseResult.transactions.filter(
      (tx) => tx.item_id !== itemId
    );
    setParseResult({
      ...parseResult,
      transactions: updated,
    });
  };

  const handleStartEdit = (tx: ParsedTransaction) => {
    setEditingId(tx.item_id);
    setEditForm({
      item_name: tx.item_name,
      price: tx.price,
      category: tx.category as CategoryName,
    });
  };

  const handleSaveEdit = (itemId: string) => {
    if (!parseResult) return;
    const updated = parseResult.transactions.map((tx) => {
      if (tx.item_id === itemId) {
        return {
          ...tx,
          item_name: editForm.item_name,
          price: editForm.price,
          category: editForm.category,
        };
      }
      return tx;
    });

    setParseResult({
      ...parseResult,
      transactions: updated,
    });
    setEditingId(null);
  };

  // Helper สำหรับจัดกลุ่มธุรกรรมตาม Category
  const groupedTransactions = parseResult?.transactions.reduce(
    (acc, tx) => {
      if (!acc[tx.category]) acc[tx.category] = [];
      acc[tx.category].push(tx);
      return acc;
    },
    {} as Record<string, ParsedTransaction[]>
  );

  // แปลง ISO DateTime ให้เป็นรูปแบบภาษาไทยสไตล์ Parnuan (เช่น "8 เม.ย. 2569 13:58")
  const formatThaiDateTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const thaiMonths = [
        "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
        "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
      ];
      const day = date.getDate();
      const month = thaiMonths[date.getMonth()];
      const year = date.getFullYear() + 543; // แปลง ค.ศ. เป็น พ.ศ.
      const hours = date.getHours().toString().padStart(2, "0");
      const minutes = date.getMinutes().toString().padStart(2, "0");
      return `${day} ${month} ${year} ${hours}:${minutes}`;
    } catch {
      return isoString;
    }
  };

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-800 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header Title */}
        <div className="text-center space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight">
            Parnuan Personal Finance
          </h1>
          <p className="text-sm text-neutral-500 font-medium">
            แปลงข้อความภาษาธรรมชาติเป็นรายการบันทึกการเงินอัตโนมัติ
          </p>
        </div>

        {/* Input Chat Box (Light Theme) */}
        <div className="bg-white rounded-2xl p-2.5 border border-neutral-200/80 flex items-center gap-2 shadow-sm focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleParse()}
            placeholder="พิมพ์ข้อความบันทึกการเงิน เช่น ข้าวมันไก่ 50..."
            className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none placeholder-neutral-400 text-neutral-800"
          />
          <button
            onClick={() => handleParse()}
            disabled={isLoading || !inputText.trim()}
            className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white p-2.5 rounded-xl transition disabled:opacity-40 flex items-center justify-center shadow-sm"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Parsed Result View (การ์ดสไตล์ Parnuan เหมือนใน Screenshot) */}
        {parseResult && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* กล่องการ์ดใหญ่สไตล์ Parnuan Creamy Theme */}
            <div className="bg-[#FFFDF7] text-neutral-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-6 border border-amber-100/60 overflow-hidden relative">
              {/* Card Header & Status */}
              <div className="flex items-center justify-between border-b border-amber-200/40 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-neutral-900">
                      จดสำเร็จ
                    </h2>
                    <span className="text-lg">✅</span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    อย่าลืมตรวจสอบรายการที่จดด้วยนะคะ
                  </p>
                </div>
                {/* Visual Avatar / Mascot Placeholder */}
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-xl shadow-inner">
                  👵🏻
                </div>
              </div>

              {/* Transaction Items Grouped by Category */}
              {parseResult.transactions.length === 0 ? (
                <div className="text-center py-6 text-neutral-400 text-sm">
                  ไม่พบรายการธุรกรรมในข้อความนี้
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupedTransactions || {}).map(
                    ([categoryName, items]) => (
                      <div key={categoryName} className="space-y-3">
                        {/* Category Header Bar */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="bg-rose-500 text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full shadow-sm">
                              รายจ่าย
                            </span>
                            <span className="text-base font-bold text-neutral-800">
                              - {categoryName}
                            </span>
                          </div>
                          <button className="text-rose-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition">
                            <Share2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Item Cards within Category */}
                        <div className="space-y-3 pl-1">
                          {items.map((tx) => (
                            <div
                              key={tx.item_id}
                              className="group bg-white rounded-2xl p-3.5 border border-amber-100/80 shadow-sm hover:shadow transition space-y-2"
                            >
                              {/* View Mode or Edit Mode */}
                              {editingId === tx.item_id ? (
                                /* Inline Edit Form */
                                <div className="space-y-2 pt-1">
                                  <div className="grid grid-cols-2 gap-2">
                                    <input
                                      type="text"
                                      value={editForm.item_name}
                                      onChange={(e) =>
                                        setEditForm({
                                          ...editForm,
                                          item_name: e.target.value,
                                        })
                                      }
                                      className="bg-neutral-50 border border-neutral-300 text-neutral-800 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                      placeholder="ชื่อรายการ"
                                    />
                                    <input
                                      type="number"
                                      value={editForm.price}
                                      onChange={(e) =>
                                        setEditForm({
                                          ...editForm,
                                          price: Number(e.target.value),
                                        })
                                      }
                                      className="bg-neutral-50 border border-neutral-300 text-neutral-800 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                      placeholder="ราคา"
                                    />
                                  </div>
                                  <div className="flex items-center justify-between gap-2 pt-1">
                                    <select
                                      value={editForm.category}
                                      onChange={(e) =>
                                        setEditForm({
                                          ...editForm,
                                          category: e.target
                                            .value as CategoryName,
                                        })
                                      }
                                      className="bg-neutral-50 border border-neutral-300 text-neutral-800 text-xs rounded-lg px-2 py-1 focus:outline-none"
                                    >
                                      {DEFAULT_CATEGORIES.map((cat) => (
                                        <option key={cat} value={cat}>
                                          {cat}
                                        </option>
                                      ))}
                                    </select>

                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() =>
                                          handleSaveEdit(tx.item_id)
                                        }
                                        className="bg-emerald-600 text-white p-1.5 rounded-lg hover:bg-emerald-700 transition"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => setEditingId(null)}
                                        className="bg-neutral-200 text-neutral-700 p-1.5 rounded-lg hover:bg-neutral-300 transition"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                /* Normal View Mode */
                                <>
                                  <div className="text-[11px] font-medium text-neutral-400">
                                    {formatThaiDateTime(tx.datetime)}
                                  </div>

                                  <div className="flex items-center justify-between">
                                    <span className="text-base font-semibold text-neutral-800">
                                      {tx.item_name}
                                    </span>

                                    <div className="flex items-center gap-3">
                                      <span className="text-lg font-bold text-rose-500">
                                        ฿{tx.price}
                                      </span>

                                      {/* Review Controls: Edit & Delete Buttons */}
                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={() => handleStartEdit(tx)}
                                          title="แก้ไขรายการ"
                                          className="p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-600 transition"
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={() =>
                                            handleDeleteItem(tx.item_id)
                                          }
                                          title="ลบรายการ"
                                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-500 transition"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
