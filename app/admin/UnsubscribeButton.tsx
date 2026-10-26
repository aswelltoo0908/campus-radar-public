"use client";
import { useState } from "react";

export default function UnsubscribeButton({ email }: { email: string }) {
  const [status, setStatus] = useState("");
  async function stop() {
    if (!window.confirm(`Stop daily emails for ${email}? Their account and reports will be kept.`)) return;
    setStatus("Stopping…");
    try {
      const response = await fetch("/api/admin/subscription", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
      if (!response.ok) throw new Error();
      window.location.reload();
    } catch { setStatus("Could not unsubscribe. Please retry."); }
  }
  return <div><button type="button" className="text-button" onClick={stop} disabled={status === "Stopping…"}>Unsubscribe</button>{status && <p role="status">{status}</p>}</div>;
}
