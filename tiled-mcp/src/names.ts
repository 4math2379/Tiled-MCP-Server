// File-system friendly names, shared by map files, downloads and building ids.

/** Slug of a display name, e.g. "Crypt under the chapel" -> "crypt-under-the-chapel". */
export function slugify(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "map";
}

/** `base`, or `base-2`, `base-3`... : the first candidate `taken` does not hold. */
export function uniqueName(base: string, taken: (candidate: string) => boolean): string {
  if (!taken(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`;
    if (!taken(candidate)) return candidate;
  }
}
