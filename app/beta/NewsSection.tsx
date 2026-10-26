import Link from "next/link";
import type { ReactNode } from "react";
import type { OpportunityMatch, OpportunityPreferences, RadarPreview } from "../../lib/types";
import { BRIEF_LABELS, NEWS_SECTIONS, briefPath, type NewsSection as NewsTopic } from "../../lib/brief-sections";
import BusinessSection from "./BusinessSection";

type Props = {
  section: "news" | NewsTopic;
  preview: RadarPreview;
  preferences: OpportunityPreferences;
  card: (item: OpportunityMatch) => ReactNode;
  feedback: (id: string) => ReactNode;
  onEdit: () => void;
};

/** Presentation-only grouping. Existing stored flags, data and consent remain unchanged. */
export default function NewsSection({ section, preview, preferences, card, feedback, onEdit }: Props) {
  const language = preview.language, zh = language === "zh";
  const t = (cn: string, en: string) => zh ? cn : en;
  const enabled = { tech: preferences.aiNewsEnabled, business: preferences.newsEnabled };
  const counts = { tech: preview.aiNews?.length ?? 0, business: preview.businessNews?.length ?? 0 };
  const topicEnabled = section === "news" || enabled[section];
  return <section className="news-hub" id="brief-news" aria-label="News">
    <nav className="news-topic-nav" aria-label="News topics">
      <Link href={briefPath("news")} aria-current={section === "news" ? "page" : undefined}>{t("全部栏目", "All topics")}</Link>
      {NEWS_SECTIONS.map(topic => <Link key={topic} href={briefPath(topic)} aria-current={section === topic ? "page" : undefined}>{BRIEF_LABELS[topic][language]}</Link>)}
    </nav>
    {section === "news" && <div className="radar-section">
      <p className="eyebrow">NEWS · YOUR INTERESTS</p>
      <h2>{t("选择你关注的资讯", "Follow what matters to you")}</h2>
      <p>{t("Tech 与 Business 分开查看。更多资讯方向尚未开放。", "Explore Tech and Business separately. More news categories are not available yet.")}</p>
      <div className="news-topic-grid">
        {NEWS_SECTIONS.map(topic => <article className="news-topic-card" key={topic}>
          <p className="eyebrow">{topic === "tech" ? "01 · TECH" : "02 · BUSINESS"}</p>
          <h3>{BRIEF_LABELS[topic][language]}</h3>
          <p>{topic === "tech"
            ? t("可选 AIHOT 精选与 AI 原始出版方资讯；更广泛的科技资讯尚未接入。", "Optional AIHOT selections and AI publisher updates; broader technology coverage is not connected yet.")
            : t("金融、创业与其他已选择的商业兴趣，沿用现有匹配与排序。", "Finance, startups and your other selected business interests, using the existing matching and ranking.")}</p>
          <p className="field-note">{enabled[topic] ? t(`${counts[topic]} 条可用资讯`, `${counts[topic]} available updates`) : t("尚未开启此类资讯", "Updates are turned off")}</p>
          <Link href={briefPath(topic)}>{t("打开栏目", "Open topic")} ↗</Link>
        </article>)}
        <article className="news-topic-card news-topic-future" aria-label="More news categories coming later">
          <p className="eyebrow">COMING LATER</p><h3>{t("更多方向", "More topics")}</h3>
          <p>{t("其他资讯分类仍在规划中，当前没有可用内容或订阅。", "Additional news categories are still being planned. No content or subscriptions are available for them yet.")}</p>
          <span className="field-note">{t("尚未开放", "Not available yet")}</span>
        </article>
      </div>
    </div>}
    {!topicEnabled && <section className="radar-section section-disabled">
      <h2>{t("此栏目尚未开启", "Updates for this topic are turned off")}</h2>
      <p>{t("可在偏好设置中开启，再生成简报。你的选择不会被自动更改。", "Enable this topic in preferences, then rebuild your brief. Your choices are not changed automatically.")}</p>
      <button type="button" className="button primary" onClick={onEdit}>{t("调整偏好", "Edit preferences")}</button>
    </section>}
    {section === "business" && topicEnabled && <BusinessSection items={preview.businessNews || []} selectedChannels={preferences.newsChannels} feedback={feedback} language={language} generatedAt={preview.generatedAt} />}
    {section === "tech" && topicEnabled && <section className="radar-section" id="brief-tech">
      <p className="eyebrow">TECH · AI COVERAGE IN BETA</p><h2>{t("与你相关的科技资讯", "Tech updates for your interests")}</h2>
      <p className="field-note">{t("AI 资讯只是你的机会简报的一部分，不取代 Research、奖学金与实习推荐。AIHOT 内容保留原始语言，不代表覆盖整个科技行业。", "AI updates supplement your research, funding and career shortlist. AIHOT excerpts keep their original language; this is not whole-sector technology coverage.")}</p>
      {preview.aihotStatus && <p className="field-note">AIHOT: {preview.aihotStatus.status} · {preview.aihotStatus.checkedAt || "not fetched"} · {t("短期缓存最多 15 分钟，撤下条目在复核后移除", "Cache up to 15 minutes; removed items disappear after revalidation")}</p>}
      {(preview.aiNews || []).map(card)}
      {!preview.aiNews?.length && <p>{t("当前来源没有相关的近期资讯。没有匹配不代表今天没有新闻。", "No recent matching update is available from current sources. This does not mean there is no news today.")}</p>}
    </section>}
  </section>;
}
