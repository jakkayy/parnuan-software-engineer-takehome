import { ParsedTransaction, CategoryName, TransactionType } from "../types";

const THAI_NUMBERS_MAP: Record<string, string> = {
  "๐": "0",
  "๑": "1",
  "๒": "2",
  "๓": "3",
  "๔": "4",
  "๕": "5",
  "๖": "6",
  "๗": "7",
  "๘": "8",
  "๙": "9",
};

const INCOME_KEYWORDS = [
  "เงินเดือน",
  "ได้เงิน",
  "แม่ให้",
  "พ่อให้",
  "ขายได้",
  "โอนเข้า",
  "ได้เงินคืน",
  "เงินคืน",
  "ปันผล",
  "โบนัส",
  "รายรับ",
];

const CATEGORY_MAP: Record<string, CategoryName> = {
  ข้าวมันไก่: "อาหาร",
  ข้าว: "อาหาร",
  น้ำเปล่า: "อาหาร",
  น้ำ: "อาหาร",
  กาแฟ: "อาหาร",
  ขนม: "อาหาร",
  ชา: "อาหาร",
  ชาไข่มุก: "อาหาร",
  ชาบู: "อาหาร",
  หมูกระทะ: "อาหาร",
  อาหาร: "อาหาร",
  ก๋วยเตี๋ยว: "อาหาร",

  ช้อปปิ้ง: "ช้อปปิ้ง",
  ซื้อของ: "ช้อปปิ้ง",
  เสื้อผ้า: "ช้อปปิ้ง",
  รองเท้า: "ช้อปปิ้ง",
  กระเป๋า: "ช้อปปิ้ง",
  ของใช้: "ช้อปปิ้ง",
  lazada: "ช้อปปิ้ง",
  shopee: "ช้อปปิ้ง",

  แท็กซี่: "เดินทาง",
  ม้า: "เดินทาง",
  รถไฟฟ้า: "เดินทาง",
  bts: "เดินทาง",
  mrt: "เดินทาง",
  ค่าน้ำมัน: "เดินทาง",
  น้ำมัน: "เดินทาง",
  ค่ารถ: "เดินทาง",

  ค่าน้ำ: "บิล & ค่าน้ำค่าไฟ",
  ค่าไฟ: "บิล & ค่าน้ำค่าไฟ",
  เน็ต: "บิล & ค่าน้ำค่าไฟ",
  ค่าเน็ต: "บิล & ค่าน้ำค่าไฟ",
  ค่าห้อง: "บิล & ค่าน้ำค่าไฟ",
  ค่าคอนโด: "บิล & ค่าน้ำค่าไฟ",

  หนัง: "ความบันเทิง",
  เกม: "ความบันเทิง",
  ตั๋วหนัง: "ความบันเทิง",
  netflix: "ความบันเทิง",
  spotify: "ความบันเทิง",
  เที่ยว: "ความบันเทิง",

  ยา: "สุขภาพ",
  หมอ: "สุขภาพ",
  ค่ารักษา: "สุขภาพ",
  อาหารเสริม: "สุขภาพ",

  เงินเดือน: "รายรับ",
  โบนัส: "รายรับ",
  ปันผล: "รายรับ",
};

function normalizeThaiDigits(text: string): string {
  return text.replace(/[๐-๙]/g, (w) => THAI_NUMBERS_MAP[w] || w);
}

function extractRelativeDateTime(
  text: string,
  referenceTime: Date,
): { date: Date; isTimeExplicit: boolean } {
  const targetDate = new Date(referenceTime);
  let isExplicit = false;

  if (text.includes("เมื่อวานซืน")) {
    targetDate.setDate(targetDate.getDate() - 2);
    isExplicit = true;
  } else if (text.includes("เมื่อวาน")) {
    targetDate.setDate(targetDate.getDate() - 1);
    isExplicit = true;
  }

  const timePatterns = [
    {
      regex: /(\d{1,2})[:.](\d{2})/,
      handler: (m: RegExpMatchArray) => [parseInt(m[1]), parseInt(m[2])],
    },
    {
      regex: /(\d{1,2})\s*โมงครึ่ง/,
      handler: (m: RegExpMatchArray) => {
        let h = parseInt(m[1]);
        if (h <= 5) h += 12;
        return [h, 30];
      },
    },
    {
      regex: /(\d{1,2})\s*ทุ่ม/,
      handler: (m: RegExpMatchArray) => [parseInt(m[1]) + 18, 0],
    },
    {
      regex: /บ่าย\s*(\d{1,2})/,
      handler: (m: RegExpMatchArray) => [parseInt(m[1]) + 12, 0],
    },
    {
      regex: /ตี\s*(\d{1,2})/,
      handler: (m: RegExpMatchArray) => [parseInt(m[1]), 0],
    },
  ];

  for (const p of timePatterns) {
    const match = text.match(p.regex);
    if (match) {
      const [hours, minutes] = p.handler(match);
      targetDate.setHours(hours, minutes, 0, 0);
      isExplicit = true;
      break;
    }
  }

  return { date: targetDate, isTimeExplicit: isExplicit };
}

export function parseWithRules(
  rawText: string,
  referenceTime: Date = new Date(),
): ParsedTransaction[] {
  const normalizedText = normalizeThaiDigits(rawText.trim());
  const { date: parsedDate } = extractRelativeDateTime(
    normalizedText,
    referenceTime,
  );
  const datetimeStr = parsedDate.toISOString();

  const priceAnchorRegex = /(\d+(?:\.\d+)?)\s*(?:บาท|\.-)?/g;

  const matches = Array.from(normalizedText.matchAll(priceAnchorRegex));
  if (matches.length === 0) return [];

  const transactions: ParsedTransaction[] = [];
  let lastIndex = 0;

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const price = parseFloat(match[1]);
    const matchIndex = match.index ?? 0;

    let rawSegment = normalizedText.substring(lastIndex, matchIndex).trim();
    lastIndex = matchIndex + match[0].length;

    let itemName = rawSegment
      .replace(/แล้วก็|และ|,|เมื่อวานซืน|เมื่อวาน|วันนี้|ตอน|ช่วง/g, "")
      .replace(
        /(\d{1,2})[:.](\d{2})|(\d{1,2})\s*(โมงครึ่ง|ทุ่ม|โมง)|บ่าย\s*\d{1,2}|ตี\s*\d{1,2}/g,
        "",
      )
      .trim();

    if (!itemName) {
      itemName = "รายการไม่ระบุชื่อ";
    }

    let type: TransactionType = "รายจ่าย";
    if (
      INCOME_KEYWORDS.some(
        (kw) => rawSegment.includes(kw) || normalizedText.includes(kw),
      )
    ) {
      type = "รายรับ";
    }

    let category: CategoryName = "อื่นๆ";
    let matchedCategoryKeyword = false;

    for (const [kw, cat] of Object.entries(CATEGORY_MAP)) {
      if (itemName.includes(kw)) {
        category = cat;
        matchedCategoryKeyword = true;
        break;
      }
    }

    if (type === "รายรับ") {
      category = "รายรับ";
    }

    let confidence = 0.5;
    if (itemName !== "รายการไม่ระบุชื่อ") confidence += 0.2;
    if (matchedCategoryKeyword) confidence += 0.25;

    transactions.push({
      item_id: `rule-${Date.now()}-${i}`,
      item_name: itemName,
      price: price,
      category: category,
      type: type,
      datetime: datetimeStr,
      parser_source: "RULE_BASED",
      confidence: Math.min(confidence, 0.95),
    });
  }

  return transactions;
}

