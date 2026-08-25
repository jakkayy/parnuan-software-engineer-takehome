# Parnuan — Text → Transaction Flow (Proof of Concept)

A Proof of Concept (PoC) demonstrating how free-form Thai natural language text messages are transformed into structured financial transactions, allowing users to inspect, edit, and confirm results prior to final logging.

---

## Part 1 — Reverse-Engineered Behavior & Assumptions

### 1. Inferred Behavior (Inferred from Screenshots)

- **Multi-Transaction Support**: A single text message can produce one or multiple transaction items (e.g., `"ข้าวมันไก่ 50 น้ำเปล่า 7 แล้วก็ช้อปปิ้ง 500"` generates 3 separate items).
- **Relative & Implicit Time Parsing**: Explicit or relative time phrases (e.g., `"เมื่อวานตอน 5 โมงครึ่ง"`) are parsed into ISO timestamps. Messages without specified times default to the current system message timestamp.
- **Category Classification**: Items are automatically categorized into structured groups (`อาหาร`, `ช้อปปิ้ง`, `เดินทาง`, etc.).
- **Reviewable Output**: Parsed items are rendered into reviewable cards, enabling user inspection, inline editing (✏️), and item deletion (❌) before final confirmation.

### 2. Key Assumptions

- **Default Transaction Type**: Transactions default to `รายจ่าย` (EXPENSE) unless income-related keywords (e.g., `"ได้เงิน"`, `"แม่ให้"`, `"เงินเดือนออก"`) are detected.
- **Currency & Timezone**: Default currency is Thai Baht (THB) and timezone is Thailand Standard Time (`Asia/Bangkok`, GMT+7).
- **Uncategorized Fallback**: Unrecognized items without high-confidence category matches default to `อื่นๆ` (Uncategorized) before fallback processing.

---

## Part 2 — Technical Design

### 3. Parsing Strategy (Hybrid Approach)

The system adopts a **Hybrid Architecture** combining deterministic speed with LLM intelligence:

1. **Rule-First Fast Path (Deterministic & Zero Cost)**:
   - Uses **Price Anchor Points** (`\d+(?:\.\d+)?`) to establish transaction boundaries instead of relying solely on conjunction words.
   - Normalizes Thai numerals (๑, ๒...) to Arabic digits automatically.
   - Strips relative time expressions and item quantifiers (`ถุง`, `แก้ว`, `ไม้`) prior to price anchoring.
   - Computes a dynamic **Heuristic Confidence Score** (0.0 - 1.0). High confidence matches (`>= 0.85`) execute instantly (< 5ms) without API overhead.
2. **Ambiguity Fallback to LLM (xAI Groq)**:
   - When text exhibits low confidence (`< 0.85`), complex relative dates (`"เมื่อ 2 วันที่แล้วตอนบ่ายสอง"`), or uncategorized items, execution delegates to **Groq LLM Engine (`llama-3.1-8b-instant` / `openai/gpt-oss-20b`)**.
   - Leverages a Thai natural-language system prompt with JSON mode output.

### 4. Data Model Structure

```typescript
export type TransactionType = "รายจ่าย" | "รายรับ";
export type ParserSource = "LLM" | "RULE_BASED" | "HYBRID";

export interface ParsedTransaction {
  item_id: string; // Unique ID for frontend state (Edit/Delete)
  item_name: string; // Item description (e.g., "ข้าวมันไก่", "หมูปิ้ง 3 ไม้")
  price: number; // Positive numeric amount
  category: CategoryName; // Category ("อาหาร", "ช้อปปิ้ง", "เดินทาง", etc.)
  type: TransactionType; // "รายจ่าย" or "รายรับ"
  datetime: string; // ISO 8601 DateTime string
  parser_source: ParserSource; // Parsing origin ("LLM" | "RULE_BASED")
  confidence: number; // Confidence score (0.0 - 1.0)
}

export interface ParseResult {
  raw_text: string; // Original user input text
  processed_at: string; // Processing ISO timestamp
  transactions: ParsedTransaction[]; // Array of parsed transactions
}
```

### 5. Review Flow

The interface presents a clean, reviewable card UI matching Parnuan's product flow:

- **Inspect**: Grouped by category with category tags (`รายจ่าย - อาหาร`).
- **Inline Edit (✏️)**: Modify item name, price, or category directly.
- **Delete (❌)**: Remove unwanted items instantly from the candidate list.

### 6. Technical Trade-offs

- **Speed & Cost vs Completeness**: Optimized for low latency and zero API cost for 80% of standard entries using Rule-First, reserving LLM calls for complex ambiguity.
- **In-Memory State vs Database**: Used React local state for candidate review to focus strictly on text-to-transaction logic without overbuilding DB infrastructure within the 1–3 hour scope.

---

## Part 3 — Implementation & Setup Instructions

### Prerequisites

- Node.js >= 18.x or Bun >= 1.x

### Setup & Run Instructions

1. **Clone repository**:

   ```bash
   git clone https://github.com/jakkayy/parnuan-software-engineer-takehome.git
   cd parnuan-software-engineer-takehome/assignment-1
   ```

2. **Install dependencies**:

   ```bash
   bun install
   ```

3. **Configure Environment Variables**:
   Create `.env.local` inside `assignment-1/`:

   ```env
   GROQ_API_KEY=your_groq_api_key_here
   ```

4. **Start Development Server**:
   ```bash
   bun dev
   ```
   Open `http://localhost:3000` in your browser.

---

## Part 4 — Edge Cases & Known Limitations

### 7. Difficult Cases Considered

- **Time Digits Colliding with Price Digits**: Sentences like `"ข้าวมันไก่ 50 บาท เมื่อวาน 5 โมงครึ่ง"` remove time tokens prior to price anchoring.
- **Quantifiers & Unit Numbers**: Expressions like `"กล้วยทอด 10 ถุง 100 บาท"` strip unit numbers (`10 ถุง`) beforehand to prevent digit `10` from being wrongly assigned as a 10 Baht price.
- **Item Quantifiers Preserved in Name**: Phrases like `"หมูปิ้ง 3 ไม้ 60"` retain `"หมูปิ้ง 3 ไม้"` in `item_name` while correctly setting price to `60`.

### 8. Likely Failure Cases (Known Limitations)

1. **Multi-Currency Expressions**: Inputs containing foreign currencies (e.g., `"ซื้อของ 50 USD คิดเป็น 1700 บาท"`) will fail to parse multiple currency conversions properly.
2. **Highly Ambiguous Thai Time Phrases**: Words like `"ห้าโมง"` without context can mean 05:00, 11:00, or 17:00.
3. **No-Price Informational Sentences**: Sentences without numeric values (e.g., `"ไปกินข้าวกับเพื่อนสนุกมาก"`) fail anchor matching and return empty transaction candidates.

### 9. Future Improvements (With 1 Extra Week)

1. **Persistent Database & Audit Trail**: Integrate Prisma / PostgreSQL to persist confirmed transactions and track user edits.
2. **User-Specific Category Learning**: Implement user-tailored category mapping via Few-shot LLM prompts based on past edits.
3. **Voice Input Integration**: Add Web Speech API integration to accept Thai speech-to-text directly into the input flow.
