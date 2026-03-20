/**
 * Extracts a human-readable error message from an Axios error whose response
 * body may be a JSON Blob (happens when responseType is "blob").
 */
export async function extractApiError(e: unknown, fallback = "An unexpected error occurred."): Promise<string> {
  if (!e || typeof e !== "object") return fallback;

  const err = e as { message?: string; response?: { data?: unknown } };
  const blob = err.response?.data;

  if (blob instanceof Blob) {
    try {
      const txt = await blob.text();
      const json = JSON.parse(txt);
      return String(json?.detail ?? json?.error ?? err.message ?? fallback);
    } catch {
      // blob was not JSON — return raw text if available
      try {
        const raw = await (blob as Blob).text();
        return raw || err.message || fallback;
      } catch {
        return err.message ?? fallback;
      }
    }
  }

  return err.message ?? fallback;
}
