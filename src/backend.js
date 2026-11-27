export async function backend(path, body, { signal, headers = {} } = {}) {
  const response = await fetch("/api" + path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers: { ...headers, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const err = new Error(
      response.status === 404
        ? "Backend API (/api) is not deployed on this static host. Run locally with `npm run dev` or proxy /api."
        : "Invalid server response",
    );
    if (response.status === 404) err.staticHost = true;
    throw err;
  }
  const data = await response.json().catch(() => ({ error: "Invalid server response" }));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}
