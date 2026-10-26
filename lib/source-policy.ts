import type { SourceVerification } from "./types";

/** Only a verified official replacement is rewritten, including in old saved briefs. */
export function correctedSourceUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.hostname === "urop.umich.edu" && url.pathname === "/") return "https://lsa.umich.edu/urop/prospective-students/fall-winter-programs.html";
  } catch { /* Invalid input remains invalid, not a guessed URL. */ }
  return value;
}

/** Date-only deadlines close at the end of the stated Eastern calendar day, not UTC + 36h. */
export function sourceDateExpired(value: string, now = new Date()): boolean {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    if (!Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) return true;
    const today = new Intl.DateTimeFormat("en-CA", {timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
    return value < today;
  }
  return !Number.isFinite(Date.parse(value)) || Date.parse(value) < now.getTime();
}

export function sourceMayRecommend(check: SourceVerification): boolean {
  return check.status === "reachable" || check.status === "feed_verified" || check.status === "login_required";
}

export function sourceStatusText(check: SourceVerification, language: "en" | "zh") {
  const en: Record<SourceVerification["status"],string> = {
    reachable:"Source page responded. This does not confirm eligibility or an open application.",
    feed_verified:"Still present in AIHOT's current selected feed. The original publisher page was not automatically checked.",
    login_required:"Your own account/access is required. Availability behind sign-in was not automatically verified.",
    blocked:"The source blocked automated checking. This is not evidence that the page is missing or the application is closed.",
    not_found:"The original page is missing (HTTP 404/410 or a page-not-found response).",
    unavailable:"The source could not be checked because of a network, timeout or server error.",
    needs_review:"The source content or redirect needs review; it is not a verified application opportunity.",
    expired:"The known deadline or event time has passed.",
    closed:"The original listing explicitly reports that applications/registration are closed.",
    unsupported:"Automatic checks are not enabled for this source. Manual source review is required.",
  };
  const zh: typeof en = {
    reachable:"来源页面可读取；这不代表你符合资格或申请仍开放。",
    feed_verified:"AIHOT 当前精选仍提供此条目；未自动检查原始出版方页面。",
    login_required:"需要你自己的账号或访问权限；未自动核实登录后的开放状态。",
    blocked:"来源阻止了自动检查；不能据此判定页面不存在或申请已截止。",
    not_found:"原页面不存在（HTTP 404/410 或页面未找到）。",
    unavailable:"网络、超时或服务器错误，暂时无法核实来源。",
    needs_review:"来源内容或跳转需要复核，暂不作为已核实的申请机会。",
    expired:"已知截止日期或活动时间已过。",
    closed:"原岗位/活动明确说明申请或报名已关闭。",
    unsupported:"此来源尚未启用自动检查，需要人工核实。",
  };
  return (language === "zh" ? zh : en)[check.status];
}
