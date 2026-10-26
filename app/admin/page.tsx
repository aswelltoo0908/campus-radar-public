import Link from "next/link";
import { desc, eq, and } from "drizzle-orm";
import { getChatGPTUser, chatGPTSignInPath } from "../chatgpt-auth";
import { isAdmin } from "../../lib/server/admin";
import { getDb } from "../../db";
import { userActivity, profiles, radarRuns, emailDeliveries, sources } from "../../db/schema";
import "./admin.css";
import UnsubscribeButton from "./UnsubscribeButton";
import NewsAdmin from "./NewsAdmin";
import { parseOpportunityPreferences } from "../../lib/opportunity-matching";

export const dynamic = "force-dynamic";
const steps = ["About you", "Goals & interests", "Delivery preferences", "Sources", "Preview"];
function university(profile: typeof profiles.$inferSelect | undefined) {
  if (!profile) return "Not provided";
  try { return parseOpportunityPreferences(JSON.parse(profile.opportunityPreferencesJson)).universityName || (profile.isUmichStudent ? "University of Michigan" : profile.school || "Not provided"); }
  catch { return "Not provided"; }
}
function date(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z");
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "short", timeStyle: "short" });
}

export default async function AdminPage() {
  const user = await getChatGPTUser();
  if (!user) return <main className="radar-admin"><h1>Campus Radar admin</h1><p>Sign in with your authorized administrator account.</p><a className="button primary" href={chatGPTSignInPath("/admin")} target="_top">Sign in</a></main>;
  if (!isAdmin(user.email)) return <main className="radar-admin"><h1>Access restricted</h1><p>This account is not an administrator.</p><Link href="/beta">Return to Radar</Link></main>;
  try {
    const db = getDb();
    const [activity, people, runs, deliveries, health] = await Promise.all([
      db.select().from(userActivity), db.select().from(profiles),
      db.select({ id: radarRuns.id, userEmail: radarRuns.userEmail, createdAt: radarRuns.createdAt }).from(radarRuns).orderBy(desc(radarRuns.id)),
      db.select().from(emailDeliveries).orderBy(desc(emailDeliveries.id)),
      db.select({ lastSyncedAt: sources.lastSyncedAt }).from(sources).where(and(eq(sources.userEmail, "__radar_system__"), eq(sources.type, "mailer_health"))).limit(1),
    ]);
    const lastHeartbeat = health[0]?.lastSyncedAt;
    const healthy = Boolean(lastHeartbeat && Date.now() - new Date(lastHeartbeat).getTime() < 3600000);
    const emails = [...new Set([...activity.map(p => p.email), ...people.map(p => p.email), ...runs.map(p => p.userEmail), ...deliveries.map(p => p.userEmail)])];
    const rows = emails.map(email => {
      const visit = activity.find(p => p.email === email), profile = people.find(p => p.email === email);
      const generated = runs.filter(p => p.userEmail === email), sent = deliveries.filter(p => p.userEmail === email && p.status === "sent");
      return { email, visit, profile, generated, sent, latest: deliveries.find(p => p.userEmail === email) };
    }).sort((a,b) => String(b.visit?.lastSeenAt ?? b.profile?.updatedAt ?? "").localeCompare(String(a.visit?.lastSeenAt ?? a.profile?.updatedAt ?? "")));
    return <main className="radar-admin">
      <header><div><p className="eyebrow">OWNER WORKSPACE</p><h1>Campus Radar admin</h1></div><nav><Link href="/beta">Student view</Link><a href="/admin">Refresh</a></nav></header>
      <p>Signed in as {user.email}. All times are Eastern Time.</p>
      <section className="admin-metrics" aria-label="Pilot summary">{[["Known users", rows.length], ["Tracked signed-in visitors", activity.length], ["Generated a Radar", rows.filter(r => r.generated.length).length], ["Email subscribers", people.filter(p => p.emailDeliveryEnabled && p.deliveryEmail).length], ["Sent reports", deliveries.filter(d => d.status === "sent").length]].map(([label,value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</section>
      <section className="admin-mail"><h2>Email automation: {healthy ? "Heartbeat received" : "Not confirmed running"}</h2><p>Last successful check: {date(lastHeartbeat)}. A subscription is not a sent email. “Sent” means Gmail accepted the send; it does not prove inbox delivery.</p></section>
      <h2>Users & progress</h2><p>Signed-in visit tracking starts with this update. Earlier users appear only if they saved a profile or generated a report. This records authenticated Beta visits, not a count of separate login sessions. Unsaved form contents are not collected.</p>
      <div className="admin-table-wrap"><table><thead><tr>{["User", "First / last visit", "Progress", "Reports generated", "Email subscription", "Last delivery", "Reports sent"].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(r => <tr key={r.email}>
        <td><strong>{r.profile?.fullName ?? r.visit?.fullName ?? "Student"}</strong><br/>{r.email}<br/><small>University: {university(r.profile)}</small></td>
        <td>{date(r.visit?.firstSeenAt)}<br/>{date(r.visit?.lastSeenAt)}</td>
        <td>{r.generated.length ? "Radar generated" : r.profile ? "Profile saved" : "Signed in; setup incomplete"}<br/>{r.visit && <>Last: {steps[r.visit.lastStep]}<br/>Furthest: {steps[r.visit.furthestStep]}</>}</td>
        <td>{r.generated.length}<br/>{date(r.generated[0]?.createdAt)}</td>
        <td>{r.profile?.emailDeliveryEnabled && r.profile.deliveryEmail ? <>{r.profile.deliveryEmail}<br/>{r.profile.deliveryTime} ET · {r.profile.weekends ? "Every day" : "Weekdays"}<UnsubscribeButton email={r.email}/></> : "Not subscribed"}</td>
        <td>{r.latest?.status ?? "No send attempt"}<br/>{date(r.latest?.sentAt ?? r.latest?.createdAt)}{r.latest?.lastError && <p className="admin-error">Send failed. Check mailer execution logs.</p>}</td>
        <td>{r.sent.length}</td>
      </tr>)}</tbody></table>{!rows.length && <p>No user records yet.</p>}</div>
      <p className="admin-note">Unsubscribe stops daily emails only. Private feed URLs, API tokens, forwarded email contents and report contents are never displayed here.</p>
      <NewsAdmin />
    </main>;
  } catch (error) {
    console.error("Admin dashboard unavailable", error);
    return <main className="radar-admin"><h1>Dashboard temporarily unavailable</h1><p>No user data could be loaded. Please try again.</p><a href="/admin">Retry</a></main>;
  }
}
