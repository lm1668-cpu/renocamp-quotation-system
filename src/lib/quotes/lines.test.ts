import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { initialQuantity, makeQuoteLines, quoteSpaceLabel } from "./lines.ts";
import { NO_SPACE, WHOLE_SPACE, type StandardItem } from "./model.ts";

const item: StandardItem = {
  id: "test",
  major_num: 23,
  code: "TEST-23",
  description: "【測試】工程描述",
  spec: "【測試】規格",
  unit: "平方呎",
  cost_price: 100,
  is_active: true,
  sort_order: 1,
};

describe("optional quotation partitions", () => {
  it("directly adds a no-partition line without assuming whole-house scope", () => {
    const [line] = makeQuoteLines(item);
    assert.equal(line.spaceId, NO_SPACE);
    assert.notEqual(line.spaceId, WHOLE_SPACE);
    assert.equal(line.qty, null);
    assert.equal(quoteSpaceLabel({ spaces: [] }, line.spaceId), "不分區");
  });
  it("keeps existing explicit whole-house scope distinct", () => {
    assert.equal(quoteSpaceLabel({ spaces: [] }, WHOLE_SPACE), "全屋");
    assert.equal(
      quoteSpaceLabel({ spaces: [{ id: "room", spaceCode: "room", title: "客廳" }] }, "room"),
      "客廳",
    );
  });
  it("adds one independent snapshot per selected region and deduplicates the batch", () => {
    const lines = makeQuoteLines(item, ["living", "bedroom", "living"]);
    assert.equal(lines.length, 2);
    assert.equal(new Set(lines.map((line) => line.id)).size, 2);
    assert.deepEqual(
      lines.map((line) => line.spaceId),
      ["living", "bedroom"],
    );
    lines[0].description = "只改客廳";
    lines[0].spec = "只改客廳規格";
    assert.equal(lines[1].description, item.description);
    assert.equal(lines[1].spec, item.spec);
    assert.equal(item.description, "【測試】工程描述");
  });
  it("only defaults an explicit lump-sum item to one, not measured quantities", () => {
    assert.equal(initialQuantity("項"), 1);
    for (const unit of ["平方呎", "平方米", "呎", "米", "個", "套", ""])
      assert.equal(initialQuantity(unit), null);
  });
});
