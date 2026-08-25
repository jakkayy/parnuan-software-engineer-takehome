import { NextResponse } from "next/server";
import { parseTextToTransactions } from "@/lib/parser";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "ข้อความไม่ถูกต้อง หรือไม่ได้ระบุข้อความ" },
        { status: 400 }
      );
    }

    const result = await parseTextToTransactions(text);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("API /api/parse error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการประมวลผลข้อความ" },
      { status: 500 }
    );
  }
}
