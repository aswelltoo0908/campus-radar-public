import { notFound, redirect } from "next/navigation";
import { isBriefSection } from "../../../lib/brief-sections";
import BetaWorkspace from "../BetaWorkspace";

export const dynamic = "force-dynamic";

export default async function BriefSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (section === "business") redirect("/beta/news/business");
  if (section === "ai") redirect("/beta/news/tech");
  if (!isBriefSection(section) || section === "overview") notFound();
  return <BetaWorkspace section={section} />;
}
