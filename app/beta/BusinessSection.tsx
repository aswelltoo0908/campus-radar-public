import type { ReactNode } from "react";
import type { BusinessChannel, OpportunityMatch } from "../../lib/types";

const CHANNEL_LABELS: Record<BusinessChannel, { en: string; zh: string }> = {
  finance: { en: "Finance", zh: "金融" },
  accounting: { en: "Accounting", zh: "会计" },
  entrepreneurship: { en: "Startups", zh: "创业" },
  marketing: { en: "Marketing", zh: "市场营销" },
  management: { en: "Management", zh: "管理" },
  business_analytics: { en: "Business Analytics", zh: "商业分析" },
};

type BusinessSectionProps = {
  items: OpportunityMatch[];
  selectedChannels: BusinessChannel[];
  feedback: (id: string) => ReactNode;
  language: "en" | "zh";
  generatedAt: string;
};

function publishedTime(value: string | null): number {
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY;
}

function ageInDays(value: string | null, reference: number): number {
  const time = publishedTime(value);
  return Number.isFinite(time) && Number.isFinite(reference)
    ? Math.max(0, (reference - time) / 86_400_000)
    : 7;
}

function radarHeat(item: OpportunityMatch, reference: number): number {
  const freshnessBonus = Math.max(0, 14 - Math.floor(ageInDays(item.publishedAt, reference) * 2));
  return item.score + freshnessBonus;
}

function publishedLabel(value: string | null, reference: number, zh: boolean): string {
  if (!Number.isFinite(publishedTime(value)) || !Number.isFinite(reference)) return zh ? "近期" : "Recent";
  const days = Math.floor(ageInDays(value, reference));
  if (days === 0) return zh ? "今天" : "Today";
  if (days === 1) return zh ? "1 天前" : "1 day ago";
  return zh ? `${days} 天前` : `${days} days ago`;
}

export default function BusinessSection({ items, selectedChannels, feedback, language, generatedAt }: BusinessSectionProps) {
  const zh = language === "zh";
  const t = (cn: string, en: string) => zh ? cn : en;
  // Anchor freshness to the saved brief for consistent server/client rendering.
  const reference = publishedTime(generatedAt);
  const hotTopics = [...items].sort((a, b) => radarHeat(b, reference) - radarHeat(a, reference)).slice(0, 3);
  const latest = [...items].sort((a, b) => {
    const first = publishedTime(a.publishedAt), second = publishedTime(b.publishedAt);
    return first === second ? 0 : first > second ? -1 : 1;
  }).slice(0, 10);

  return (
    <section className="radar-section business-section" id="brief-business">
      <p className="eyebrow">BUSINESS RADAR</p>
      <h2>{t("值得关注的商业动态", "Business signals worth knowing")}</h2>
      <p>{t("根据你选择的商业兴趣匹配；新鲜度以简报生成时间为准。", "Personalized around your business interests. Freshness is measured when this brief was generated.")}</p>
      <div className="business-channel-list">
        {selectedChannels.map(channel => <span key={channel}>{CHANNEL_LABELS[channel][language]}</span>)}
      </div>
      {!items.length ? <p>{t("所选来源暂无近期商业资讯。", "No recent business updates are available from your selected sources.")}</p> : (
        <>
          <div className="business-hot-panel">
            <div className="business-lane-heading">
              <h3>{t("热门话题", "Hot Topics")}</h3>
              <span className="field-note">{t("匹配度 + 新鲜度", "Ranked by fit + freshness")}</span>
            </div>
            <ol className="business-hot-list">
              {hotTopics.map((item, index) => (
                <li key={item.id}>
                  <span className="business-rank" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <div className="business-feed-meta">
                      <span>{item.channel ? CHANNEL_LABELS[item.channel][language] : item.sourceName}</span>
                      <span>{publishedLabel(item.publishedAt, reference, zh)}</span>
                    </div>
                    <h4><a href={item.url} target="_blank" rel="noreferrer">{item.title}</a></h4>
                  </div>
                  <span className="business-heat" title={t("内部匹配分数加新鲜度奖励", "Internal match score plus freshness bonus")}>{Math.round(radarHeat(item, reference))}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="business-latest">
            <h3>{t("最新资讯", "Latest")}</h3>
            {latest.map(item => (
              <article className="business-feed-item" key={item.id}>
                <div className="business-feed-meta">
                  <span>{item.sourceName}</span>
                  {item.channel && <span>{CHANNEL_LABELS[item.channel][language]}</span>}
                  <span>{publishedLabel(item.publishedAt, reference, zh)}</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.summary}</p>
                <p className="business-fit"><strong>{t("与你的关联：", "Why it matters to you: ")}</strong>{item.why}</p>
                {item.sourceMode === "verified_snapshot" && <p className="field-note">{t("注明日期的核查快照，请回源确认。", "Dated, verified snapshot. Recheck the original source.")}</p>}
                <div className="brief-next-action"><span>{t("下一步", "NEXT STEP")}</span><p>{item.nextAction}</p></div>
                <a href={item.url} target="_blank" rel="noreferrer">{t("查看原始来源", "Read original source")} ↗</a>
                {feedback(item.id)}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
