import { useEffect, useRef, useState } from "react";
import {
  managementError,
  managementRequest,
} from "../management/managementApi";

export type AdminMutation = (
  method: "POST" | "PATCH" | "PUT",
  path: string,
  body: unknown,
) => Promise<boolean>;

export function useAdminSection<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [version, setVersion] = useState(0);
  const action = useRef(false);

  useEffect(() => {
    let current = true;
    load()
      .then((result) => {
        if (current) setData(result);
      })
      .catch((cause) => {
        if (current) setError(managementError(cause));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [load, version]);

  function reload() {
    setError("");
    setLoading(true);
    setVersion((value) => value + 1);
  }

  const run: AdminMutation = async (method, path, body) => {
    if (action.current || loading) return false;
    action.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await managementRequest(method, path, body);
      setMessage("Changes saved.");
      reload();
      return true;
    } catch (cause) {
      setError(managementError(cause));
      return false;
    } finally {
      action.current = false;
      setBusy(false);
    }
  };

  return { data, loading, busy: busy || loading, error, message, reload, run };
}
