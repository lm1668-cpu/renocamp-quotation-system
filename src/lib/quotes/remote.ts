import { snapshot } from "./data";
import type { Catalog } from "./model";

export type CatalogSource = "sample";

export type LoadedCatalog = {
  catalog: Catalog;
  source: CatalogSource;
};

function tidy(raw: Catalog): Catalog {
  return {
    groups: raw.groups.filter((row) => row.is_active).sort((a, b) => a.sort_order - b.sort_order),
    majors: raw.majors.filter((row) => row.is_active).sort((a, b) => a.major_num - b.major_num),
    spaces: raw.spaces.filter((row) => row.is_active).sort((a, b) => a.sort_order - b.sort_order),
    items: raw.items
      .filter((row) => row.is_active)
      .sort((a, b) => a.major_num - b.major_num || a.code.localeCompare(b.code, "en")),
    coefficients: raw.coefficients.filter((row) => row.is_active),
  };
}

/** Public example mode is deliberately offline and never contacts a remote catalogue. */
export async function loadCatalog(): Promise<LoadedCatalog> {
  return { catalog: tidy(snapshot), source: "sample" };
}

export function coefficientFor(catalog: Catalog, propertyType: string) {
  return catalog.coefficients.find((row) => row.property_type === propertyType)?.coefficient ?? 1;
}

export function propertyName(catalog: Catalog, propertyType: string) {
  return catalog.coefficients.find((row) => row.property_type === propertyType)?.name ?? propertyType;
}
