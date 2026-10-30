export type Group = {
  id: string;
  group_code: string;
  title: string;
  sort_order: number;
  is_active: boolean;
};

export type Major = {
  id: string;
  major_num: number;
  title: string;
  group_code: string;
  property_types: string[];
  sort_order: number;
  is_active: boolean;
};

export type SpaceDef = {
  id: string;
  space_code: string;
  title: string;
  is_repeatable: boolean;
  sort_order: number;
  is_active: boolean;
};

export type StandardItem = {
  id: string;
  major_num: number;
  code: string;
  description: string;
  spec?: string;
  unit: string;
  cost_price: number;
  is_active: boolean;
  sort_order: number;
};

export type Coefficient = {
  id: string;
  property_type: string;
  name: string;
  coefficient: number;
  is_active: boolean;
};

export type Catalog = {
  groups: Group[];
  majors: Major[];
  spaces: SpaceDef[];
  items: StandardItem[];
  coefficients: Coefficient[];
};

export type QuoteStatus = "draft" | "sent" | "accepted" | "declined";

export type ChosenSpace = {
  id: string;
  spaceCode: string;
  title: string;
};

export type QuoteLine = {
  id: string;
  itemId: string;
  majorNum: number;
  code: string;
  description: string;
  spec?: string;
  unit: string;
  costPrice: number;
  unitPrice?: number | null;
  qty: number | null;
  spaceId: string;
};

export type Quote = {
  id: string;
  number: string;
  status: QuoteStatus;
  createdAt: string;
  updatedAt: string;
  quoteDate: string;
  propertyType: string;
  clientName: string;
  phone: string;
  district: string;
  address: string;
  coefficient?: number | null;
  groupCodes: string[];
  majorNums: number[];
  spaces: ChosenSpace[];
  lines: QuoteLine[];
  remark: string;
};

export const WHOLE_SPACE = "whole";
export const NO_SPACE = "none";
