"use client";
import { useEffect, useState } from "react";
import type { PublicSignal } from "../../lib/types";
type Source = {
  id: string;
  status: string;
  itemCount: number;
  lastSuccessAt: string | null;
  lastError: string | null;
};
export default function NewsAdmin() {
  const [data, setData] = useState<{
      sources: Source[];
      items: PublicSignal[];
    }>({ sources: [], items: [] }),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [channel, setChannel] = useState("all");
  async function load() {
    const r = await fetch("/api/admin/news");
    if (!r.ok) throw new Error("Could not load public sources.");
    setData(await r.json());
  }
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, []);
  async function refresh() {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/news", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!r.ok) throw new Error("Refresh failed.");
      await load();
      setMessage(
        "Refresh checked. Sources retain their cooldowns; funding checks run on Mondays.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Refresh failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-mail">
      <p className="eyebrow">PUBLIC CONTENT WORKSPACE</p>
      <h2>News & funding sources</h2>
      <p>
        Business Hot: Finance, Accounting, Entrepreneurship, Marketing,
        Management, Business Analytics. AIHOT is a separate adapter; its status
        records any authorization requirement.
      </p>
      <button onClick={refresh} disabled={busy}>
        {busy ? "Checking sources…" : "Check source updates"}
      </button>
      <p role="status">{message}</p>
      <div className="admin-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Source</th>
              <th>Status</th>
              <th>Items</th>
              <th>Last success</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {data.sources.map((source) => (
              <tr key={source.id}>
                <td>{source.id}</td>
                <td>{source.status}</td>
                <td>{source.itemCount}</td>
                <td>{source.lastSuccessAt || "Not yet collected"}</td>
                <td>{source.lastError}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <label>
        Content view{" "}
        <select value={channel} onChange={(e) => setChannel(e.target.value)}>
          {[
            "all",
            "scholarship",
            "finance",
            "accounting",
            "entrepreneurship",
            "marketing",
            "management",
            "business_analytics",
            "ai_news",
          ].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      {data.items
        .filter(
          (item) =>
            channel === "all" ||
            item.category === channel ||
            item.channel === channel,
        )
        .slice(0, 30)
        .map((item) => (
          <article className="opportunity-card" key={item.id}>
            <small>
              {item.category} · {item.channel} · {item.sourceName} ·{" "}
              {item.availability}
            </small>
            <h3>{item.title}</h3>
            <p>{item.summary}</p>
            <a href={item.url} target="_blank" rel="noreferrer">
              Original source ↗
            </a>
            <p>
              Published: {item.publishedAt || "Not stated"} · Fetched:{" "}
              {item.fetchedAt}
            </p>
          </article>
        ))}
    </section>
  );
}
