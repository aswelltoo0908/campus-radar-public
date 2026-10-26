import { notFound } from "next/navigation";
import { isNewsSection } from "../../../../lib/brief-sections";
import BetaWorkspace from "../../BetaWorkspace";

export const dynamic = "force-dynamic";

export default async function NewsTopicPage({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  if (!isNewsSection(topic)) notFound();
  return <BetaWorkspace section={topic} />;
}
