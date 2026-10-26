import Link from "next/link";
import { redirect } from "next/navigation";
import { chatGPTSignInPath, getChatGPTUser } from "../chatgpt-auth";
import { briefReturnPath } from "../../lib/brief-sections";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ return_to?: string | string[] }> } = {}) {
  const returnTo = briefReturnPath((await searchParams)?.return_to);
  const user = await getChatGPTUser();
  if (user) redirect(returnTo);

  return (
    <main className="login-page">
      <Link className="login-brand" href="/"><span className="brand-mark">R</span><span>Campus Radar</span></Link>
      <section className="login-card">
        <p className="eyebrow">UMICH · 10-STUDENT BETA</p>
        <h1>Why you will be redirected to ChatGPT</h1>
        <p className="login-lead">The Beta uses your ChatGPT account to confirm identity and create a separate, deletable data space. You do not need an API key or ChatGPT Plus.</p>
        <ul className="login-facts">
          <li><span>01</span><div><strong>Set up in about one minute</strong><p>Choose your goals and interests. Paste your schedule and deadlines now or add them later.</p></div></li>
          <li><span>02</span><div><strong>Radar cannot access your ChatGPT conversations</strong><p>Campus Radar receives identity information only and never reads chat history.</p></div></li>
          <li><span>03</span><div><strong>The Beta currently uses a web preview</strong><p>Automated email reports are coming soon; no email is sent yet.</p></div></li>
        </ul>
        <a className="button primary login-button" target="_top" href={chatGPTSignInPath(returnTo)}>Continue with ChatGPT <span aria-hidden="true">↗</span></a>
        <p className="login-domain-note">Next, you will open the official <strong>auth.openai.com</strong> sign-in page.</p>
        <Link className="login-cancel" href="/">Not now—return to the product page</Link>
      </section>
    </main>
  );
}
