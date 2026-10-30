import type { Catalog } from "./model";

/** Public demo fixture only. Every description and amount below is fictional. */
export const snapshot: Catalog = {
  groups: [
    { id: "sample-group-a", group_code: "A", title: "示例：前期保護", sort_order: 1, is_active: true },
    { id: "sample-group-b", group_code: "B", title: "示例：基礎工程", sort_order: 2, is_active: true },
    { id: "sample-group-c", group_code: "C", title: "示例：飾面工程", sort_order: 3, is_active: true },
  ],
  majors: [
    { id: "sample-major-1", major_num: 1, title: "示例：場地保護", group_code: "A", property_types: [], sort_order: 1, is_active: true },
    { id: "sample-major-2", major_num: 2, title: "示例：水電預留", group_code: "B", property_types: [], sort_order: 2, is_active: true },
    { id: "sample-major-3", major_num: 3, title: "示例：牆身及油漆", group_code: "C", property_types: [], sort_order: 3, is_active: true },
    { id: "sample-major-4", major_num: 4, title: "示例：木作收口", group_code: "C", property_types: [], sort_order: 4, is_active: true },
  ],
  spaces: [
    { id: "sample-space-living", space_code: "living", title: "客廳（示例）", is_repeatable: false, sort_order: 1, is_active: true },
    { id: "sample-space-kitchen", space_code: "kitchen", title: "廚房（示例）", is_repeatable: false, sort_order: 2, is_active: true },
    { id: "sample-space-bedroom", space_code: "bedroom", title: "睡房（示例）", is_repeatable: true, sort_order: 3, is_active: true },
    { id: "sample-space-bath", space_code: "bath", title: "浴室（示例）", is_repeatable: true, sort_order: 4, is_active: true },
  ],
  items: [
    { id: "sample-item-1-1", major_num: 1, code: "S1.1", description: "【虛構示例】室內地面臨時保護", unit: "項", cost_price: 11111, is_active: true, sort_order: 1 },
    { id: "sample-item-1-2", major_num: 1, code: "S1.2", description: "【虛構示例】門框及走廊保護", unit: "項", cost_price: 22222, is_active: true, sort_order: 2 },
    { id: "sample-item-2-1", major_num: 2, code: "S2.1", description: "【虛構示例】廚房水電位置調整", unit: "項", cost_price: 33333, is_active: true, sort_order: 1 },
    { id: "sample-item-2-2", major_num: 2, code: "S2.2", description: "【虛構示例】浴室供水及排水預留", unit: "項", cost_price: 44444, is_active: true, sort_order: 2 },
    { id: "sample-item-3-1", major_num: 3, code: "S3.1", description: "【虛構示例】牆身批盪修補及油漆", unit: "平方呎", cost_price: 55555, is_active: true, sort_order: 1 },
    { id: "sample-item-4-1", major_num: 4, code: "S4.1", description: "【虛構示例】訂製木作及收口", unit: "呎", cost_price: 66666, is_active: true, sort_order: 1 },
  ],
  coefficients: [
    { id: "sample-coefficient-secondhand", property_type: "secondhand", name: "二手住宅（示例）", coefficient: 1, is_active: true },
    { id: "sample-coefficient-newbuild", property_type: "newbuild", name: "新樓（示例）", coefficient: 1.1, is_active: true },
    { id: "sample-coefficient-villa", property_type: "villa", name: "獨立屋（示例）", coefficient: 1.25, is_active: true },
    { id: "sample-coefficient-office", property_type: "office", name: "辦公室（示例）", coefficient: 1.15, is_active: true },
  ],
};
