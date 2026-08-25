import { ParseResult, ParsedTransaction } from "../types";
import { parseWithGroq } from "./groq-parser";
import { parseWithRules } from "./rule-parser";

const RULE_CONFIDENCE_THRESHOLD = 0.85;

export async function parseTextToTransactions(
  text: string,
  referenceTime: Date = new Date()
): Promise<ParseResult> {
  const processedAt = new Date().toISOString();
  const trimmedText = text.trim();

  if (!trimmedText) {
    return {
      raw_text: text,
      processed_at: processedAt,
      transactions: [],
    };
  }

  const ruleTransactions = parseWithRules(trimmedText, referenceTime);

  const isRuleHighConfidence =
    ruleTransactions.length > 0 &&
    ruleTransactions.every((tx) => tx.confidence >= RULE_CONFIDENCE_THRESHOLD);

  if (isRuleHighConfidence) {
    return {
      raw_text: text,
      processed_at: processedAt,
      transactions: ruleTransactions,
    };
  }

  try {
    const llmTransactions = await parseWithGroq(trimmedText, referenceTime);
    if (llmTransactions && llmTransactions.length > 0) {
      return {
        raw_text: text,
        processed_at: processedAt,
        transactions: llmTransactions,
      };
    }
  } catch (err) {
    console.warn("Groq LLM Engine failed, using Rule-based output as fallback:", err);
  }

  return {
    raw_text: text,
    processed_at: processedAt,
    transactions: ruleTransactions,
  };
}

