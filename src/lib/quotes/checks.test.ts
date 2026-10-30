import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pendingQuantityCount, quoteIssues, unpricedLineCount } from "./checks.ts";
import { hasQuantity, lineStreet, lineUnit, quoteTotal, streetUnit } from "./money.ts";
import { NO_SPACE } from "./model.ts";
import type { Quote, QuoteLine } from "./model.ts";

const line: QuoteLine = {
  id: "test-line",
  itemId: "test-item",
  majorNum: 1,
  code: "TEST-01",
  description: "【測試】客廳油漆工程",
  spec: "虛構測試資料",
  unit: "平方米",
  costPrice: 100,
  qty: 12.5,
  spaceId: "whole",
};
const quote: Quote = {
  id: "test-quote",
  number: "TEST-001",
  status: "draft",
  createdAt: "2026-10-30",
  updatedAt: "2026-10-30",
  quoteDate: "2026-10-30",
  propertyType: "secondhand",
  clientName: "【測試】虛構客戶",
  phone: "",
  district: "",
  address: "【測試地址】虛構單位",
  coefficient: null,
  groupCodes: ["A"],
  majorNums: [1],
  spaces: [],
  lines: [line],
  remark: "測試，唔係正式報價",
};

describe("quotation pricing stays cost × property coefficient", () => {
  it("keeps the preset whole-dollar price and supports fractional quantities", () => {
    assert.equal(streetUnit(100, 1.2), 120);
    assert.equal(lineStreet(line, 1.2), 1500);
    assert.equal(quoteTotal(quote, 1.2), 1500);
  });
  it("keeps a manual unit price when the property coefficient changes", () => {
    const manual = { ...line, unitPrice: 150 };
    assert.equal(lineUnit(manual, 1.2), 150);
    assert.equal(lineUnit(manual, 1.5), 150);
    assert.equal(lineStreet(manual, 1.5), 1875);
  });
  it("does not treat blank, zero or invalid quantity as a priced line", () => {
    for (const qty of [null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const pending = { ...line, qty };
      assert.equal(hasQuantity(pending), false);
      assert.equal(lineStreet(pending, 1.2), 0);
      assert.equal(pendingQuantityCount({ lines: [pending] }), 1);
      assert.ok(
        quoteIssues({ ...quote, lines: [pending] }, 1.2).some((issue) =>
          issue.message.includes("數量待確認"),
        ),
      );
    }
  });
  it("totals only confirmed quantity without dropping pending scope", () => {
    const draft = { ...quote, lines: [line, { ...line, id: "pending", qty: null }] };
    assert.equal(quoteTotal(draft, 1.2), 1500);
    assert.equal(draft.lines.length, 2);
    assert.equal(pendingQuantityCount(draft), 1);
  });
});

describe("customer issue checks", () => {
  it("allows a normal quote with optional phone and district left blank", () => {
    assert.deepEqual(quoteIssues(quote, 1.2), []);
    assert.deepEqual(quoteIssues({ ...quote, lines: [{ ...line, spaceId: NO_SPACE }] }, 1.2), []);
  });
  it("blocks incomplete quote details and an empty scope", () => {
    const issues = quoteIssues(
      { ...quote, clientName: " ", address: "", quoteDate: "", lines: [] },
      0,
    );
    assert.deepEqual(
      issues.map((issue) => issue.field),
      ["clientName", "address", "quoteDate", "coefficient", "lines"],
    );
  });
  it("rejects invalid calendar dates, empty descriptions and orphaned spaces", () => {
    const issues = quoteIssues(
      {
        ...quote,
        quoteDate: "2026-02-30",
        lines: [{ ...line, description: "", spaceId: "deleted-room" }],
      },
      1.2,
    );
    assert.ok(issues.some((issue) => issue.field === "quoteDate"));
    assert.ok(issues.some((issue) => issue.message.includes("工程描述")));
    assert.ok(issues.some((issue) => issue.message.includes("區域已不存在")));
  });
  it("allows an explicitly zero-priced item but rejects a negative price", () => {
    assert.deepEqual(quoteIssues({ ...quote, lines: [{ ...line, unitPrice: 0 }] }, 1.2), []);
    assert.ok(
      quoteIssues({ ...quote, lines: [{ ...line, unitPrice: -1 }] }, 1.2).some((issue) =>
        issue.message.includes("單價待核"),
      ),
    );
  });
  it("does not mistake an unpriced catalog placeholder for a free item", () => {
    const pending = { ...quote, lines: [{ ...line, costPrice: 0 }] };
    assert.equal(unpricedLineCount(pending, 1.2), 1);
    assert.equal(quoteTotal(pending, 1.2), 0);
    assert.ok(quoteIssues(pending, 1.2).some((issue) => issue.message.includes("單價待核")));
    assert.equal(
      unpricedLineCount({ ...pending, lines: [{ ...pending.lines[0], unitPrice: 0 }] }, 1.2),
      0,
    );
  });
});
