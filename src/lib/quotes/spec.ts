export type SpecParts = {
  material: string;
  method: string;
  size: string;
  excludes: string;
  note: string;
};

const FIELDS = [
  ["material", "物料"],
  ["method", "做法"],
  ["size", "尺寸"],
  ["excludes", "唔包"],
] as const;

export function emptySpec(): SpecParts {
  return { material: "", method: "", size: "", excludes: "", note: "" };
}

export function parseSpec(spec: string | undefined): SpecParts {
  const parts = emptySpec();
  const extra: string[] = [];
  for (const line of (spec ?? "").split("\n")) {
    const hit = FIELDS.find(([, label]) => line.startsWith(`${label}：`) || line.startsWith(`${label}:`));
    if (!hit) {
      if (line.trim()) extra.push(line);
      continue;
    }
    const label = hit[1];
    parts[hit[0]] = line.slice(line.startsWith(`${label}：`) ? label.length + 1 : label.length + 1).trim();
  }
  parts.note = extra.join("\n");
  return parts;
}

export function composeSpec(parts: SpecParts) {
  return [
    ...FIELDS.map(([key, label]) => (parts[key].trim() ? `${label}：${parts[key].trim()}` : "")),
    parts.note.trim(),
  ]
    .filter(Boolean)
    .join("\n");
}
