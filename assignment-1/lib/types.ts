export type TransactionType = "รายจ่าย" | "รายรับ";

export type ParserSource = "LLM" | "RULE_BASED" | "HYBRID";

export const DEFAULT_CATEGORIES = [
  "อาหาร",
  "ช้อปปิ้ง",
  "เดินทาง",
  "บิล & ค่าน้ำค่าไฟ",
  "ความบันเทิง",
  "สุขภาพ",
  "รายรับ",
  "อื่นๆ",
] as const;

export type CategoryName = (typeof DEFAULT_CATEGORIES)[number];

export interface ParsedTransaction {
  item_id: string;
  item_name: string;
  price: number;
  category: CategoryName;
  type: TransactionType;
  datetime: string;
  parser_source: ParserSource;
  confidence: number;
}

export interface ParseResult {
  raw_text: string;
  processed_at: string;
  transactions: ParsedTransaction[];
}
