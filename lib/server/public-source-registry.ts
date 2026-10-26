import type { BusinessChannel, PublicSignal } from "../types";
export const PUBLIC_NEWS_SOURCES: {
  id: string;
  name: string;
  url: string;
  channel: BusinessChannel | null;
  category?: "business_news" | "ai_news";
  format: "rss";
}[] = [
  {
    id: "openai-news",
    name: "OpenAI News",
    url: "https://openai.com/news/rss.xml",
    channel: null,
    category: "ai_news",
    format: "rss",
  },
  {
    id: "fed",
    name: "Federal Reserve",
    url: "https://www.federalreserve.gov/feeds/press_all.xml",
    channel: "finance",
    format: "rss",
  },
  {
    id: "sec",
    name: "SEC",
    url: "https://www.sec.gov/news/pressreleases.rss",
    channel: "accounting",
    format: "rss",
  },
  {
    id: "yc",
    name: "Y Combinator",
    url: "https://www.ycombinator.com/blog/rss",
    channel: "entrepreneurship",
    format: "rss",
  },
  {
    id: "google-search",
    name: "Google Search Central",
    url: "https://feeds.feedburner.com/blogspot/amDG",
    channel: "marketing",
    format: "rss",
  },
  {
    id: "bea",
    name: "Bureau of Economic Analysis",
    url: "https://apps.bea.gov/rss/rss.xml",
    channel: "management",
    format: "rss",
  },
  {
    id: "mit-business",
    name: "MIT News: Business",
    url: "https://news.mit.edu/rss/topic/business",
    channel: "business_analytics",
    format: "rss",
  },
];
export const SCHOLARSHIP_SEEDS: Omit<
  PublicSignal,
  "contentHash" | "fetchedAt"
>[] = [
  {
    id: "ss-fund-2026-cycle2",
    category: "scholarship",
    channel: null,
    title: "S&S Scholarship Fund · Cycle 2",
    summary:
      "Funding for U-M international students from Africa or Asia. STEM and undergraduate status are preferences, not mandatory requirements.",
    url: "https://internationalcenter.umich.edu/resources/student-funding/ss-fund",
    sourceId: "ss-fund",
    sourceName: "U-M International Center",
    publishedAt: null,
    verifiedAt: "2026-10-14",
    deadline: "2026-12-07",
    opensAt: "2026-11-09",
    amount: "$5,000–$12,000",
    availability: "upcoming",
    topics: ["stem", "funding"],
    eligibility: {
      umichOnly: true,
      visas: ["f1", "j1"],
      citizenshipRegions: ["asia", "africa"],
      stemPreferred: true,
      otherRequirements: [
        "Full-time degree-seeking enrollment and good immigration standing; closing time not specified",
      ],
    },
  },
  {
    id: "ae-fund-winter2027",
    category: "scholarship",
    channel: null,
    title: "AE Scholarship Fund · Winter 2027",
    summary:
      "Funding for U-M undergraduate international students. Selection depends on the stated preferences and committee review.",
    url: "https://internationalcenter.umich.edu/resources/student-funding/ae-scholarship-fund",
    sourceId: "ae-fund",
    sourceName: "U-M International Center",
    publishedAt: null,
    verifiedAt: "2026-10-14",
    deadline: "2027-02-08",
    opensAt: "2027-01-11",
    amount: "$3,000–$5,000",
    availability: "upcoming",
    topics: ["funding"],
    eligibility: {
      umichOnly: true,
      academicLevel: "undergraduate",
      visas: ["f1", "j1"],
      otherRequirements: [
        "Full-time enrollment, good immigration standing and other selection preferences; closing time not specified",
      ],
    },
  },
  {
    id: "lsa-transfer-winter2027",
    category: "scholarship",
    channel: null,
    title: "LSA Transfer Student Scholarship · Winter 2027",
    summary:
      "For incoming LSA transfers with need-based support. This transfer program requires U.S. citizenship or permanent residency.",
    url: "https://lsa.umich.edu/scholarships/transfer-students/transfer-student-scholarship.html",
    sourceId: "lsa-transfer",
    sourceName: "U-M LSA Scholarships",
    publishedAt: null,
    verifiedAt: "2026-10-14",
    deadline: "2026-11-16T23:59:00-05:00",
    opensAt: "2026-10-12",
    amount: null,
    availability: "open",
    topics: ["transfer", "funding"],
    eligibility: {
      umichOnly: true,
      academicLevel: "undergraduate",
      school: "LSA",
      visas: ["us_citizen_or_pr"],
      transferOnly: true,
      otherRequirements: [
        "Incoming Winter 2027 transfer; full-time enrollment, need-based aid, FAFSA and CSS profile",
      ],
    },
  },
];
