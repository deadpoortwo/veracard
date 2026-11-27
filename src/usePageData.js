import { useEffect, useState, useCallback } from "react";
import { api } from "./api.js";

export function usePageData(page, query) {
  const key = JSON.stringify([page, query]);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ key: null, data: null, error: null });

  useEffect(() => {
    const controller = new AbortController();
    setState({ key, data: null, error: null });
    api
      .page(page, query, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setState({ key, data, error: null });
      })
      .catch((error) => {
        if (error.name !== "AbortError") setState({ key, data: null, error });
      });
    return () => controller.abort();
  }, [key, revision]);

  const reload = useCallback(() => setRevision((n) => n + 1), []);
  return {
    data: state.key === key ? state.data : null,
    error: state.key === key ? state.error : null,
    loading: state.key !== key || (!state.data && !state.error),
    reload,
  };
}
