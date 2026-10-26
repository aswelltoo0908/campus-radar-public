import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { emailDeliveries, profiles } from "../../db/schema";
import { getChatGPTUser, chatGPTSignInPath } from "../chatgpt-auth";
import { verifyUnsubscribeToken } from "../../lib/server/unsubscribe";

export const dynamic = "force-dynamic";
export const metadata = { title: "Unsubscribe · Campus Radar", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string; done?: string }> }) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  let email: string | null = null;
  if (token) {
    const id = await verifyUnsubscribeToken(token);
    if (id) {
      const [delivery] = await getDb().select({ userEmail: emailDeliveries.userEmail }).from(emailDeliveries).where(eq(emailDeliveries.id, id)).limit(1);
      email = delivery?.userEmail ?? null;
    }
  } else {
    email = (await getChatGPTUser())?.email ?? null;
  }
  const [profile] = email ? await getDb().select({ enabled: profiles.emailDeliveryEnabled, language: profiles.reportLanguage }).from(profiles).where(eq(profiles.email, email)).limit(1) : [];
  const zh = profile?.language === "zh";
  return <main className="login-page"><section className="login-card">
    <p className="eyebrow">CAMPUS RADAR · EMAIL PREFERENCES</p>
    {params.done === "1" ? <><h1>Unsubscribed / 已取消订阅</h1><p>Daily emails are off. Your account and web Radar are kept. / 已停止日报邮件，账号和网页简报仍保留。</p></> : profile ? <>
      <h1>{profile.enabled ? (zh ? "取消日报订阅？" : "Stop daily Radar emails?") : (zh ? "你已取消订阅" : "You’re already unsubscribed")}</h1>
      <p>{zh ? "只停止日报邮件，不会删除你的账号、配置和历史简报。" : "This stops daily emails only. Your account, preferences, and previous reports stay available."}</p>
      {profile.enabled && <form method="post" action="/api/unsubscribe"><input type="hidden" name="token" value={token}/><button className="button primary" type="submit">{zh ? "确认取消订阅" : "Confirm unsubscribe"}</button></form>}
    </> : <><h1>{token ? "This unsubscribe link is invalid" : "Manage your email subscription"}</h1><p>{token ? "Open the link in a recent Radar email, or sign in to stop emails from your account." : "Sign in, or use the unsubscribe button in your Radar email without signing in."}</p><a className="button primary" href={chatGPTSignInPath("/unsubscribe")} target="_top">Sign in</a></>}
    <p><Link href="/beta">Return to Campus Radar</Link></p>
  </section></main>;
}
