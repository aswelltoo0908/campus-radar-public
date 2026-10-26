import type { RadarPreview } from "../types";
import { courseReminders, courseTime } from "../course-reminders";
import { sourceStatusText } from "../source-policy";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]!);
}

/** One content model for both HTML and plain text; no additional email-only truncation. */
export function renderRadarEmail(preview: RadarPreview, fullName: string | null, unsubscribeLink = "https://campus-radar-umich.aswelltoo.chatgpt.site/unsubscribe") {
  if (preview.formatVersion === 2) return renderOpportunityEmail(preview, fullName, unsubscribeLink);
  const zh = preview.language === "zh";
  const t = (cn: string, en: string) => zh ? cn : en;
  const title = t("你的今日 Campus Radar", "Your Campus Radar for today");
  const greeting = zh ? `${fullName || "同学"}，早上好` : `Good morning${fullName ? `, ${fullName}` : ""}`;
  type Entry = { title?: string; lines: string[]; links?: { label: string; url: string }[] };
  const sections: { heading: string; entries: Entry[]; empty: string }[] = [];
  const add = (heading: string, entries: Entry[], empty = "") => sections.push({ heading, entries, empty });
  const items = (heading: string, rows: RadarPreview["actions"], empty: string) => add(heading, rows.map(item => ({
    title: item.title,
    lines: [item.why, item.when ? `${t("时间", "When")}: ${item.when}` : "", item.location ? `${t("地点", "Where")}: ${item.location}` : "", `${t("下一步", "Next step")}: ${item.nextAction}`, `${t("来源", "Source")}: ${item.source}`, item.confidence !== "confirmed" ? t("请在来源页面确认时间和详情。", "Confirm timing and details on the source page.") : ""].filter(Boolean),
    links: item.url ? [{ label: t("查看来源", "View source"), url: item.url }] : [],
  })), empty);
  add(t("你的个性化 Insight", "Your personalized insight"), [{ title: preview.insight.title, lines: [preview.insight.detail, ...(preview.insight.evidence || [])] }]);
  if (preview.fieldInsight) {
    const f = preview.fieldInsight;
    add(t("专业 / Research / 产品 Insight", "Field / research / product insight"), [{ title: f.title, lines: [`${t("信号", "Signal")}: ${f.signal}`, `${t("对你的意义", "What it means for you")}: ${f.implication}`, `${t("可尝试的下一步", "Try this next")}: ${f.experiment}`], links: f.sources }]);
  }
  items(t("今天最值得推进", "Today's best next moves"), preview.actions, t("今天没有足够高匹配的行动。", "No action clears your match threshold today."));
  items(t("课程与手动添加的截止日期", "Classes and manually added deadlines"), preview.academic?.upcoming || [], preview.academic?.connected ? t("当前没有可展示的课程或截止日期。", "No upcoming classes or deadlines in the current data.") : t("尚未添加课表或截止日期；这不代表没有作业。", "No course schedule or deadlines added yet; this does not mean you have no assignments."));
  items(t("Canvas 截止日期与日历事项", "Canvas deadlines and calendar items"), preview.canvas?.upcoming || [], preview.canvas?.connected ? t("当前 Canvas 数据中没有即将到来的事项。", "No upcoming items in the current Canvas data.") : t("Canvas 未连接；无法判断你的作业截止日期。", "Canvas is not connected; your assignment deadlines are unknown."));
  items(t("个人日程 · Google Calendar", "Personal schedule · Google Calendar"), preview.googleCalendar?.upcoming || [], preview.googleCalendar?.connected ? t("当前日历中没有即将到来的事项。", "No upcoming items in the current calendar data.") : t("Google Calendar 未连接；时间冲突判断可能不完整。", "Google Calendar is not connected; conflict checks may be incomplete."));
  items(t("匹配机会与活动", "Matched opportunities and events"), preview.opportunities, t("当前没有匹配的机会或活动。", "No matching opportunities or events in the current data."));
  if (preview.researchLabs) {
    const labs = preview.researchLabs;
    add(t("Research Labs · 本科研究资源", "Research labs · Undergraduate research"), labs.matches.map(l => ({ title: l.name, lines: [l.department, l.areas.join(" / "), l.statusLabel, l.why, `${t("下一步", "Next step")}: ${l.nextAction}`, `${t("核查时间", "Verified at")}: ${l.verifiedAt}`, labs.sourceNote], links: [{ label: t("官方资源", "Official resource"), url: l.url }] })), labs.enabled ? t("当前没有匹配的研究资源。", "No matching research resources in the current data.") : t("你的配置尚未启用本校研究资源推荐。", "Campus research recommendations are not enabled for your profile."));
  }
  items(t("转发邮件中的机会与确认", "Opportunities and confirmations from forwarded emails"), preview.forwardedEmails || [], t("当前没有可展示的已解析转发邮件；Radar 不读取你的整个邮箱。", "No parsed forwarded messages to show; Radar does not read your whole inbox."));
  items(t("风险与提醒", "Risks and reminders"), preview.risk ? [preview.risk] : [], t("当前数据中没有标记风险；未连接的数据无法检查。", "No risk flagged in the current data; unconnected sources cannot be checked."));
  const safeLink = (url: string, label: string) => /^https?:\/\//i.test(url) ? `<a href="${escapeHtml(url)}" style="color:#1261a0">${escapeHtml(label)}</a>` : escapeHtml(label);
  const content = sections.map(s => `<div style="border-bottom:1px solid #d4dde3;padding:20px 0"><h2 style="font-size:21px;margin:0 0 14px">${escapeHtml(s.heading)}</h2>${s.entries.length ? s.entries.map((e, i) => `<div style="margin-bottom:20px">${e.title ? `<h3 style="font-size:17px">${s.entries.length > 1 ? `${i + 1}. ` : ""}${escapeHtml(e.title)}</h3>` : ""}${e.lines.map(line => `<p style="margin:8px 0;color:#4e6170">${escapeHtml(line)}</p>`).join("")}${(e.links || []).map(l => safeLink(l.url, l.label)).join("<br>")}</div>`).join("") : `<p style="color:#4e6170">${escapeHtml(s.empty)}</p>`}</div>`).join("");
  const webUrl = "https://campus-radar-umich.aswelltoo.chatgpt.site/beta";
  const webNote = t("简报内容已包含在本邮件中。使用 Ask Radar、修改配置或提交反馈，请打开网页版。", "Your report content is included here. Open the web Radar to use Ask Radar, edit settings, or give feedback.");
  const meta = preview.generatedAt ? `${t("生成时间", "Generated at")}: ${preview.generatedAt}` : "";
  const unsubscribeLabel = t("取消订阅日报", "Unsubscribe from daily emails");
  const footerNote = t("停止邮件，不删除账号和网页简报。", "Stops email delivery. Keeps your account and web Radar.");
  const html = `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#082b4c;line-height:1.6;overflow-wrap:anywhere"><div style="border-top:8px solid #ffcb05;background:#082b4c;color:white;padding:28px"><small style="color:#ffcb05;font-weight:bold">CAMPUS RADAR</small><h1 style="font-size:28px;margin:10px 0 4px">${escapeHtml(title)}</h1><p>${escapeHtml(greeting)}</p><small>${escapeHtml(meta)}</small></div><div style="padding:24px;border:1px solid #d4dde3">${content}<p style="font-size:12px;color:#4e6170">${escapeHtml(preview.attribution)}</p><p>${webNote}</p><p>${safeLink(webUrl, t("打开 Radar / Ask Radar", "Open Radar / Ask Radar"))}</p></div><div style="padding:24px;text-align:center">${safeLink(unsubscribeLink, unsubscribeLabel)}<p style="font-size:14px;color:#4e6170">${footerNote}</p></div></div>`;
  const text = [title, greeting, meta, ...sections.map(s => [s.heading, s.entries.length ? s.entries.map((e, i) => [e.title ? `${i + 1}. ${e.title}` : "", ...e.lines, ...(e.links || []).map(l => `${l.label}: ${l.url}`)].filter(Boolean).join("\n")).join("\n\n") : s.empty].join("\n\n")), preview.attribution, webNote, webUrl, `${unsubscribeLabel}: ${unsubscribeLink}`, footerNote].filter(Boolean).join("\n\n");
  return { subject: title, html, text };
}

function renderOpportunityEmail(preview: RadarPreview, fullName: string | null, unsubscribeLink: string) {
  const zh = preview.language === "zh", t = (cn:string,en:string)=>zh?cn:en;
  const sourceNote = (check: RadarPreview["researchLabs"]["matches"][number]["verification"]) => check ? `${sourceStatusText(check,preview.language)} ${t("访问检查","Access checked")}: ${check.checkedAt}` : "";
  type EmailEntry = {title:string;lines:string[];url:string;attributionUrl?:string;isNew?:boolean};
  const sections: {heading:string;entries:EmailEntry[]}[] = [];
  const freshIds = new Set<string>();
  const markFresh = (items?: Array<{id?:string}>) => items?.forEach(item=>{if(item.id)freshIds.add(item.id);});
  markFresh(preview.emailUpdates?.scholarships); markFresh(preview.emailUpdates?.businessNews);
  markFresh(preview.emailUpdates?.aiNews); markFresh(preview.emailUpdates?.externalEvents);
  markFresh(preview.emailUpdates?.opportunities); markFresh(preview.emailUpdates?.careerJobs);
  markFresh(preview.emailUpdates?.umichCareerEvents); markFresh(preview.emailUpdates?.campusEvents);
  preview.emailUpdates?.researchLabs.matches.forEach(item=>freshIds.add(item.id));
  const freshTag=t("新收录 / 有更新","NEW / UPDATED");
  const rows = (heading:string, entries: NonNullable<RadarPreview["scholarships"]>) => {
    if (entries.length) sections.push({heading,entries:entries.map(item=>({title:item.sourceId === "aihot" && !zh && item.originalTitle ? item.originalTitle : item.title,url:item.url,attributionUrl:item.sourceId === "aihot" ? item.attributionUrl : undefined,isNew:freshIds.has(item.id),lines:[item.sourceId === "aihot" ? `${t("来源：AIHOT · 原始报道", "Source: AIHOT · Original reporting")}: ${item.originalSourceName || ""}` : "",item.summary,item.why,
      item.amount||"",item.opensAt?`${t("开放","Opens")}: ${item.opensAt}`:"",item.deadline?`${t("截止","Deadline")}: ${item.deadline}`:"",
      item.publishedAt?`${t("发布","Published")}: ${item.publishedAt.slice(0,10)}`:"",item.sourceMode==="verified_snapshot"?t(`实时读取受阻，显示人工核查信息（${item.verifiedAt}）；请回源确认。`,`Live retrieval unavailable; showing a manually verified snapshot (${item.verifiedAt}). Recheck the source.`):"",sourceNote(item.verification),...item.unknownConditions,item.nextAction,`${t("来源","Source")}: ${item.sourceName}`].filter(Boolean)}))});
  };
  const courseItems = courseReminders(preview);
  if (courseItems.length) sections.push({heading:t("课程事项与 DDL","Course items & deadlines"),entries:courseItems.map(item=>({
    title:item.title,url:item.url || "",lines:[`${t("时间","When")}: ${courseTime(item.when!,preview.language)}`,`${t("来源","Source")}: ${item.source}`,item.nextAction,t("请回课程页面核实；日历事项不一定都是作业，上传文件不会自动同步后续变更。","Recheck your course page. Calendar items are not always assignments; uploaded files do not automatically sync later changes.")]
  }))});
  if(preview.researchLabs.matches.length)sections.push({heading:t("研究入口","Research pathways"),entries:preview.researchLabs.matches.map(lab=>({title:lab.name,url:lab.url,isNew:freshIds.has(lab.id),lines:[lab.statusLabel,lab.why,lab.nextAction,sourceNote(lab.verification),`${t("核查","Reviewed")}: ${lab.verifiedAt}`,t("目录不代表正在招人。","A directory does not establish an open position.")].filter(Boolean)}))});
  rows(t("奖学金与资助","Scholarships & funding"),preview.scholarships||[]);
  if(preview.careerJobs?.length)sections.push({heading:t("实习初筛 · 官网与核查来源","Internship shortlist · Employer and reviewed sources"),entries:preview.careerJobs.map(job=>({
    title:`${job.company} · ${job.title}`,url:job.url,isNew:freshIds.has(job.id),lines:[job.summary[zh?"zh":"en"],job.why,sourceNote(job.verification),job.location,job.paid===true?t("带薪岗位","Paid role"):"",job.startsAt?`${t("开始","Starts")}: ${job.startsAt}`:"",job.sponsorshipLabel,job.sponsorshipEvidence[zh?"zh":"en"],...job.checks.map(check=>`${t("需确认","Check")}: ${check}`),job.nextAction,`${job.sourceMode === "live" ? t("官网读取","Employer feed fetched") : t("人工核查","Reviewed")}: ${job.reviewedAt.slice(0,10)}`,t("来源覆盖有限；资格和开放状态请回源确认。","Source coverage is limited. Confirm eligibility and availability at the source.")].filter(Boolean)
  }))});
  const campus=preview.umichCareerEvents;
  const campusRows=preview.campusEvents || [];
  if(campusRows.length)sections.push({heading:t("U-M 校园活动","U-M campus events"),entries:campusRows.filter(item=>item.url).map(item=>({title:item.title,url:item.url!,isNew:freshIds.has(item.id),lines:[item.why,item.when?courseTime(item.when,preview.language):"",item.location||"",item.nextAction,sourceNote(item.verification),item.registrationUrl?`Handshake RSVP: ${item.registrationUrl}`:""].filter(Boolean)}))});
  // Historical saved briefs have no explicit campus lane. Keep their original output readable.
  const careers=campus === undefined ? preview.opportunities.filter(item=>/career|intern|recruit|job|handshake|interstride/i.test(`${item.title} ${item.source}`)).slice(0,3) : campus;
  const uniqueCareers=careers.filter(item=>!campusRows.some(event=>(event.registrationUrl || event.url)===(item.registrationUrl || item.url)));
  if(uniqueCareers.length)sections.push({heading:campus === undefined?t("职业机会信号","Career opportunity signals"):t("U-M 职业活动","U-M career events"),entries:uniqueCareers.filter(item=>item.url).map(item=>({title:item.title,url:item.url!,isNew:freshIds.has(item.id),lines:[sourceNote(item.verification),item.why,item.nextAction,item.when?courseTime(item.when,preview.language):"",item.location||"",item.registrationUrl?`${t("Handshake 报名","Handshake registration")}: ${item.registrationUrl}`:"",item.sourceMode==="verified_snapshot"?`${t("人工核查活动快照","Reviewed event snapshot")}: ${item.reviewedAt?.slice(0,10)}. ${t("时间和资格请回源确认。","Confirm timing and eligibility at the source.")}`:""].filter(Boolean)}))});
  const forwarded=(preview.forwardedEmails||[]).filter(item=>/career|intern|recruit|job|handshake|interstride|招聘|实习/i.test(`${item.title} ${item.source}`) && preview.opportunities.some(fresh=>fresh.id===item.id)).slice(0,3);
  if(campus !== undefined && forwarded.length)sections.push({heading:t("你转发的招聘信息","Recruiting messages you forwarded"),entries:forwarded.map(item=>({title:item.title,url:item.url||"",lines:[item.why,item.nextAction]}))});
  rows(t("商业资讯","Business updates"),preview.businessNews||[]);rows(t("AI 资讯","AI updates"),preview.aiNews||[]);rows(t("其他学校公开活动","Other universities' public events"),preview.externalEvents||[]);
  const title=t("你的 Campus Radar 机会简报","Your Campus Radar opportunity brief");
  const greeting=zh?`${fullName||"同学"}，你好`:`Hi${fullName?`, ${fullName}`:""}`;
  const sourceLink=(url:string,label:string)=>/^https:\/\//.test(url)?`<a href="${escapeHtml(url)}" style="color:#1261a0">${escapeHtml(label)}</a>`:escapeHtml(label);
  const content=sections.map(section=>`<section style="padding:18px 0;border-bottom:1px solid #d4dde3"><h2>${escapeHtml(section.heading)}</h2>${section.entries.map(item=>`${item.isNew?`<p style="margin:0;color:#517260;font-size:12px;font-weight:bold">${escapeHtml(freshTag)}</p>`:""}<h3>${escapeHtml(item.title)}</h3>${item.lines.map(line=>`<p>${escapeHtml(line)}</p>`).join("")}${sourceLink(item.url,t("查看原始来源","View original source"))}${item.attributionUrl ? `<p>${sourceLink(item.attributionUrl,t("来源：AIHOT · 阅读完整摘要","Source: AIHOT · Read on AIHOT"))}</p>` : ""}`).join("")}</section>`).join("");
  const web="https://campus-radar-umich.aswelltoo.chatgpt.site/beta";
  const guidance=t("这是当前仍有效的匹配精选；“新收录 / 有更新”表示自上次简报后新增或关键信息变化。未出现的栏目表示当前没有达到匹配门槛的内容。","These are your currently relevant matches. NEW / UPDATED marks items added or materially changed since your last brief. Sections are omitted when nothing currently clears your match threshold.");
  const text=[title,greeting,guidance,...sections.map(section=>[section.heading,...section.entries.map(item=>[item.isNew?freshTag:"",item.title,...item.lines,item.url,item.attributionUrl ? `Source: AIHOT · ${item.attributionUrl}` : ""].filter(Boolean).join("\n"))].join("\n\n")),web,`${t("取消订阅","Unsubscribe")}: ${unsubscribeLink}`].join("\n\n");
  const html=`<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;line-height:1.65;color:#00274c"><header style="border-top:8px solid #ffcb05;background:#00274c;color:white;padding:28px"><small>CAMPUS RADAR</small><h1>${escapeHtml(title)}</h1><p>${escapeHtml(greeting)}</p><p style="font-size:13px">${escapeHtml(guidance)}</p></header><div style="padding:24px">${content}<p>${sourceLink(web,t("打开完整简报与 Ask Radar","Open your brief & Ask Radar"))}</p><p>${sourceLink(unsubscribeLink,t("取消订阅","Unsubscribe"))}</p><small>${t("独立学生项目；资格和开放状态以原始来源为准。","Independent student project. Confirm eligibility and availability on the original source.")}</small></div></div>`;
  return {subject:title,html,text};
}
