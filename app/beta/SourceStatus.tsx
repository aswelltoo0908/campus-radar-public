import type { RadarPreview, SourceVerification } from "../../lib/types";
import { sourceStatusText } from "../../lib/source-policy";

export function SourceStatus({check,language}:{check?:SourceVerification;language:"en"|"zh"}) {
  if(!check)return null;
  return <p className="field-note source-status">{sourceStatusText(check,language)} <span>{language==="zh"?"访问检查":"Access checked"}: {check.checkedAt.slice(0,16).replace("T"," ")} UTC</span></p>;
}
export function SourceReviewPanel({preview}:{preview:RadarPreview}) {
  const checks=preview.sourceChecks,zh=preview.language==="zh";
  if(!checks)return null;
  return <aside className="source-review-panel" aria-label="Source checks">
    <p className="eyebrow">SOURCE CHECKS · NO MODEL TOKENS</p>
    <p>{zh?"显示和待发邮件前检查公开机会链接与已知申请/活动日期。公开页面检查最多缓存一小时；需登录内容不保证仍开放。":"Public opportunity links and known application/event dates are checked before display and queued email delivery. Public-page checks are cached for up to one hour; content behind sign-in is not guaranteed to remain open."}</p>
    {checks.withheld.length>0 && <details><summary>{zh?`${checks.withheld.length} 条暂不推荐：失效、已截止或尚无法核实`:`${checks.withheld.length} items withheld: missing, past due or not yet verifiable`}</summary><p>{zh?"这些条目不进入推荐或机会邮件。403 只说明自动访问被阻止，不等于页面不存在。可回原网站人工核实。":"These items are excluded from recommendations and opportunity emails. HTTP 403 only means an automated request was blocked, not that the page is missing. You may check the original site manually."}</p><ul>{checks.withheld.map(item=><li key={item.id}><strong>{item.title}</strong><SourceStatus check={item.verification} language={preview.language}/>{item.url && /^https:\/\//.test(item.url) && <a href={item.url} target="_blank" rel="noreferrer">{zh?"人工核实原来源":"Check original source manually"} ↗</a>}</li>)}</ul></details>}
  </aside>;
}
