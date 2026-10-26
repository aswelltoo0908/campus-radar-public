import { requireChatGPTUser } from "../../chatgpt-auth";
import LegacySources from "../LegacySources";
export const dynamic = "force-dynamic";
export default async function SettingsPage(){const user=await requireChatGPTUser("/beta/settings");return <main className="beta-app-shell"><header className="beta-app-header"><a href="/beta">← Back to opportunity brief</a><p>Optional sources — existing course and calendar tools</p></header><LegacySources email={user.email}/></main>;}
