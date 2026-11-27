const API_BASE = (import.meta.env?.VITE_API_BASE_URL || "").replace(/\/$/, "");

export async function backend(path, body, { signal, headers = {} } = {}) {
  const response = await fetch(API_BASE + "/api" + path, {
    method: body === undefined ? "GET" : "POST",
    credentials: API_BASE ? "include" : "same-origin",
    headers: { ...headers, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const isStatic = !API_BASE && (response.status === 404 || response.status === 405);
    const err = new Error(
      isStatic
        ? "Backend API (/api) is not connected. Set VITE_API_BASE_URL to your Render API URL or run locally with `npm run dev`."
        : "Invalid server response",
    );
    if (isStatic) err.staticHost = true;
    throw err;
  }
  const data = await response.json().catch(() => ({ error: "Invalid server response" }));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}
