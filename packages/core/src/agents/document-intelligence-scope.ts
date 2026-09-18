/** A literal manufacturer version label, never an engine-to-trim mapping. */
export function publishedSourceVersion(text: string, model: string): string | null {
  const at = text.toLowerCase().indexOf(model.toLowerCase() + ' ');
  if (at < 0) return null;
  const tail = text.slice(at + model.length + 1);
  return (
    /^([A-Z][A-Za-z-]*\s+\d{2,3}\s+[A-Z]{2,4}|[A-Z]{2,4})(?:\s|[,.;]|$)/u.exec(tail)?.[1] ?? null
  );
}
