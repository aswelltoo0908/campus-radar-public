import type { CareerEventSnapshot, CareerJob } from "../types";

/** Small, source-read pilot pool. Never claim these snapshots are a live/full database.
 * Refreshing a Radar must not advance reviewedAt. Expire from matching after seven days.
 * No private profile, cookies, or account credentials are included.
 */
export const CAREER_PILOT_JOBS: CareerJob[] = [
  {
    id:"interstride-206609399",title:"Data Science Undergraduate Intern",company:"Dell Technologies",url:"https://student.interstride.com/jobs/detail/206609399",
    source:"Interstride",sourceMode:"verified_snapshot",reviewedAt:"2026-10-16T15:37:33Z",status:"open",paid:true,
    summary:{en:"Undergraduate data-science internship involving analysis and programming on a services team.",zh:"面向本科生的数据科学实习，参与服务团队的数据分析与编程项目。"},
    location:"Hopkinton, MA / Round Rock, TX",workMode:"in_office",startsAt:null,deadline:null,
    academicLevels:["undergraduate"],keywords:["computer science","data","data science","software","ai"],roleTracks:["data_analytics","software_engineering","ai_ml"],
    sponsorship:"unknown",sponsorshipEvidence:{en:"The reviewed listing does not explicitly confirm sponsorship for this role.",zh:"所核查正文未明确确认该岗位提供 sponsorship。"},
    requirements:{en:["Bachelor's enrollment in CS, data science, natural sciences, engineering or a related field.","Python or R and SQL proficiency; communication skills. Skills are not inferred from your major."],zh:["要求就读计算机、数据科学、自然科学、工程或相关本科专业。","要求 Python 或 R、SQL 和沟通能力；不因专业相同就默认具备技能。"]},
  },
  {
    id:"interstride-191582939",title:"Campus UI Software Engineer (Intern)",company:"Jump Trading",url:"https://student.interstride.com/jobs/detail/191582939",
    source:"Interstride",sourceMode:"verified_snapshot",reviewedAt:"2026-10-16T04:59:40Z",status:"open",
    summary:{en:"Ten-week web/UI engineering internship. The body states Chicago, while the platform's remote field says remote; confirm the work arrangement.",zh:"为期十周的 Web/UI 工程实习。正文写 Chicago，平台远程字段却标为 Remote，工作方式需确认。"},
    location:"Chicago, IL · work arrangement needs confirmation",workMode:"unspecified",startsAt:null,deadline:null,
    academicLevels:[],keywords:["computer science","software","mathematics","web","design"],roleTracks:["software_engineering","ux_design"],
    sponsorship:"cpt_opt_and_fulltime",sponsorshipEvidence:{en:"The listing welcomes CPT/OPT-eligible interns and separately states work-visa sponsorship for full-time positions.",zh:"正文欢迎符合 CPT/OPT 条件的实习生，另说明全职岗位支持工作签证赞助。"},
    requirements:{en:["Requires strong Python/TypeScript or Python/Linux development and data structures/algorithms.","Your work authorization and availability for the ten-week program require confirmation."],zh:["要求较强的 Python/TypeScript 或 Python/Linux 开发，以及数据结构和算法能力。","需自行确认工作授权及是否能参加十周项目。"]},
  },
  {
    id:"interstride-201714614",title:"Reinsurance Operations Analyst Intern",company:"Enact Holdings",url:"https://student.interstride.com/jobs/detail/201714614",
    source:"Interstride",sourceMode:"verified_snapshot",reviewedAt:"2026-10-16T04:59:40Z",status:"open",
    summary:{en:"Twelve-week reinsurance operations internship starting May 17, 2027, covering reporting, project coordination and analysis.",zh:"2027 年 5 月 17 日开始、为期十二周的再保险运营实习，参与报告、项目协调和分析。"},
    location:"Raleigh, NC",workMode:"hybrid",startsAt:"2027-05-17",deadline:null,
    academicLevels:["undergraduate"],keywords:["business","economics","finance","accounting","operations","analytics"],roleTracks:["finance","data_analytics","consulting"],
    sponsorship:"explicit_role",sponsorshipEvidence:{en:"The role description explicitly states that this role is eligible for employment visa sponsorship.",zh:"该岗位正文明确写明可提供就业签证赞助。"},
    requirements:{en:["Undergraduate, rising junior or senior; minimum GPA 3.2/4.0. These have not been verified against your record.","Excel/Word/PowerPoint; reporting or visualization experience, preferably Tableau.","Availability for twelve weeks starting May 17, 2027, and Raleigh hybrid work needs confirmation."],zh:["要求本科、即将升大三或大四，GPA 至少 3.2/4.0；尚未核对你的个人情况。","要求 Excel/Word/PowerPoint，报告或可视化经验，优先 Tableau。","需确认能否参加 2027 年 5 月 17 日开始的十二周项目及 Raleigh 混合办公。"]},
  },
];

/** Read in the U-M Handshake session; event facts only, never account/attendee data. */
export const UMICH_CAREER_PILOT_EVENTS: CareerEventSnapshot[] = [
  {id:"handshake-2025784",title:"Internship Lab",url:"https://umich.joinhandshake.com/stu/events/2025784",when:"2026-10-26T13:00:00-04:00",location:"Virtual · 1–2 PM ET",reviewedAt:"2026-10-22T18:50:00Z",keywords:[],summary:{en:"U-M Career Center guidance on getting started with internship search. RSVP is required; confirm details and access in your own U-M Handshake account.",zh:"U-M Career Center 的实习搜索入门辅导，需 RSVP；请在自己的 U-M Handshake 账号确认详情及参加资格。"}},
  {id:"handshake-2025739",title:"Resume Lab",url:"https://umich.joinhandshake.com/stu/events/2025739",when:"2026-10-26T10:00:00-04:00",location:"Virtual · 10–11 AM ET",reviewedAt:"2026-10-22T18:50:00Z",keywords:[],summary:{en:"U-M Career Center guidance on building or improving a resume and finding available resources. RSVP is required; confirm details in your own U-M Handshake account.",zh:"U-M Career Center 的简历制作、改进与资源辅导，需 RSVP；请在自己的 U-M Handshake 账号核对详情。"}},
  {id:"handshake-2025773",title:"Internship Lab",url:"https://umich.joinhandshake.com/stu/events/2025773",when:"2026-10-21T10:00:00-04:00",location:"Virtual · 10–11 AM ET",reviewedAt:"2026-10-16T15:31:54Z",keywords:[],summary:{en:"A U-M Career Center workshop on internship search strategy, tools and next steps. RSVP is required; confirm access in your own U-M Handshake account.",zh:"U-M Career Center 的实习搜索策略与工具辅导，需 RSVP；请在自己的 U-M Handshake 账号确认访问和参加资格。"}},
  {id:"handshake-1996290",title:"Ask Me Anything: AlphaSights Information Session",url:"https://umich.joinhandshake.com/stu/events/1996290",when:"2026-10-21T17:00:00-04:00",location:"Mason Hall · Room 3330 · 5–6 PM ET",reviewedAt:"2026-10-16T15:31:54Z",keywords:["business","finance","consulting","economics","client service"],summary:{en:"An employer-hosted session with U-M alumni, recruiters and returning interns about AlphaSights. Relevant to exploring client-service and business careers; listing on Handshake is not university endorsement.",zh:"由雇主主办，与 U-M 校友、招聘人员和返聘实习生了解 AlphaSights，供探索客户服务与商业方向。收录于 Handshake 不代表学校背书。"}},
];
