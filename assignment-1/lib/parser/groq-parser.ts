import Groq from "groq-sdk";
import { ParsedTransaction, DEFAULT_CATEGORIES } from "../types";

const getGroqClient = () => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  return new Groq({ apiKey });
};

export async function parseWithGroq(
  text: string,
  referenceTime: Date = new Date(),
): Promise<ParsedTransaction[] | null> {
  const groq = getGroqClient();
  if (!groq) {
    console.warn("Groq API Key missing, falling back to rule parser.");
    return null;
  }

  const currentIsoDate = referenceTime.toISOString();
  const categoriesStr = DEFAULT_CATEGORIES.join(", ");

  const systemPrompt = `คุณคือระบบ AI ผู้ช่วยวิเคราะห์ข้อความภาษาไทยเพื่อแปลงเป็นรายการบันทึกรายรับ-รายจ่ายทางการเงิน (Financial Transaction Parser)

บริบทเวลาปัจจุบันของระบบ (System Reference Time): ${currentIsoDate}
(เขตเวลาไทย Asia/Bangkok GMT+7)

กฎและแนวทางในการตีความภาษาไทยธรรมชาติ (Thai Natural Language Parsing Rules):

1. การแยกรายการ (Multi-transaction Handling):
   - 1 ข้อความอาจมีหลายรายการ ให้แยกออกจากกันเมื่อเจอคำเชื่อม (เช่น "แล้วก็", "และ", "กับ", "รวมถึง", "แลัว") หรือสัญลักษณ์แบ่งประโยค
   - เก็บคำระบุจำนวน/หน่วยไว้ในชื่อรายการด้วย: เช่น "กล้วยทอด 3 ถุง", "หมูปิ้ง 5 ไม้", "กาแฟ 2 แก้ว"

2. การคำนวณราคาและจำนวนเงิน (Amount & Currency):
   - รองรับทั้งตัวเลขสากล (50), ตัวเลขไทย (๕๐), ตัวหนังสือคำพูด (เช่น "ห้าร้อย" -> 500, "สองพัน" -> 2000) และสัญลักษณ์ ("50.-", "50 บาท")
   - กรณีระบุราคาต่อหน่วยและจำนวนชิ้น (เช่น "แก้วละ 50 สั่ง 2 แก้ว") ให้คำนวณราคารวมทั้งหมดสุทธิ (100)

3. การตีความวันและเวลาภาษาไทย (Thai Relative Time Conventions):
   - วันเปรียบเทียบ: "วันนี้" (ใช้วันปัจจุบัน), "เมื่อวาน" (วันปัจจุบัน - 1 วัน), "เมื่อวานซืน" (วันปัจจุบัน - 2 วัน)
   - เวลาไทยธรรมชาติ:
     * "ตี X" -> 0X:00 (เช่น ตีสาม -> 03:00)
     * "X โมงเช้า" -> 0X:00
     * "เที่ยง" -> 12:00 / "เที่ยงคืน" -> 00:00
     * "บ่าย X" -> (12+X):00 (เช่น บ่ายสอง -> 14:00)
     * "X โมงเย็น" -> (12+X):00 (เช่น 5 โมงเย็น -> 17:00)
     * "X ทุ่ม" -> (18+X):00 (เช่น ทุ่มครึ่ง -> 19:30, สองทุ่ม -> 20:00)
   - หากไม่ระบุเวลา ให้ใช้เวลาปัจจุบันจาก System Reference Time

4. การจำแนกประเภทและหมวดหมู่ (Category & Type Classification):
   - type: "รายรับ" เมื่อมีคีย์เวิร์ดรับเงิน (เช่น "เงินเดือนออก", "ได้เงิน", "ขายได้", "แม่ให้", "โอนเข้า", "เงินคืน") นอกเหนือจากนี้ให้จัดเป็น "รายจ่าย"
   - category: ต้องเลือกเฉพาะ 1 หมวดหมู่จากรายการที่กำหนดนี้เท่านั้น: [${categoriesStr}]

5. คะแนนความมั่นใจ (Confidence Scoring Guide):
   - 0.95 - 1.00: ระบุชื่อรายการ ราคา และหมวดหมู่อย่างชัดเจน ไม่มีความสับสน
   - 0.70 - 0.90: หมวดหมู่ไม่แน่ชัด หรือภาษามีกรอบเวลาที่ไม่แน่ชัด
   - ต่ำกว่า 0.60: ไม่ระบุราคา หรือประโยคมีความคลุมเครือสูง

ตอบกลับในรูปแบบ JSON Object เท่านั้น ห้ามใส่คำอธิบายเพิ่มเติมหรือ Markdown code block:
{
  "transactions": [
    {
      "item_name": "กล้วยทอด 3 ถุง",
      "price": 60,
      "category": "อาหาร",
      "type": "รายจ่าย",
      "datetime": "ISO 8601 String",
      "confidence": 0.95
    }
  ]
}`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      model: "openai/gpt-oss-20b",
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return null;

    const parsedData = JSON.parse(content);
    if (!parsedData.transactions || !Array.isArray(parsedData.transactions)) {
      return null;
    }

    const nowIso = new Date().toISOString();

    return parsedData.transactions.map((item: any, index: number) => ({
      item_id: `llm-${Date.now()}-${index}`,
      item_name: item.item_name || "รายการไม่ระบุชื่อ",
      price: typeof item.price === "number" ? item.price : 0,
      category: DEFAULT_CATEGORIES.includes(item.category)
        ? item.category
        : "อื่นๆ",
      type: item.type === "รายรับ" ? "รายรับ" : "รายจ่าย",
      datetime: item.datetime || currentIsoDate,
      parser_source: "LLM" as const,
      confidence: typeof item.confidence === "number" ? item.confidence : 0.85,
    }));
  } catch (error) {
    console.error("Groq Parser error:", error);
    return null;
  }
}
