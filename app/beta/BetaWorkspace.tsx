import Link from "next/link";
import { redirect } from "next/navigation";
import { getChatGPTUser, chatGPTSignOutPath } from "../chatgpt-auth";
import { isAdmin } from "../../lib/server/admin";
import { briefPath, type BriefSection } from "../../lib/brief-sections";
import OpportunityOnboarding from "./OpportunityOnboarding";

/** Every brief route uses the same authentication and saved-profile flow. */
export default async function BetaWorkspace({ section = "overview" }: { section?: BriefSection }) {
  const user = await getChatGPTUser();
  if (!user) redirect(`/login?return_to=${encodeURIComponent(briefPath(section))}`);

  return (
    <main className="beta-app-shell opportunity-ui">
      <a className="skip-link" href="#radar-content">Skip to your Radar</a>
      <header className="beta-app-header">
        <Link className="brand" href="/">
          <span className="brand-mark">R</span>
          <span>Campus Radar</span>
          <span className="beta">private beta</span>
        </Link>
        <div className="account-line">
          {isAdmin(user.email) && <Link href="/admin">Admin dashboard</Link>}
          <span>{user.displayName}</span>
          <a href={chatGPTSignOutPath("/")}>Sign out</a>
        </div>
      </header>
      <OpportunityOnboarding email={user.email} section={section} />
    </main>
  );
}
