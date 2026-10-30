import type { Quote, QuoteLine } from "./model";

export function hkd(value: number) {
  const rounded = Math.round(Number.isFinite(value) ? value : 0);
  const sign = rounded < 0 ? "-" : "";
  const body = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}$${body}`;
}

export function todayStamp(now = new Date()) {
  const hk = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const year = hk.getUTCFullYear();
  const month = String(hk.getUTCMonth() + 1).padStart(2, "0");
  const day = String(hk.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function streetUnit(cost: number, coefficient: number) {
  return Math.round(cost * coefficient);
}

export function lineUnit(line: Pick<QuoteLine, "costPrice" | "unitPrice">, coefficient: number) {
  if (line.unitPrice != null && Number.isFinite(line.unitPrice)) return Math.round(line.unitPrice);
  return streetUnit(line.costPrice, coefficient);
}

export function hasQuantity(line: Pick<QuoteLine, "qty">) {
  return typeof line.qty === "number" && Number.isFinite(line.qty) && line.qty > 0;
}

export function hasUnitPrice(
  line: Pick<QuoteLine, "costPrice" | "unitPrice">,
  coefficient: number,
) {
  if (line.unitPrice != null) return Number.isFinite(line.unitPrice) && line.unitPrice >= 0;
  return (
    Number.isFinite(line.costPrice) &&
    line.costPrice > 0 &&
    Number.isFinite(coefficient) &&
    coefficient > 0
  );
}

export function lineStreet(
  line: Pick<QuoteLine, "costPrice" | "unitPrice" | "qty">,
  coefficient: number,
) {
  if (!hasQuantity(line) || !hasUnitPrice(line, coefficient)) return 0;
  return Math.round(lineUnit(line, coefficient) * line.qty!);
}

export function quoteTotal(quote: Quote, coefficient: number) {
  return quote.lines.reduce((sum, line) => sum + lineStreet(line, coefficient), 0);
}

export const STATUS_LABEL: Record<Quote["status"], string> = {
  draft: "草稿",
  sent: "已出",
  accepted: "已接",
  declined: "未接",
};

export const DISTRICTS = [
  "中西區",
  "灣仔",
  "東區",
  "南區",
  "油尖旺",
  "深水埗",
  "九龍城",
  "黃大仙",
  "觀塘",
  "荃灣",
  "屯門",
  "元朗",
  "北區",
  "大埔",
  "沙田",
  "西貢",
  "葵青",
  "離島",
];
