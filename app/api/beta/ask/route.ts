import { desc, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { profiles, radarRuns, sources } from "../../../../db/schema";
import { decryptSecret } from "../../../../lib/server/crypto";
import type { RadarItem, RadarPreview } from "../../../../lib/types";
import type { ManualAcademicData } from "../../../../lib/server/radar";
import { verifyRadarPreview } from "../../../../lib/server/verify-preview";
import { parseOpportunityPreferences } from "../../../../lib/opportunity-matching";

type AnswerSource = { label: string; url: string | null };

function nyDateKey(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function formatWhen(value: string | null) {
  if (!value) return "时间待查看官方页面";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function courseMeetsToday(days: string, weekday: string) {
  const normalized = days.toUpperCase().replace(/\s+/g, "");
  if (weekday === "Mon") return /MON|(^|[^T])M/.test(normalized);
  if (weekday === "Tue") return /TUE|TU|TR|TTH/.test(normalized);
  if (weekday === "Wed") return /WED|W/.test(normalized);
  if (weekday === "Thu") return /THU|TH|TR|TTH/.test(normalized);
  if (weekday === "Fri") return /FRI|F/.test(normalized);
  return false;
}

function itemSources(items: RadarItem[]): AnswerSource[] {
  return items
    .slice(0, 4)
    .map((item) => ({ label: item.title, url: item.url }));
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    question?: unknown;
  };
  const question = String(body.question ?? "")
    .trim()
    .slice(0, 500);
  if (!question) return Response.json({ error: "请输入问题" }, { status: 400 });

  const db = getDb();
  const [[profile], [latest], sourceRows] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.email, user.email)).limit(1),
    db
      .select()
      .from(radarRuns)
      .where(eq(radarRuns.userEmail, user.email))
      .orderBy(desc(radarRuns.createdAt), desc(radarRuns.id))
      .limit(1),
    db.select().from(sources).where(eq(sources.userEmail, user.email)),
  ]);
  if (!profile || !latest)
    return Response.json({ error: "请先生成一份 Radar" }, { status: 400 });
  const zh = profile.reportLanguage === "zh";

  const preview = await verifyRadarPreview({...JSON.parse(latest.outputJson),aihotOptIn:parseOpportunityPreferences(JSON.parse(profile.opportunityPreferencesJson)).aiNewsEnabled} as RadarPreview);
  if (preview.formatVersion === 2) {
    if (/events?|activities|活动|讲座|workshop|seminar/i.test(question)) {
      const rows=profile.isUmichStudent ? preview.campusEvents || preview.umichCareerEvents || [] : [];
      return Response.json({answer:rows.length ? zh ? "以下是你已保存简报中的 U-M 校园活动，时间和报名资格请回源确认。" : "These U-M campus events are saved in your brief. Confirm timing and registration eligibility on the source." : zh ? "当前简报没有匹配的校园活动。请在 Goals 开启 Campus events 并刷新简报。" : "No matched campus events in this brief. Enable Campus events in Goals and refresh your brief.",bullets:rows.map(item=>`${item.title} · ${item.when || ""} · ${item.why}`),sources:rows.map(item=>({label:item.title,url:item.url}))});
    }
    if (/intern|recruit|career|handshake|interstride|sponsor|实习|招聘|职业|赞助/i.test(question)) {
      const jobs = (preview.careerJobs || []).filter(job => Date.now() - Date.parse(job.reviewedAt) <= 7 * 86400000);
      const events = profile.isUmichStudent ? preview.umichCareerEvents || [] : [];
      return Response.json({
        answer: jobs.length || events.length
          ? zh ? "以下来自你已保存简报的实习初筛和 U-M 职业活动。不是完整岗位库；GPA、年级、技能和开放状态请逐项核对。" : "These internship candidates and U-M career events come from your saved brief, not a complete jobs database. Check GPA, year level, skills and availability before applying."
          : zh ? "当前保存简报中没有有效期内的匹配岗位或活动。请重新生成简报；这不代表没有适合你的机会。" : "No recently reviewed matching job or event is saved in this brief. Rebuild your brief; this does not mean no suitable opportunities exist.",
        bullets: [...jobs.map(job => `${job.company} · ${job.title} · ${job.sponsorshipLabel}\n${job.why}\n${job.checks.join("; ")}`), ...events.map(item => `${item.title} · ${item.when || ""} · ${item.nextAction}`)],
        sources: [...jobs.map(job => ({label: `${job.company} · ${job.title}`,url: job.url})), ...events.map(item => ({label:item.title,url:item.url}))],
      });
    }
    if (/scholar|fund|奖学金|资助/i.test(question)) {
      const rows = preview.scholarships || [];
      return Response.json({
        answer: rows.length
          ? zh
            ? "以下机会与你已填写的条件可能匹配，尚未确认的条件需要回官方页面核对。"
            : "These opportunities may match your stated conditions. Check the remaining requirements on their official pages."
          : zh
            ? "当前覆盖中没有匹配的资助机会。你可以调整目标与资格偏好；这不代表没有可申请项目。"
            : "No funding matched within current coverage. Review your goal and eligibility preferences; this does not mean no funding exists.",
        bullets: rows.map(
          (row) =>
            `${row.title} · ${row.amount || ""} · ${row.availability} · ${row.unknownConditions.join("; ")}`,
        ),
        sources: rows.map((row) => ({ label: row.title, url: row.url })),
      });
    }
    if (/news|finance|stock|资讯|新闻|金融|股票/i.test(question)) {
      const rows = [
        ...(preview.businessNews || []),
        ...(preview.aiNews || []),
      ].slice(0, 3);
      return Response.json({
        answer: zh
          ? "我可以说明已保存的资讯，并提供原始来源；当前不连接投资账户。"
          : "I can show updates saved in your brief with original sources. Investment accounts are not connected.",
        bullets: rows.map(
          (row) =>
            `${row.title} · ${row.publishedAt?.slice(0, 10)} · ${row.summary}`,
        ),
        sources: rows.map((row) => ({ label: row.title, url: row.url })),
      });
    }
    if (!/research|实验室|lab|教授|科研/i.test(question)) {
      const rows = preview.scholarships || [],
        lab = preview.researchLabs?.matches?.[0];
      const first = rows.find((row) => row.availability === "open") || rows[0];
      return Response.json({
        answer: first
          ? zh
            ? `可以先核对「${first.title}」的条件：${first.nextAction}`
            : `Start by checking “${first.title}”: ${first.nextAction}`
          : lab
            ? zh
              ? `可以先了解「${lab.name}」，再确认具体招募状态。`
              : `Explore “${lab.name}” and confirm recruitment status.`
            : zh
              ? "当前保存的机会不足，无法可靠安排申请顺序。"
              : "There are not enough saved opportunities to prioritize reliably.",
        bullets: first
          ? [first.why, ...first.unknownConditions]
          : lab
            ? [lab.why]
            : [],
        sources: first
          ? [{ label: first.title, url: first.url }]
          : lab
            ? [{ label: lab.name, url: lab.url }]
            : [],
      });
    }
  }
  let academic: ManualAcademicData = { courses: [], deadlines: [] };
  const academicSource = sourceRows.find(
    (source) => source.type === "manual_academic",
  );
  if (academicSource?.encryptedConfig) {
    try {
      academic = JSON.parse(
        await decryptSecret(academicSource.encryptedConfig),
      ) as ManualAcademicData;
    } catch {
      /* use empty academic data */
    }
  }

  if (/代写|帮我写作业|考试答案|恋爱|感情|医疗诊断|投资建议/.test(question)) {
    return Response.json({
      answer: zh
        ? "我只负责你的校园机会、课程截止日期和日程取舍。这件事不在 Ask Radar 的范围内。"
        : "I only help with campus opportunities, course deadlines, and schedule decisions. That request is outside Ask Radar's scope.",
      bullets: [],
      sources: [],
    });
  }

  const today = nyDateKey(new Date());
  const now = new Date();
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
  }).format(now);
  const todaysCourses = academic.courses.filter((course) =>
    courseMeetsToday(course.days, weekday),
  );
  const knownDeadlines = [...preview.canvas.upcoming, ...academic.deadlines]
    .filter(
      (item, index, items) =>
        items.findIndex(
          (candidate) =>
            candidate.title === item.title && candidate.when === item.when,
        ) === index,
    )
    .sort(
      (a, b) =>
        new Date(a.when || 0).getTime() - new Date(b.when || 0).getTime(),
    );
  const todaysDeadlines = knownDeadlines.filter(
    (item) => item.when && nyDateKey(item.when) === today,
  );
  const allRadarItems = [...preview.actions, ...preview.opportunities];
  const todaysEvents = allRadarItems.filter(
    (item) => item.when && nyDateKey(item.when) === today,
  );
  const futureEvents = preview.opportunities
    .filter((item) => !item.when || new Date(item.when) >= now)
    .slice(0, 5);

  const courseCode = question.match(
    /\b([A-Z]{2,8})\s*[- ]?\s*(\d{3,4}[A-Z]?)\b/i,
  );
  if (/due|ddl|作业|考试|截止|交什么/i.test(question)) {
    const matched = knownDeadlines
      .filter(
        (item) =>
          !courseCode ||
          item.title
            .toLowerCase()
            .includes(`${courseCode[1]} ${courseCode[2]}`.toLowerCase()),
      )
      .slice(0, 5);
    if (!matched.length)
      return Response.json({
        answer: zh
          ? courseCode
            ? `我没有找到 ${courseCode[1].toUpperCase()} ${courseCode[2].toUpperCase()} 已保存的截止日期。你可以刷新 Canvas 连接，或粘贴该课的 syllabus。`
            : "我没有找到已保存的课程截止日期。先连接 Canvas，或在“课程与日历”里粘贴 DDL。"
          : courseCode
            ? `I could not find a saved deadline for ${courseCode[1].toUpperCase()} ${courseCode[2].toUpperCase()}. Refresh Canvas or add the course syllabus.`
            : "I could not find a saved course deadline. Connect Canvas or add deadlines in Courses & calendar.",
        bullets: [],
        sources: [],
      });
    return Response.json({
      answer: zh
        ? `接下来最早的是「${matched[0].title}」，时间为 ${formatWhen(matched[0].when)}。`
        : `The next deadline is “${matched[0].title}” at ${formatWhen(matched[0].when)}.`,
      bullets: matched.map(
        (item) => `${formatWhen(item.when)} · ${item.title}`,
      ),
      sources: itemSources(matched),
    });
  }

  if (/今天|today|日程|安排|忙不忙/i.test(question)) {
    const bullets = [
      ...todaysCourses.map(
        (course) => `${course.time || "时间未识别"} · ${course.course}`,
      ),
      ...todaysDeadlines.map(
        (item) => `${formatWhen(item.when)} 截止 · ${item.title}`,
      ),
      ...todaysEvents.map((item) => `${formatWhen(item.when)} · ${item.title}`),
    ];
    const firstMove =
      todaysDeadlines[0] ?? todaysEvents[0] ?? preview.actions[0];
    const answer = zh
      ? bullets.length
        ? `今天已知有 ${bullets.length} 项安排。${firstMove ? `优先处理「${firstMove.title}」：${firstMove.nextAction}` : "目前没有紧急事项。"}`
        : `我没有读到今天的课程或日历事项。${firstMove ? `Radar 当前最建议你推进「${firstMove.title}」。` : "可以先添加课表或 Google Calendar。"}`
      : bullets.length
        ? `You have ${bullets.length} known items today.${firstMove ? ` Prioritize “${firstMove.title}”: ${firstMove.nextAction}.` : " Nothing is urgent right now."}`
        : `I did not find a course or calendar item for today.${firstMove ? ` Radar's top current recommendation is “${firstMove.title}.”` : " Add your schedule or Google Calendar for a fuller answer."}`;
    return Response.json({
      answer,
      bullets,
      sources: itemSources([...todaysEvents, ...todaysDeadlines]),
    });
  }

  if (/research|实验室|lab|教授|本科研究|科研/i.test(question)) {
    const labs = preview.researchLabs?.matches ?? [];
    if (!labs.length)
      return Response.json({
        answer: zh
          ? "你当前的 Radar 没有开启研究匹配。把“研究机会”设为学期目标，或选择 Academic Research 方向后重新生成。"
          : "Research matching is not enabled in your current Radar. Select Research Opportunities as a goal or choose Academic Research, then regenerate.",
        bullets: [],
        sources: [],
      });
    const best = labs[0];
    return Response.json({
      answer: zh
        ? `目前排序最靠前的是「${best.name}」。这是根据你的偏好排序，不代表录取概率。官方状态：${best.statusLabel}。`
        : `Your highest-ranked match is “${best.name}.” This is preference-based ranking, not an acceptance probability. Official status: ${best.statusLabel}.`,
      bullets: labs
        .slice(0, 4)
        .map(
          (lab) =>
            `${lab.name} · ${lab.statusLabel} · ${lab.areas.slice(0, 3).join(" / ")}`,
        ),
      sources: labs
        .slice(0, 4)
        .map((lab) => ({ label: lab.name, url: lab.url })),
    });
  }

  if (/建议|推荐|参加|值得|去哪个|选择/i.test(question)) {
    const named = futureEvents.filter((item) =>
      question.toLowerCase().includes(item.title.toLowerCase().slice(0, 12)),
    );
    const candidates = named.length ? named : futureEvents;
    const best = candidates.sort((a, b) => b.score - a.score)[0];
    if (!best)
      return Response.json({
        answer: zh
          ? "当前没有通过匹配阈值的活动，我不会为了给答案而编造推荐。"
          : "No event currently clears your match threshold, so I will not invent a recommendation.",
        bullets: [],
        sources: [],
      });
    return Response.json({
      answer: zh
        ? `建议优先参加「${best.title}」。它与你当前目标的匹配度最高（${best.score}%），第一步是：${best.nextAction}`
        : `Prioritize “${best.title}.” It has the strongest match to your current goals (${best.score}%). First step: ${best.nextAction}.`,
      bullets: [
        `${formatWhen(best.when)}${best.location ? ` · ${best.location}` : ""}`,
        best.why,
      ],
      sources: itemSources([best]),
    });
  }

  if (/活动|机会|后面|接下来|未来|event/i.test(question)) {
    if (!futureEvents.length)
      return Response.json({
        answer: zh
          ? "当前没有通过匹配阈值且已核验的后续活动。"
          : "There are no verified upcoming events above your match threshold.",
        bullets: [],
        sources: [],
      });
    return Response.json({
      answer: zh
        ? `接下来有 ${futureEvents.length} 个与你当前方向匹配的活动，最高匹配是「${futureEvents[0].title}」。`
        : `I found ${futureEvents.length} upcoming events that match your direction. The strongest match is “${futureEvents[0].title}.”`,
      bullets: futureEvents.map(
        (item) =>
          `${formatWhen(item.when)} · ${item.title}${item.location ? ` · ${item.location}` : ""}`,
      ),
      sources: itemSources(futureEvents),
    });
  }

  const first = preview.actions[0];
  return Response.json({
    answer: first
      ? zh
        ? `根据你当前的 Radar，最值得先推进的是「${first.title}」。你也可以问我“今天怎么安排”“接下来有什么活动”“我应该参加哪个”或某门课的 DDL。`
        : `Based on your current Radar, the best next move is “${first.title}.” You can also ask about today's schedule, upcoming events, which event to attend, research labs, or a course deadline.`
      : zh
        ? "当前 Radar 没有足够数据给出可靠判断。请先补充课程 DDL 或重新生成 Radar。"
        : "Your Radar does not have enough data for a reliable answer. Add course deadlines or regenerate it.",
    bullets: first ? [first.why, `下一步：${first.nextAction}`] : [],
    sources: first ? itemSources([first]) : [],
  });
}
