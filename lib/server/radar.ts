import type { BetaProfileInput, RadarItem, RadarPreview, ResearchLabMatch } from "../types";
import { matchCareerJobs, matchUmichCareerSnapshots, selectUmichCareerEvents } from "../career-matching";
import { CAREER_PILOT_JOBS, UMICH_CAREER_PILOT_EVENTS } from "./career-pilot";
import { verifyRadarPreview } from "./verify-preview";
import { fetchEmployerJobs } from "./employer-jobs";
import { readAihot } from "./aihot";

type UmichEvent = {
  id: string;
  combined_title?: string;
  event_title?: string;
  event_subtitle?: string;
  event_type?: string;
  description?: string;
  date_start?: string;
  time_start?: string;
  time_end?: string;
  location_name?: string;
  permalink?: string;
  website?: string;
  tags?: string[];
};

const VERIFIED_FALLBACK_EVENTS: UmichEvent[] = [
  {
    id: "149782-21907180", date_start: "2026-09-30", time_start: "10:00:00", time_end: "14:00:00",
    combined_title: "Engineering Career Cafe featuring Medtronic", event_type: "Careers / Jobs",
    description: "Medtronic is recruiting for open positions and networking with candidates for future opportunities. Advance signup in Career Fair Plus closes the day before.",
    location_name: "Duderstadt Center", permalink: "https://events.umich.edu/event/149782", website: "https://career.engin.umich.edu/",
    tags: ["career", "engineering", "internship"],
  },
  {
    id: "151454-21911616", date_start: "2026-09-30", time_start: "10:00:00", time_end: "11:00:00",
    combined_title: "International Students Career Series - Exploring Opportunities Beyond the U.S.", event_type: "Workshop / Seminar",
    description: "Learn how to navigate a global job search and build a flexible international career strategy. Registration is handled in Handshake.",
    location_name: "Online / see official page", permalink: "https://events.umich.edu/event/151454", website: "https://umich.joinhandshake.com/events/2010988/share_preview",
    tags: ["career", "international students", "Handshake"],
  },
  {
    id: "152939-21914818", date_start: "2026-09-30", time_start: "11:00:00", time_end: "13:00:00",
    combined_title: "Open House with Wayfair", event_type: "Careers / Jobs",
    description: "Drop in with Wayfair recruiters and Michigan alumni. Open roles include full-time, co-ops, Summer 2027 internships, and the 2027 Early Leaders program.",
    location_name: "LSA Building", permalink: "https://events.umich.edu/event/152939", website: "https://lsa.umich.edu/opportunityhub",
    tags: ["career", "internship", "networking"],
  },
  {
    id: "150032-21907885", date_start: "2026-09-30", time_start: "14:00:00", time_end: "15:00:00",
    combined_title: "Internship Lab", event_type: "Workshop / Seminar",
    description: "A University Career Center workshop with personalized support for internship search strategy and Handshake tools. RSVP is required.",
    location_name: "See official page", permalink: "https://events.umich.edu/event/150032", website: "https://umich.joinhandshake.com/edu/events/1988560",
    tags: ["career", "internship", "Handshake"],
  },
];

const GOAL_TERMS: Record<string, string[]> = {
  events: ["student", "workshop", "seminar", "lecture", "network", "career"],
  internship: ["intern", "career", "recruit", "employer", "job", "co-op"],
  full_time: ["full-time", "career", "recruit", "employer", "job"],
  research: ["research", "lab", "faculty", "academic", "seminar"],
  startup: ["startup", "entrepreneur", "venture", "innovation", "founder"],
  leadership: ["leadership", "student org", "community", "volunteer"],
  networking: ["network", "alum", "career", "workshop", "panel"],
  graduate_school: ["graduate school", "phd", "masters", "academic", "research"],
};

const ROLE_TERMS: Record<string, string[]> = {
  software_engineering: ["software", "developer", "computer science", "cse", "engineering"],
  ai_ml: ["artificial intelligence", " ai ", "machine learning", "data science", "generative ai"],
  data_analytics: ["data", "analytics", "statistics", "quantitative"],
  product_management: ["product", "strategy", "customer", "innovation"],
  ux_design: ["design", "user experience", "ux", "human-computer"],
  hardware_robotics: ["robotics", "hardware", "electrical", "ece", "embedded"],
  academic_research: ["research", "lab", "faculty", "seminar", "graduate"],
  consulting: ["consulting", "case", "strategy", "client"],
  finance: ["finance", "investment", "banking", "accounting", "economics"],
  biotech_health: ["biomedical", "health", "medical", "biotech", "life science"],
  climate_energy: ["climate", "energy", "sustainability", "environment"],
  policy_social_impact: ["policy", "public", "social impact", "community"],
  entrepreneurship: ["startup", "entrepreneur", "venture", "founder", "innovation"],
};

const ROLE_LABELS: Record<string, string> = {
  software_engineering: "Software Engineering", ai_ml: "AI / ML", data_analytics: "Data & Analytics",
  product_management: "Product Management", ux_design: "UX / Product Design", hardware_robotics: "Hardware & Robotics",
  academic_research: "Academic Research", consulting: "Consulting", finance: "Finance",
  biotech_health: "Biotech & Health", climate_energy: "Climate & Energy",
  policy_social_impact: "Policy & Social Impact", entrepreneurship: "创业与早期团队",
};

const STAGE_LABELS: Record<BetaProfileInput["careerStage"], string> = {
  exploring: "探索方向", preparing: "准备材料", applying: "集中申请", interviewing: "面试推进", deciding: "比较选择",
};

const BOTTLENECK_LABELS: Record<BetaProfileInput["bottleneck"], string> = {
  direction: "方向太多", finding: "找不到高质量机会", resume: "简历与作品集",
  networking: "缺少有效连接", applications: "申请执行不稳定", interviews: "面试准备", time: "时间与优先级",
};
const STAGE_LABELS_EN: typeof STAGE_LABELS = { exploring: "Exploring", preparing: "Preparing materials", applying: "Applying", interviewing: "Interviewing", deciding: "Comparing offers" };
const BOTTLENECK_LABELS_EN: typeof BOTTLENECK_LABELS = { direction: "Too many directions", finding: "Finding quality opportunities", resume: "Resume and portfolio", networking: "Building relevant connections", applications: "Application execution", interviews: "Interview preparation", time: "Time and priorities" };

const FIELD_INSIGHTS: Record<string, Omit<RadarPreview["fieldInsight"], "title"> & { title: string }> = {
  software_engineering: { title: "把“会写代码”升级为“能交付可靠系统”", signal: "入门项目越来越容易复制，能解释取舍、测试、性能和线上反馈的工程证据更稀缺。", implication: "你的下一份项目不应只展示功能，而要展示一个真实约束下的工程判断。", experiment: "选一个现有项目，本周补上性能指标、失败案例和一次可复现的技术取舍。", sources: [{ label: "Michigan CSE Research", url: "https://cse.engin.umich.edu/research/" }] },
  ai_ml: { title: "AI 项目的分水岭正在从 Demo 转向 Evaluation", signal: "模型调用本身不再稀缺，定义评价标准、构造失败集并证明效果才形成专业壁垒。", implication: "与其再做一个聊天界面，不如证明模型在某个具体学生工作流里何时有效、何时失效。", experiment: "为一个 AI 项目建立 20 条真实测试集，记录准确率、失败类型和改进前后差异。", sources: [{ label: "Michigan AI", url: "https://ai.engin.umich.edu/" }] },
  data_analytics: { title: "把分析结果变成一个可执行决策", signal: "漂亮图表只能证明工具能力；能说明“因此该做什么”的分析更接近真实岗位价值。", implication: "作品集应围绕决策者、约束和行动阈值组织，而不是围绕图表数量。", experiment: "挑一个校园问题，写出一页决策 memo：指标、结论、反例和明确建议。", sources: [{ label: "Michigan Data Science", url: "https://micde.umich.edu/" }] },
  product_management: { title: "产品判断来自用户证据，不来自功能清单", signal: "早期产品最有价值的证据不是做了多少功能，而是谁反复使用、在哪一步卡住、为何愿意回来。", implication: "你现在最该积累的是访谈—假设—行为数据—迭代的闭环。", experiment: "本周找 3 位目标用户完成同一任务，只记录犹豫、退出和主动追问的位置。", sources: [{ label: "Center for Entrepreneurship", url: "https://cfe.umich.edu/" }] },
  ux_design: { title: "作品集要证明行为改变，而不只是视觉完成度", signal: "招聘方更难从精美页面判断你是否理解用户、约束与迭代。", implication: "每个 case study 都需要一条可验证的用户问题和一次基于证据的取舍。", experiment: "重写一个项目首页，用三段话说明问题、关键证据与设计后行为变化。", sources: [{ label: "Stamps Career Resources", url: "https://stamps.umich.edu/resources/career-development" }] },
  hardware_robotics: { title: "硬件项目的专业度藏在系统整合与失败分析里", signal: "单个模块能运行不等于系统可靠；接口、延迟、能耗和异常恢复更能体现工程深度。", implication: "展示调试过程与边界条件，会比只展示最终视频更有说服力。", experiment: "为当前项目补一张接口图，并记录三个失败模式及验证方法。", sources: [{ label: "Michigan Robotics", url: "https://robotics.umich.edu/" }] },
  academic_research: { title: "先把兴趣收窄成一个可以被证伪的问题", signal: "“我对某领域感兴趣”很难让导师判断匹配度；具体问题、方法和已读文献能显著降低沟通成本。", implication: "联系导师前先形成一个小型 research brief。", experiment: "读 3 篇同一问题的近期论文，写出共同假设、分歧和一个你想验证的问题。", sources: [{ label: "UROP", url: "https://lsa.umich.edu/urop/prospective-students/fall-winter-programs.html" }] },
  consulting: { title: "让每次校园经历都沉淀成结构化问题解决证据", signal: "咨询准备不只是假设题训练，还需要展示你如何定义问题、分析数据并推动他人行动。", implication: "项目经历应被整理成清晰的情境、判断和量化结果。", experiment: "选一段经历，做一页 issue tree，并把结果改写成三条带数字的简历 bullet。", sources: [{ label: "University Career Center", url: "https://careercenter.umich.edu/" }] },
  finance: { title: "建立可辩护的行业观点，而不是只复述新闻", signal: "金融岗位更看重假设、驱动因素和风险意识，而不是信息收集量。", implication: "你需要一份能被追问的公司或行业 thesis。", experiment: "选一家目标公司，写出三个增长驱动、两个风险和一个会推翻判断的指标。", sources: [{ label: "Michigan Ross Career Development", url: "https://michiganross.umich.edu/undergraduate/bba/careers" }] },
  biotech_health: { title: "把技术价值放回临床、监管和使用流程中判断", signal: "健康产品的可行性同时受科学证据、工作流、隐私和监管约束。", implication: "项目洞察必须说明谁使用、在哪个流程使用，以及错误的代价。", experiment: "画出一个目标用户工作流，标出三处风险和一个最小可验证临床价值指标。", sources: [{ label: "Fast Forward Medical Innovation", url: "https://innovation.medicine.umich.edu/" }] },
  climate_energy: { title: "气候方案最终要通过部署经济性检验", signal: "技术性能只是起点，成本、基础设施、政策和采用速度决定真实影响。", implication: "你的分析需要同时回答减排效果和落地条件。", experiment: "为一个方案计算单位减排成本，并列出最可能阻碍部署的两个非技术因素。", sources: [{ label: "Graham Sustainability Institute", url: "https://graham.umich.edu/" }] },
  policy_social_impact: { title: "好政策洞察必须包含执行者与激励", signal: "政策文本与实际结果之间往往隔着预算、机构能力和利益相关者行为。", implication: "分析不应停在价值判断，要追踪具体执行链条。", experiment: "选一个政策，画出执行者、受影响者、激励和一个可衡量结果。", sources: [{ label: "Ford School Research", url: "https://fordschool.umich.edu/research-centers" }] },
  entrepreneurship: { title: "最值钱的创业进展是风险被消除，而不是功能增加", signal: "早期产品最大的未知通常是痛点频率、替代方案和使用意愿。", implication: "下一周计划应围绕最大未知，而不是围绕 backlog。", experiment: "定义当前最大假设，找 5 个目标用户，用行为或承诺验证它。", sources: [{ label: "Center for Entrepreneurship", url: "https://cfe.umich.edu/" }] },
};

const FIELD_INSIGHTS_EN: typeof FIELD_INSIGHTS = {
  software_engineering: { title: "Move from ‘can code’ to ‘can ship a reliable system’", signal: "Entry-level demos are easy to copy; evidence of tradeoffs, testing, performance, and production learning is scarcer.", implication: "Your next project should demonstrate an engineering judgment under a real constraint, not just a feature list.", experiment: "Add one performance metric, one failure case, and one reproducible technical tradeoff to an existing project this week.", sources: [{ label: "Michigan CSE Research", url: "https://cse.engin.umich.edu/research/" }] },
  ai_ml: { title: "AI projects now differentiate through evaluation, not the demo", signal: "Calling a model is no longer scarce; defining success, building failure sets, and proving improvement are.", implication: "Show when your model works, when it fails, and why that matters in one real workflow.", experiment: "Build a 20-example evaluation set and compare failure types before and after one improvement.", sources: [{ label: "Michigan AI", url: "https://ai.engin.umich.edu/" }] },
  data_analytics: { title: "Turn analysis into an executable decision", signal: "A polished chart proves tool use; a clear recommendation proves analytical judgment.", implication: "Organize your portfolio around the decision-maker, constraints, and action threshold.", experiment: "Write a one-page decision memo on a campus problem: metric, conclusion, counterexample, and recommendation.", sources: [{ label: "Michigan Data Science", url: "https://micde.umich.edu/" }] },
  product_management: { title: "Product judgment comes from user evidence, not feature volume", signal: "Early products learn most from who returns, where users hesitate, and what they try to accomplish.", implication: "Build a loop from interview to hypothesis to behavior data to iteration.", experiment: "Observe three target users doing the same task and record hesitation, exits, and unprompted questions.", sources: [{ label: "Center for Entrepreneurship", url: "https://cfe.umich.edu/" }] },
  ux_design: { title: "Your portfolio should prove behavior change, not only visual polish", signal: "A beautiful screen alone does not show that you understood users, constraints, or iteration.", implication: "Each case study needs a testable user problem and an evidence-based tradeoff.", experiment: "Rewrite one case study around the problem, decisive evidence, and resulting behavior change.", sources: [{ label: "Stamps Career Resources", url: "https://stamps.umich.edu/resources/career-development" }] },
  hardware_robotics: { title: "Systems integration and failure analysis reveal hardware depth", signal: "A working module is not a reliable system; interfaces, latency, power, and recovery matter.", implication: "Documenting boundary conditions is often more persuasive than another polished demo video.", experiment: "Create one interface diagram and document three failure modes with validation steps.", sources: [{ label: "Michigan Robotics", url: "https://robotics.umich.edu/" }] },
  academic_research: { title: "Narrow an interest into a falsifiable question", signal: "A broad interest gives a professor little evidence of fit; a concrete question, method, and reading list does.", implication: "Prepare a short research brief before contacting a lab.", experiment: "Read three recent papers on one question and write their shared assumption, disagreement, and one testable idea.", sources: [{ label: "UROP", url: "https://lsa.umich.edu/urop/prospective-students/fall-winter-programs.html" }] },
  consulting: { title: "Turn campus work into structured problem-solving evidence", signal: "Consulting readiness is more than case practice; it is proof that you framed a problem, analyzed evidence, and moved people.", implication: "Your experiences should show context, judgment, and measurable result.", experiment: "Build an issue tree for one experience and rewrite it as three quantified resume bullets.", sources: [{ label: "University Career Center", url: "https://careercenter.umich.edu/" }] },
  finance: { title: "Build a defensible view instead of repeating the news", signal: "Finance roles reward assumptions, drivers, and risk awareness more than information volume.", implication: "You need one company or industry thesis that can survive follow-up questions.", experiment: "Choose one company and write three growth drivers, two risks, and one metric that would change your view.", sources: [{ label: "Michigan Ross Career Development", url: "https://michiganross.umich.edu/undergraduate/bba/careers" }] },
  biotech_health: { title: "Judge technical value inside clinical, regulatory, and user workflows", signal: "Health products succeed only when evidence, workflow, privacy, and regulation align.", implication: "Explain who uses the product, where it fits, and the cost of being wrong.", experiment: "Map one user workflow, mark three risks, and define one minimum clinical-value metric.", sources: [{ label: "Fast Forward Medical Innovation", url: "https://innovation.medicine.umich.edu/" }] },
  climate_energy: { title: "Climate solutions ultimately face deployment economics", signal: "Technical performance is only the start; cost, infrastructure, policy, and adoption determine impact.", implication: "Evaluate both emissions impact and the conditions required to deploy.", experiment: "Estimate cost per unit of impact and identify two nontechnical blockers.", sources: [{ label: "Graham Sustainability Institute", url: "https://graham.umich.edu/" }] },
  policy_social_impact: { title: "Good policy insight includes implementers and incentives", signal: "Budgets, institutions, and stakeholder behavior stand between policy text and outcomes.", implication: "Trace the execution chain instead of stopping at a value judgment.", experiment: "Map implementers, affected groups, incentives, and one measurable outcome for a policy.", sources: [{ label: "Ford School Research", url: "https://fordschool.umich.edu/research-centers" }] },
  entrepreneurship: { title: "The best startup progress removes risk, not just backlog items", signal: "The largest early unknown is usually pain frequency, alternatives, and willingness to act.", implication: "Plan the week around the riskiest assumption, not the longest feature list.", experiment: "Name the biggest assumption and test it with five target users through behavior or commitment.", sources: [{ label: "Center for Entrepreneurship", url: "https://cfe.umich.edu/" }] },
};

type ResearchCatalogEntry = Omit<ResearchLabMatch, "why" | "score"> & {
  roleTracks: string[];
  keywords: string[];
};

const RESEARCH_LAB_CATALOG: ResearchCatalogEntry[] = [
  {
    id: "math-undergraduate-research", name: "Mathematics Undergraduate Research", department: "Mathematics",
    areas: ["Mathematics", "Geometry", "Undergraduate research"], status: "official_undergrad_pathway", statusLabel: "官方本科研究入口，需核对当前项目",
    nextAction: "查看院系研究入口与 LoG(M) 项目，核对课程背景和本轮开放要求",
    url: "https://lsa.umich.edu/math/undergraduates/research-and-career-opportunities/research.html", verifiedAt: "2026-10-14", roleTracks: [], keywords: ["math", "mathematics", "geometry", "数学"],
  },
  {
    id: "political-science-research", name: "Political Science Undergraduate Research", department: "Political Science",
    areas: ["Politics", "Policy", "Independent research"], status: "official_undergrad_pathway", statusLabel: "官方研究路径，非即时招募名单",
    nextAction: "阅读本科研究路径，核对研究项目、导师指导与独立研究要求",
    url: "https://prod.lsa.umich.edu/polisci/undergraduates/current-majors/undergraduate-research.html", verifiedAt: "2026-10-14", roleTracks: ["policy_social_impact"], keywords: ["political", "politics", "policy", "政治", "政策"],
  },
  {
    id: "urop-general", name: "UROP Undergraduate Research Pathways", department: "U-M Undergraduate Research Opportunity Program",
    areas: ["Social science", "Business", "Interdisciplinary research"], status: "official_undergrad_pathway", statusLabel: "官方跨学科入口，需核对项目资格与本轮开放",
    nextAction: "从 UROP 当前项目入口核对适用年级、申请周期和方向",
    url: "https://lsa.umich.edu/urop/prospective-students/fall-winter-programs.html", verifiedAt: "2026-10-18", roleTracks: [], keywords: ["social", "business", "economics", "management", "education", "社会", "商科", "经济"],
  },
  {
    id: "cse-faculty-projects", name: "CSE Faculty-Led Research Projects", department: "Computer Science & Engineering",
    areas: ["AI / ML", "Systems", "HCI", "Software", "Data"], status: "official_undergrad_pathway", statusLabel: "官方本科项目目录",
    nextAction: "打开当前项目表，挑 2 个方向匹配的项目并按页面要求申请",
    url: "https://cse.engin.umich.edu/academics/undergraduate/undergraduate-research-opportunities/undergraduate-research-descriptions/",
    verifiedAt: "2026-09-30", roleTracks: ["software_engineering", "ai_ml", "data_analytics", "ux_design", "academic_research"],
    keywords: ["computer science", "data science", "ai", "machine learning", "software", "hci"],
  },
  {
    id: "midas-student-connection", name: "MIDAS Faculty–Student Research Connection", department: "Michigan Institute for Data & AI in Society",
    areas: ["AI", "Data Science", "Interdisciplinary Research"], status: "official_undergrad_pathway", statusLabel: "本科生匹配项目",
    nextAction: "加入 student interest list；Winter 项目表公布后提交兴趣与简历",
    url: "https://midas.umich.edu/research/faculty-student-research-connection/",
    verifiedAt: "2026-09-30", roleTracks: ["ai_ml", "data_analytics", "software_engineering", "academic_research", "policy_social_impact"],
    keywords: ["ai", "data", "machine learning", "statistics", "policy", "social impact"],
  },
  {
    id: "ssi-robotics", name: "Scalable Spatial Intelligence Lab", department: "Michigan Robotics",
    areas: ["SLAM", "Spatial AI", "Robot Perception", "Autonomy"], status: "explicitly_recruiting", statusLabel: "明确欢迎本科生",
    nextAction: "查看当前 ROB 590 项目，并通过项目文档中的申请入口提交",
    url: "https://ssi.robotics.umich.edu/join-us",
    verifiedAt: "2026-09-30", roleTracks: ["hardware_robotics", "ai_ml", "software_engineering", "academic_research"],
    keywords: ["robotics", "slam", "spatial", "autonomy", "computer vision", "perception"],
  },
  {
    id: "ece-undergrad-research", name: "ECE Undergraduate Research", department: "Electrical & Computer Engineering",
    areas: ["Computer Engineering", "Electrical Engineering", "Hardware", "Applied AI"], status: "official_undergrad_pathway", statusLabel: "官方本科研究入口",
    nextAction: "浏览当前项目或选定 faculty，准备一封具体说明研究匹配度的邮件",
    url: "https://ece.engin.umich.edu/academics/undergraduate/undergrad-research/",
    verifiedAt: "2026-09-30", roleTracks: ["hardware_robotics", "software_engineering", "ai_ml", "academic_research"],
    keywords: ["electrical", "computer engineering", "hardware", "embedded", "robotics", "signal"],
  },
  {
    id: "aton-lab", name: "Aton Lab", department: "Molecular, Cellular & Developmental Biology",
    areas: ["Sleep", "Memory", "Neuroscience", "Imaging"], status: "explicitly_recruiting", statusLabel: "Fall 2026 明确招募",
    nextAction: "阅读项目说明并使用实验室页面的本科 RA 申请入口",
    url: "https://sites.lsa.umich.edu/aton-lab/join-us/",
    verifiedAt: "2026-09-30", roleTracks: ["biotech_health", "academic_research"],
    keywords: ["biology", "neuroscience", "sleep", "memory", "health", "mcdb"],
  },
  {
    id: "geomicrobiology-lab", name: "Michigan Geomicrobiology Lab", department: "Earth & Environmental Sciences",
    areas: ["Microbiomes", "Genomics", "Biogeochemistry", "Environmental Science"], status: "explicitly_recruiting", statusLabel: "Fall 2026 明确招募",
    nextAction: "查看 Fall 2026 项目说明并完成官方兴趣表",
    url: "https://sites.lsa.umich.edu/geomicro/opportunities/",
    verifiedAt: "2026-09-30", roleTracks: ["biotech_health", "climate_energy", "data_analytics", "academic_research"],
    keywords: ["biology", "microbiology", "genomics", "climate", "environment", "geology", "bioinformatics"],
  },
  {
    id: "eeb-faculty", name: "EEB Faculty Accepting Undergraduate Researchers", department: "Ecology & Evolutionary Biology",
    areas: ["Ecology", "Evolution", "Genomics", "Plant Biology", "Microbiomes"], status: "explicitly_recruiting", statusLabel: "院系明确列为接受本科生",
    nextAction: "从官方名单选 2 位方向最匹配的 faculty，阅读近期项目后发定制邮件",
    url: "https://lsa.umich.edu/eeb/undergraduates/research.html",
    verifiedAt: "2026-09-30", roleTracks: ["climate_energy", "biotech_health", "data_analytics", "academic_research"],
    keywords: ["ecology", "evolution", "biology", "genomics", "environment", "climate", "microbiome"],
  },
  {
    id: "rise-lab", name: "RISE Lab", department: "Psychology",
    areas: ["Identity", "Social Context", "Early Development", "Behavioral Research"], status: "explicitly_recruiting", statusLabel: "页面注明 currently seeking",
    nextAction: "核对时间投入要求，完成 RA application 并按页面说明发送",
    url: "https://sites.lsa.umich.edu/airlab/interested-in-joining-our-lab/",
    verifiedAt: "2026-09-30", roleTracks: ["academic_research", "policy_social_impact", "data_analytics"],
    keywords: ["psychology", "identity", "social", "development", "behavior", "education"],
  },
  {
    id: "hailab", name: "HAILab", department: "Psychology",
    areas: ["Social Psychology", "Judgment", "Decision-Making", "Behavioral Data"], status: "contact_to_confirm", statusLabel: "本科 RA 申请可提交",
    nextAction: "先阅读研究方向，再下载 RA application 并联系 Lab Manager",
    url: "https://sites.lsa.umich.edu/hailab/join/",
    verifiedAt: "2026-09-30", roleTracks: ["academic_research", "data_analytics", "product_management", "policy_social_impact"],
    keywords: ["psychology", "behavior", "decision", "social", "data", "product"],
  },
  {
    id: "baker-lab", name: "Baker Lab", department: "Biomedical Engineering",
    areas: ["Vascular Biology", "Tissue Engineering", "Mechanobiology"], status: "contact_to_confirm", statusLabel: "接受本科生咨询",
    nextAction: "阅读近期研究，发送包含具体兴趣与 CV 的简短邮件",
    url: "https://www.baker.bme.umich.edu/contact",
    verifiedAt: "2026-09-30", roleTracks: ["biotech_health", "hardware_robotics", "academic_research"],
    keywords: ["biomedical", "biology", "health", "tissue", "vascular", "engineering"],
  },
];

function researchLabMatches(profile: BetaProfileInput): ResearchLabMatch[] {
  const zh = profile.reportLanguage === "zh";
  const enabled = profile.goals.includes("research") || profile.goals.includes("graduate_school") || profile.roleTracks.includes("academic_research");
  if (!enabled) return [];
  const profileText = [profile.major, ...profile.interests, profile.customInterest || ""].join(" ").toLowerCase();
  return RESEARCH_LAB_CATALOG.filter(lab => lab.keywords.some(keyword => profileText.includes(keyword)) || lab.roleTracks.some(role => role !== "academic_research" && profile.roleTracks.includes(role))).map((lab) => {
    let score = lab.status === "explicitly_recruiting" ? 58 : lab.status === "official_undergrad_pathway" ? 54 : 43;
    const roleHits = lab.roleTracks.filter((role) => profile.roleTracks.includes(role));
    const keywordHits = lab.keywords.filter((keyword) => profileText.includes(keyword));
    score += Math.min(28, roleHits.length * 11) + Math.min(18, keywordHits.length * 9);
    if (profile.goals.includes("research")) score += 8;
    const evidence = zh ? [
      roleHits.length ? `匹配你的 ${roleHits.map((role) => ROLE_LABELS[role] ?? role).slice(0, 2).join(" / ")} 方向` : "与你的研究目标相关",
      keywordHits.length ? `命中兴趣：${keywordHits.slice(0, 3).join("、")}` : lab.areas.slice(0, 2).join("、"),
    ] : [
      roleHits.length ? `Matches your ${roleHits.map((role) => ROLE_LABELS[role] ?? role).slice(0, 2).join(" / ")} direction` : "Relevant to your research goal",
      keywordHits.length ? `Interest match: ${keywordHits.slice(0, 3).join(", ")}` : lab.areas.slice(0, 2).join(" and "),
    ];
    const isOldRecruitment = lab.status === "explicitly_recruiting" && Date.now() - Date.parse(lab.verifiedAt) > 7 * 86400000;
    const englishStatus = isOldRecruitment ? "Previously welcomed undergraduates; reconfirm recruitment" : lab.status === "explicitly_recruiting" ? "Explicitly welcomes undergraduates" : lab.status === "official_undergrad_pathway" ? "Official undergraduate pathway" : "Contact to confirm availability";
    const englishAction = lab.status === "official_undergrad_pathway"
      ? "Open the official project page, shortlist two strong matches, and follow its application instructions"
      : lab.status === "explicitly_recruiting"
        ? "Review the lab's current work and apply through the official undergraduate pathway"
        : "Read the lab's recent work and send a concise, specific inquiry with your CV";
    return { ...lab, status: isOldRecruitment ? "contact_to_confirm" as const : lab.status, statusLabel: zh ? isOldRecruitment ? "此前欢迎本科生，当前招募需重新确认" : lab.statusLabel : englishStatus, nextAction: zh ? lab.nextAction : englishAction, score: Math.min(98, score), why: evidence.join(zh ? "；" : "; ") };
  }).sort((a, b) => b.score - a.score).slice(0, 4).map(({ roleTracks: _roles, keywords: _keywords, ...lab }) => lab);
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function cleanText(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function eventText(event: UmichEvent) {
  return cleanText([
    event.combined_title,
    event.event_title,
    event.event_subtitle,
    event.event_type,
    event.description,
    ...(event.tags ?? []),
  ].filter(Boolean).join(" ")).toLowerCase();
}

function scoreEvent(event: UmichEvent, profile: BetaProfileInput) {
  const text = eventText(event);
  const has=(term:string)=>containsEventTerm(text,term);
  let score = 18;
  if (has(profile.major)) score += 18;
  for (const goal of profile.goals) {
    if (goal.startsWith("other:") && has(goal.slice(6))) score += 13;
    score += Math.min(18,(GOAL_TERMS[goal] || []).filter(has).length*9);
  }
  for (const interest of profile.interests) {
    const term = interest.startsWith("other:") ? interest.slice(6) : interest;
    if (has(term)) score += 13;
  }
  for (const role of profile.roleTracks) {
    score += Math.min(20,(ROLE_TERMS[role] || []).filter(has).length*10);
  }
  if (/career|job|intern|research|workshop|seminar|network/.test(text)) score += 14;
  if (/undergraduate|student/.test(text)) score += 5;
  if (/exhibition|performance|sporting event/.test(text)) score -= 28;
  if (
    profile.sponsorship === "needed" &&
    /us citizen|u\.s\. citizen|permanent resident|security clearance/.test(text)
  ) score -= 80;
  return Math.max(0, Math.min(99, score));
}

/** Acronyms such as AI must not match 'chair', 'training' or 'fair'. */
function containsEventTerm(text:string,term:string) {
  const normalized=term.trim().toLowerCase();
  if(!normalized)return false;
  const escaped=normalized.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const suffix=["intern","recruit","network","alum","math","politic"].includes(normalized)?"[\\p{L}]*":"";
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}${suffix}(?=$|[^\\p{L}\\p{N}])`,"u").test(text);
}

function eventToRadar(event: UmichEvent, profile: BetaProfileInput): RadarItem {
  const zh = profile.reportLanguage === "zh";
  const title = event.combined_title || event.event_title || "U-M opportunity";
  const time = event.date_start ? easternEventTime(event.date_start, event.time_start) : null;
  const matched = profile.interests
    .map((interest) => interest.startsWith("other:") ? interest.slice(6) : interest)
    .filter((interest) => containsEventTerm(eventText(event),interest));
  const reason = matched.length
    ? zh ? `与你关注的 ${matched.slice(0, 2).join("、")} 直接相关，且来自 U-M 官方活动源。` : `Directly related to your interest in ${matched.slice(0, 2).join(" and ")}, from an official U-M event source.`
    : zh ? `与你选择的目标相关，值得在日程允许时进一步查看。` : "Relevant to your selected goals and worth reviewing if it fits your schedule.";
  const career = /\b(?:careers?|recruit(?:ing|ment)?|internships?|employer|job fair|resume|networking)\b|职业|招聘|实习/i.test(`${event.event_type || ""} ${title}`) || /\b(?:recruiters?|internship applications?|job openings?)\b/i.test(event.description || "");
  let registrationUrl: string | null = null;
  try {
    const candidate = new URL(event.website || "");
    if (candidate.protocol === "https:" && candidate.hostname.endsWith(".joinhandshake.com") && !candidate.username && !candidate.password) registrationUrl = candidate.href;
  } catch { /* An event reference is not treated as a connected Handshake account. */ }
  return {
    id: `umich-${event.id}`,
    title: cleanText(title),
    why: reason,
    nextAction: event.website ? (zh ? "查看详情并确认报名要求" : "Review the details and confirm registration requirements") : (zh ? "打开官方活动页核实并决定是否参加" : "Open the official event page and decide whether to attend"),
    when: time || null,
    location: event.location_name || null,
    url: event.permalink?.replace("http://", "https://") || event.website || null,
    source: career && registrationUrl ? "U-M career event · Handshake registration" : "Happening @ Michigan",
    campusScope: "umich",
    kind: career ? "career_event" : "event",
    registrationUrl,
    confidence: "confirmed",
    score: scoreEvent(event, profile),
  };
}

export function easternEventTime(date: string, time?: string): string {
  if (!time) return date;
  const local = `${date}T${time.slice(0,8).padEnd(8,"0")}`;
  const assumed = new Date(`${local}Z`);
  const offset = new Intl.DateTimeFormat("en-US", {timeZone:"America/New_York",timeZoneName:"longOffset"}).formatToParts(assumed).find(p=>p.type==="timeZoneName")?.value.replace("GMT","") || "-05:00";
  return `${local}${offset}`;
}

export async function fetchUmichOpportunities(profile: BetaProfileInput, start = new Date(), fetcher: typeof fetch = fetch) {
  const end = new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);
  const url = new URL("https://events.umich.edu/list/json");
  url.searchParams.set("v", "2");
  url.searchParams.set("filter", "show:new");
  url.searchParams.set("range", `${dateOnly(start)}to${dateOnly(end)}`);
  url.searchParams.set("max-results", "500");
  const response = await fetcher(url.href, { redirect:"manual", signal: AbortSignal.timeout(9000), headers:{Accept:"application/json","User-Agent":"CampusRadar/2.0"} });
  if (!response.ok) throw new Error(`U-M events returned ${response.status}`);
  const events = await response.json() as UmichEvent[];
  if (!Array.isArray(events)) throw new Error("U-M events schema changed");
  return events.slice(0,500)
    .filter(event=>event.date_start && !/cancelled|canceled/i.test(event.combined_title || "") &&
      new Date(easternEventTime(event.date_start,event.time_start)).getTime() >= start.getTime() &&
      new Date(easternEventTime(event.date_start,event.time_start)).getTime() <= end.getTime())
    .map((event) => eventToRadar(event, profile))
    .filter((item) => item.score >= 32)
    .sort((a, b) => b.score - a.score)
    .slice(0, 40);
}

function verifiedFallbackOpportunities(profile: BetaProfileInput) {
  const today = dateOnly(new Date());
  const horizon = dateOnly(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  return VERIFIED_FALLBACK_EVENTS
    .filter((event) => event.date_start && event.date_start >= today && event.date_start <= horizon)
    .map((event) => eventToRadar(event, profile))
    .filter((item) => item.score >= 32)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function unfoldIcs(text: string) {
  return text.replace(/\r?\n[ \t]/g, "");
}

function decodeIcs(value: string) {
  return value
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function parseIcsDate(value: string) {
  const normalized = value.trim();
  const match = normalized.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?Z?)?/);
  if (!match) return null;
  const [, year, month, day, hour = "23", minute = "59", second = "00"] = match;
  const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}${normalized.endsWith("Z") ? "Z" : "-04:00"}`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseCalendarIcs(text: string, sourceName: string): RadarItem[] {
  const now = new Date();
  const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const blocks = unfoldIcs(text).split("BEGIN:VEVENT").slice(1);
  const items: RadarItem[] = [];
  for (const block of blocks) {
    const fields = new Map<string, string>();
    for (const line of block.split(/\r?\n/)) {
      const separator = line.indexOf(":");
      if (separator < 0) continue;
      const key = line.slice(0, separator).split(";")[0];
      if (!fields.has(key)) fields.set(key, line.slice(separator + 1));
    }
    const due = parseIcsDate(fields.get("DTSTART") || fields.get("DUE") || "");
    if (!due || due < now || due > horizon) continue;
    const title = decodeIcs(fields.get("SUMMARY") || "Canvas deadline");
    items.push({
      id: `calendar-${decodeIcs(fields.get("UID") || `${title}-${due.toISOString()}`)}`,
      title,
      why: `这是 ${sourceName} 中未来 14 天内的真实日程，越接近开始或截止时间优先级越高。`,
      nextAction: sourceName.startsWith("Canvas") ? "打开 Canvas，确认要求并安排第一段完成时间" : "打开日历，确认详情并为它预留时间",
      when: due.toISOString(),
      location: null,
      url: fields.get("URL") ? decodeIcs(fields.get("URL")!) : null,
      source: sourceName,
      confidence: "confirmed",
      score: Math.max(40, 98 - Math.floor((due.getTime() - now.getTime()) / 86_400_000) * 5),
    });
  }
  return items.sort((a, b) => new Date(a.when!).getTime() - new Date(b.when!).getTime()).slice(0, 8);
}

export function parseCanvasIcs(text: string): RadarItem[] {
  return parseCalendarIcs(text, "Canvas Calendar Feed");
}

export function validateCanvasFeedUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Enter the complete Canvas Calendar Feed link."); }
  if (url.protocol === "webcal:") url.protocol = "https:";
  if (url.protocol !== "https:") throw new Error("The Canvas Feed must use HTTPS.");
  const host = url.hostname.toLowerCase();
  if (!(host === "instructure.com" || host.endsWith(".instructure.com"))) {
    throw new Error("This Beta supports Canvas Feeds hosted on instructure.com. Upload an .ics file for other hosts.");
  }
  if (url.username || url.password || (url.port && url.port !== "443") || !/^\/feeds\/calendars\/[^/]+\.ics$/.test(url.pathname)) {
    throw new Error("Use the original HTTPS Canvas Calendar Feed address ending in .ics.");
  }
  return url;
}

export async function fetchCanvasDeadlines(value: string) {
  const url = validateCanvasFeedUrl(value);
  const response = await fetch(url, {
    signal: AbortSignal.timeout(12_000),
    redirect: "manual",
    headers: {
      Accept: "text/calendar,text/plain;q=0.9,*/*;q=0.8",
      "User-Agent": "Mozilla/5.0 (compatible; CampusRadar/1.0; +https://campus-radar-umich.aswelltoo.chatgpt.site)",
    },
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error("Canvas blocked the server from reading this private Feed. Open the same link in your browser, download the .ics file, then upload it in Radar.");
  }
  if (!response.ok) throw new Error(`Canvas Feed could not be read (${response.status}). Download the .ics file and upload it instead.`);
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  if (!contentType.includes("calendar") && !text.includes("BEGIN:VCALENDAR")) {
    throw new Error("This link did not return a valid Calendar Feed. Try uploading the original .ics file.");
  }
  return parseCanvasIcs(text);
}

type CanvasPlannerItem = {
  plannable_id?: string | number;
  plannable_type?: string;
  plannable_date?: string;
  html_url?: string;
  course_id?: string | number;
  submissions?: false | { graded?: boolean; excused?: boolean };
  planner_override?: null | { marked_complete?: boolean };
  plannable?: {
    id?: string | number;
    title?: string;
    name?: string;
    due_at?: string;
    todo_date?: string;
    start_at?: string;
    html_url?: string;
  };
};

export function validateCanvasBaseUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Enter the complete Canvas instance URL."); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || !(host === "instructure.com" || host.endsWith(".instructure.com"))) {
    throw new Error("This Beta supports HTTPS Canvas API addresses hosted on instructure.com.");
  }
  if (url.username || url.password || (url.port && url.port !== "443")) throw new Error("Use the original Canvas HTTPS address.");
  return url.origin;
}

export async function fetchCanvasApiDeadlines(baseUrlValue: string, tokenValue: string) {
  const baseUrl = validateCanvasBaseUrl(baseUrlValue);
  const token = tokenValue.trim();
  if (token.length < 20 || token.length > 500) throw new Error("The Canvas Access Token format is invalid.");
  const now = new Date();
  const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const url = new URL("/api/v1/planner/items", baseUrl);
  url.searchParams.set("start_date", now.toISOString());
  url.searchParams.set("end_date", horizon.toISOString());
  url.searchParams.set("per_page", "100");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(9000),
    redirect: "manual",
  });
  if (response.status === 401 || response.status === 403) throw new Error("Canvas rejected this token or your school has not enabled API access. Try a Calendar Feed or .ics upload.");
  if (!response.ok) throw new Error(`The Canvas API could not be read (${response.status}). Try again or use a Calendar Feed.`);
  const payload = await response.json();
  if (!Array.isArray(payload)) throw new Error("The Canvas API returned an unsupported response.");
  const items: RadarItem[] = [];
  for (const item of payload as CanvasPlannerItem[]) {
    if (item.planner_override?.marked_complete || (item.submissions && (item.submissions.graded || item.submissions.excused))) continue;
    const rawDate = item.plannable?.due_at || item.plannable?.todo_date || item.plannable_date || item.plannable?.start_at;
    if (!rawDate) continue;
    const due = new Date(rawDate);
    if (Number.isNaN(due.getTime()) || due < now || due > horizon) continue;
    const title = String(item.plannable?.title || item.plannable?.name || "Canvas item").trim();
    const rawUrl = item.html_url || item.plannable?.html_url;
    const itemUrl = rawUrl ? new URL(rawUrl, baseUrl).toString() : null;
    items.push({
      id: `canvas-api-${item.plannable_type || "item"}-${item.plannable_id || item.plannable?.id || `${title}-${rawDate}`}`,
      title,
      why: "这是 Canvas Planner 中未来 14 天内尚未完成的事项。",
      nextAction: "打开 Canvas，确认要求并安排第一段完成时间",
      when: due.toISOString(), location: null, url: itemUrl,
      source: "Canvas API", confidence: "confirmed",
      score: Math.max(45, 99 - Math.floor((due.getTime() - now.getTime()) / 86_400_000) * 5),
    });
  }
  return items.sort((a, b) => new Date(a.when!).getTime() - new Date(b.when!).getTime()).slice(0, 20);
}

export function validateGoogleCalendarFeedUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("请输入完整的 Google Calendar iCal 链接"); }
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "calendar.google.com") {
    throw new Error("目前只接受来自 calendar.google.com 的私密 iCal 链接");
  }
  if (!url.pathname.includes("/calendar/ical/") || !url.pathname.endsWith("/basic.ics")) {
    throw new Error("请复制 Google Calendar 设置中的 Secret address in iCal format");
  }
  return url;
}

export async function fetchGoogleCalendarItems(value: string) {
  const url = validateGoogleCalendarFeedUrl(value);
  const response = await fetch(url, { signal: AbortSignal.timeout(9000), redirect: "follow" });
  if (!response.ok) throw new Error(`Google Calendar 无法读取（${response.status}）`);
  const text = await response.text();
  if (!text.includes("BEGIN:VCALENDAR")) throw new Error("该链接没有返回有效的 Google Calendar Feed");
  return parseCalendarIcs(text, "Google Calendar");
}

export type ManualCourse = {
  course: string;
  days: string;
  time: string;
};

export type ManualAcademicData = {
  courses: ManualCourse[];
  deadlines: RadarItem[];
};

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

function parseLooseDate(line: string) {
  const now = new Date();
  let year = now.getFullYear();
  let month: number | undefined;
  let day: number | undefined;
  let match = line.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (match) { year = Number(match[1]); month = Number(match[2]) - 1; day = Number(match[3]); }
  if (!match) {
    match = line.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](20\d{2}|\d{2}))?\b/);
    if (match) {
      month = Number(match[1]) - 1; day = Number(match[2]);
      if (match[3]) year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
    }
  }
  if (!match) {
    match = line.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:,?\s+(20\d{2}))?/i);
    if (match) { month = MONTHS[match[1].toLowerCase()]; day = Number(match[2]); if (match[3]) year = Number(match[3]); }
  }
  if (month === undefined || day === undefined) return null;
  const time = line.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i) || line.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  let hour = time ? Number(time[1]) : 23;
  const minute = time?.[2] ? Number(time[2]) : 59;
  const meridiem = time?.[3]?.toLowerCase();
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  let date = new Date(year, month, day, hour, minute);
  if (!match?.[3] && date.getTime() < now.getTime() - 7 * 86_400_000) date = new Date(year + 1, month, day, hour, minute);
  return Number.isNaN(date.getTime()) ? null : date;
}

function compactLine(line: string) {
  return line.replace(/\s+/g, " ").replace(/^[|,;\-–—\s]+|[|,;\-–—\s]+$/g, "").trim();
}

export function parseManualAcademicData(courseScheduleText = "", assignmentDeadlinesText = ""): ManualAcademicData {
  const courseLines = courseScheduleText.split(/\r?\n/).map(compactLine).filter(Boolean).slice(0, 80);
  const courses: ManualCourse[] = [];
  for (const line of courseLines) {
    const course = line.match(/\b([A-Z]{2,8})\s*[- ]?\s*(\d{3,4}[A-Z]?)\b/i);
    const days = line.match(/\b(MWF|MW|TR|TTH|TU(?:E)?TH|MON(?:DAY)?(?:\s*[/,&-]\s*WED(?:NESDAY)?)?(?:\s*[/,&-]\s*FRI(?:DAY)?)?|TUE(?:SDAY)?(?:\s*[/,&-]\s*THU(?:RSDAY)?)?)\b/i);
    const time = line.match(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*[-–—]\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/i);
    if (!course && !days && !time) continue;
    courses.push({ course: course ? `${course[1].toUpperCase()} ${course[2].toUpperCase()}` : line.slice(0, 40), days: days?.[0] ?? "", time: time?.[0] ?? "" });
  }

  const now = new Date();
  const horizon = new Date(now.getTime() + 180 * 86_400_000);
  const deadlineLines = assignmentDeadlinesText.split(/\r?\n/).map(compactLine).filter(Boolean).slice(0, 160);
  const deadlines: RadarItem[] = [];
  for (const [index, line] of deadlineLines.entries()) {
    const due = parseLooseDate(line);
    if (!due || due < now || due > horizon) continue;
    const courseMatch = line.match(/\b([A-Z]{2,8})\s*[- ]?\s*(\d{3,4}[A-Z]?)\b/i);
    const course = courseMatch ? `${courseMatch[1].toUpperCase()} ${courseMatch[2].toUpperCase()}` : "课程";
    const cleaned = compactLine(line
      .replace(/\b20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b/g, "")
      .replace(/\b\d{1,2}[\/-]\d{1,2}(?:[\/-](?:20)?\d{2})?\b/g, "")
      .replace(/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:,?\s+20\d{2})?/ig, "")
      .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/ig, "")
      .replace(/[|,;]+/g, " "));
    const title = cleaned || `${course} 截止事项`;
    const daysAway = Math.max(0, Math.floor((due.getTime() - now.getTime()) / 86_400_000));
    deadlines.push({
      id: `manual-deadline-${due.getTime()}-${index}`,
      title,
      why: `这是你粘贴的 ${course} 截止日期；Radar 会按临近程度提高优先级。`,
      nextAction: "确认要求，并安排第一段完成时间",
      when: due.toISOString(), location: null, url: null, source: "课程 DDL", confidence: "confirmed",
      score: Math.max(45, 99 - daysAway * 5),
    });
  }
  return {
    courses: courses.filter((item, index, all) => all.findIndex((candidate) => candidate.course === item.course && candidate.days === item.days && candidate.time === item.time) === index).slice(0, 30),
    deadlines: deadlines.sort((a, b) => new Date(a.when!).getTime() - new Date(b.when!).getTime()).slice(0, 80),
  };
}

export async function buildRadarPreview(
  profile: BetaProfileInput,
  canvasItems: RadarItem[] = [],
  googleCalendarItems: RadarItem[] = [],
  connected = { canvas: canvasItems.length > 0, googleCalendar: googleCalendarItems.length > 0 },
  academic: ManualAcademicData = { courses: [], deadlines: [] },
  forwardedItems: RadarItem[] = [],
  hiddenIds: string[] = [],
): Promise<RadarPreview> {
  const zh = profile.reportLanguage === "zh";
  const { readPublicSignals, refreshPublicSignals } = await import("./public-signals");
  const { matchPublicSignals } = await import("../opportunity-matching");
  await refreshPublicSignals();
  const aihot=await readAihot(profile.opportunityPreferences?.aiNewsEnabled===true);
  const signals = [...await readPublicSignals(),...aihot.items];
  const matchedSignals = matchPublicSignals(signals, profile).filter(item => !hiddenIds.includes(item.id));
  const localizePersonalItem = (item: RadarItem): RadarItem => {
    if (zh) return item;
    if (item.source.startsWith("Canvas")) return { ...item, why: "A confirmed Canvas item due within the next 14 days.", nextAction: "Open Canvas, confirm the requirements, and schedule the first work block" };
    if (item.source === "Google Calendar") return { ...item, why: "A confirmed event from your Google Calendar within the next 14 days.", nextAction: "Open the calendar event, confirm the details, and protect the required time" };
    if (item.source === "课程 DDL") return { ...item, source: "Course deadline", why: "A deadline you supplied; urgency increases as the due time approaches.", nextAction: "Confirm the requirements and schedule the first work block" };
    return item;
  };
  canvasItems = canvasItems.map(localizePersonalItem);
  googleCalendarItems = googleCalendarItems.map(localizePersonalItem);
  academic = { ...academic, deadlines: academic.deadlines.map(localizePersonalItem) };
  let opportunities: RadarItem[] = [];
  let campusError: string | undefined;
  let umichSourceMode: RadarPreview["umichSourceMode"] = profile.isUmichStudent ? "live" : "unavailable";
  if (profile.isUmichStudent) {
    try { opportunities = await fetchUmichOpportunities(profile); } catch(error) {
      campusError = error instanceof Error ? error.message.slice(0,240) : "Campus source unavailable";
      opportunities = verifiedFallbackOpportunities(profile);
      umichSourceMode = opportunities.length ? "verified_fallback" : "unavailable";
    }
  }
  const academicNow = Date.now();
  const upcomingAcademic = academic.deadlines.filter((item) => item.when && new Date(item.when).getTime() >= academicNow && new Date(item.when).getTime() <= academicNow + 14 * 86_400_000);
  const personalItems = [...canvasItems, ...upcomingAcademic, ...googleCalendarItems].sort((a, b) => b.score - a.score);
  opportunities = [...opportunities, ...forwardedItems].sort((a, b) => b.score - a.score);
  const researchMatches = profile.isUmichStudent ? researchLabMatches(profile).filter(item => !hiddenIds.includes(item.id)) : [];
  const catalog = profile.goals.includes("internship") ? await fetchEmployerJobs() : {checkedAt:new Date().toISOString(),jobs:[],sources:[]};
  const careerJobs = matchCareerJobs([...catalog.jobs,...CAREER_PILOT_JOBS], profile, new Date(), hiddenIds);
  const snapshots=matchUmichCareerSnapshots(UMICH_CAREER_PILOT_EVENTS,profile);
  const campusEvents = profile.isUmichStudent && profile.goals.includes("events")
    ? [...new Map([...opportunities.filter(item=>item.campusScope==="umich").slice(0,8),...snapshots.slice(0,2)].filter(item=>!hiddenIds.includes(item.id)).map(item=>[item.registrationUrl?.match(/\/(?:stu|edu)\/events\/(\d+)/)?.[1] || item.url || item.id,item])).values()].sort((a,b)=>b.score-a.score).slice(0,10) : [];
  const umichCareerEvents = profile.goals.includes("internship") ? selectUmichCareerEvents([...opportunities,...snapshots].filter(item => !hiddenIds.includes(item.id)), profile.isUmichStudent) : [];
  const topResearchAction: RadarItem[] = researchMatches.slice(0, 1).map((lab) => ({
    id: `research-${lab.id}`, title: lab.name, why: zh ? `${lab.why}。${lab.statusLabel}。` : `${lab.why}. ${lab.statusLabel}.`, nextAction: lab.nextAction,
    when: null, location: "University of Michigan", url: lab.url, source: "UMich Research Radar",
    confidence: lab.status === "contact_to_confirm" ? "needs_verification" : "confirmed", score: lab.score,
  }));
  const nextActionByBottleneck: Record<BetaProfileInput["bottleneck"], string> = {
    direction: "打开官方页，用“我愿不愿意连续做一年”判断它是否值得参加",
    finding: "确认资格并收藏；若匹配，今天完成报名",
    resume: "带上目标岗位描述，改写简历顶部两条 bullet",
    networking: "确认参加，并提前准备两个只针对该组织的问题",
    applications: "确认资格、截止时间和材料，立即建立申请条目",
    interviews: "从活动主题准备一个 STAR 故事和一个反问",
    time: "确认时间投入；只有高匹配才加入日历",
  };
  const nextActionByBottleneckEn: typeof nextActionByBottleneck = {
    direction: "Open the official page and ask whether you would commit to this direction for a full year",
    finding: "Confirm eligibility, save it, and complete registration today if it fits",
    resume: "Bring one target role and revise the top two bullets on your resume",
    networking: "Confirm attendance and prepare two questions specific to the organization",
    applications: "Confirm eligibility, deadline, and materials, then create the application task now",
    interviews: "Prepare one relevant STAR story and one thoughtful question",
    time: "Estimate the time cost and add it only if the match is strong",
  };
  const actions = [
    ...personalItems.slice(0, 2),
    ...topResearchAction,
    ...opportunities.map((item) => ({ ...item, nextAction: (zh ? nextActionByBottleneck : nextActionByBottleneckEn)[profile.bottleneck] })),
  ].sort((a, b) => b.score - a.score).slice(0, 3);

  const urgent = personalItems.find((item) => item.when && new Date(item.when).getTime() - Date.now() < 48 * 60 * 60 * 1000);
  const risk = urgent ? {
    ...urgent,
    id: `risk-${urgent.id}`,
    title: zh ? `距离「${urgent.title}」截止不足 48 小时` : `Less than 48 hours until “${urgent.title}”`,
    why: zh ? "这是当前最紧迫且有真实截止时间的事项。" : "This is your most urgent item with a confirmed time.",
    nextAction: zh ? "今天先完成最小可提交版本，再继续优化" : "Finish the smallest viable submission today, then improve it",
    score: 99,
  } : null;

  const primaryRole = profile.roleTracks[0] ? ROLE_LABELS[profile.roleTracks[0]] : profile.customGoal || "目标方向";
  const insightTitles: Record<BetaProfileInput["bottleneck"], string> = {
    direction: `你现在不缺更多选择，缺的是验证「${primaryRole}」`,
    finding: `${primaryRole} 机会并不少，真正稀缺的是及时筛选`,
    resume: `机会已经出现，本周杠杆点是让材料先达到可投状态`,
    networking: `对你而言，一次有准备的对话比再收藏十个链接更值钱`,
    applications: `你的瓶颈不是信息，而是把高匹配机会稳定推进`,
    interviews: `下一步应该从“找机会”切换到“为具体对话准备证据”`,
    time: `当前最大的风险不是错过机会，而是同时答应太多事情`,
  };
  const insightTitlesEn: typeof insightTitles = {
    direction: `You do not need more options—you need evidence about ${primaryRole}`,
    finding: `${primaryRole} opportunities exist; timely filtering is the scarce skill`,
    resume: "The opportunity is visible; this week's leverage is making your materials ready",
    networking: "One prepared conversation is worth more than ten saved links",
    applications: "Your constraint is consistent execution, not more information",
    interviews: "Shift from finding opportunities to preparing evidence for specific conversations",
    time: "The largest risk is overcommitting, not missing one more opportunity",
  };
  const stage = (zh ? STAGE_LABELS : STAGE_LABELS_EN)[profile.careerStage];
  const bottleneck = (zh ? BOTTLENECK_LABELS : BOTTLENECK_LABELS_EN)[profile.bottleneck];
  const calendarContext = personalItems.length
    ? `已结合 ${personalItems.length} 条个人日历信号安排优先级。`
    : academic.courses.length ? `已读取 ${academic.courses.length} 门课的手动课表。` : "尚未添加课表或个人日历，时间冲突判断仍有盲区。";
  const fieldInsight = (zh ? FIELD_INSIGHTS : FIELD_INSIGHTS_EN)[profile.roleTracks[0]] ?? {
    title: zh ? `把 ${profile.major} 变成一份可验证的专业证据` : `Turn ${profile.major} into verifiable evidence of ability`,
    signal: zh ? "课程名称本身不能完整说明能力，真实问题、判断过程和结果更能形成区分度。" : "Course titles alone do not prove ability; real problems, judgment, and outcomes do.",
    implication: zh ? "下一步应把一个兴趣方向收窄成可以在一周内验证的具体问题。" : "Narrow one interest into a question you can test within a week.",
    experiment: zh ? "选择一个真实用户或研究问题，写下假设、证据来源和本周最小实验。" : "Choose one real user or research problem and define the hypothesis, evidence, and smallest test.",
    sources: [{ label: "University Career Center", url: "https://careercenter.umich.edu/" }],
  };

  return verifyRadarPreview({
    formatVersion: 2,
    aihotOptIn:profile.opportunityPreferences?.aiNewsEnabled===true,
    aihotStatus:aihot.health,
    careerJobs,
    campusEvents,
    discoveryStatus:{campus:{status:profile.isUmichStudent ? umichSourceMode === "unavailable" ? "unavailable" : "live" : "not_enabled",checkedAt:new Date().toISOString(),matched:campusEvents.length,error:campusError},careers:{checkedAt:catalog.checkedAt,candidates:catalog.jobs.length,matched:careerJobs.length,sources:catalog.sources,paidOnly:profile.paidOnly}},
    umichCareerEvents,
    scholarships: matchedSignals.filter(item => item.category === "scholarship").slice(0, 5),
    businessNews: matchedSignals.filter(item => item.category === "business_news").slice(0, 10),
    aiNews: matchedSignals.filter(item => item.category === "ai_news").slice(0, 3),
    externalEvents: matchedSignals.filter(item => item.category === "event").slice(0, 3),
    language: profile.reportLanguage,
    generatedAt: new Date().toISOString(),
    insight: {
      title: (zh ? insightTitles : insightTitlesEn)[profile.bottleneck],
      detail: zh ? `你处在「${stage}」阶段，并把「${bottleneck}」列为当前最大卡点。Radar 因此不会平均推荐所有活动，而会优先保留能推动 ${primaryRole} 的下一步。${calendarContext}` : `You are currently in the “${stage}” stage, with “${bottleneck}” as your main constraint. Radar therefore prioritizes the next moves that advance ${primaryRole}, instead of treating every event equally.`,
      evidence: zh ? [
        `岗位方向：${profile.roleTracks.length ? profile.roleTracks.map((role) => ROLE_LABELS[role] ?? role).join(" · ") : "尚未细分"}`, `当前阶段：${stage}`, `本周卡点：${bottleneck}`,
        ...(profile.sponsorship === "needed" ? ["需要 sponsorship：优先保留国际学生相关信号"] : []),
      ] : [
        `Direction: ${profile.roleTracks.length ? profile.roleTracks.map((role) => ROLE_LABELS[role] ?? role).join(" · ") : "Not yet narrowed"}`, `Stage: ${stage}`, `Main constraint: ${bottleneck}`,
        ...(profile.sponsorship === "needed" ? ["Sponsorship needed: prioritize international-student signals"] : []),
      ],
    },
    fieldInsight,
    actions,
    forwardedEmails: forwardedItems,
    opportunities,
    risk,
    canvas: { connected: connected.canvas, eventCount: canvasItems.length, upcoming: canvasItems.slice(0, 3) },
    googleCalendar: { connected: connected.googleCalendar, eventCount: googleCalendarItems.length, upcoming: googleCalendarItems.slice(0, 3) },
    academic: { connected: academic.courses.length > 0 || academic.deadlines.length > 0, courseCount: academic.courses.length, deadlineCount: academic.deadlines.length, upcoming: upcomingAcademic.slice(0, 3) },
    researchLabs: {
      enabled: researchMatches.length > 0,
      matches: researchMatches,
      sourceNote: zh ? "仅收录 U-M 官方院系或实验室页面明确提供本科生入口的项目；名额与截止日期须以官方页面为准。" : "Only includes opportunities with an undergraduate pathway on an official U-M department or lab page. Confirm availability and deadlines on the source page.",
    },
    umichSourceMode,
    attribution: profile.isUmichStudent
      ? (zh
        ? (umichSourceMode === "verified_fallback" ? "U-M 实时来源暂不可用。当前显示已核验的短期备用活动；行动前请再次查看官方页面。" : "校园机会来自 Happening @ Michigan、Student Life 与 University of Michigan。推荐独立生成，不代表学校背书。")
        : (umichSourceMode === "verified_fallback" ? "The U-M live feed is temporarily unavailable. Showing verified short-term fallback events; re-check official links before acting." : "Campus opportunities are sourced from Happening @ Michigan, Student Life, and the University of Michigan. Recommendations are independent and are not university endorsements."))
      : (zh ? "当前版本使用你的课程、日历、目标与通用职业资源生成建议；尚未接入你所在学校的校内活动源。" : "This version uses your courses, calendar, goals, and public career resources. Your institution's campus event feed is not connected yet."),
  });
}
