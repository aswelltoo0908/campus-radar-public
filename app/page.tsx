import OpportunityDemo from "./OpportunityDemo";
export const metadata = { alternates: { canonical: "/" } };
const samples = [
  {
    type: "RESEARCH",
    title: "Find a path into undergraduate research",
    detail:
      "Start with UROP and official department pathways. Check eligibility and whether a specific project is accepting students.",
    url: "https://lsa.umich.edu/urop/prospective-students/fall-winter-programs.html",
    note: "Official pathway · confirm current cycle",
  },
  {
    type: "SCHOLARSHIPS",
    title: "S&S Scholarship Fund · next cycle",
    detail:
      "For eligible U-M international students from Africa or Asia. STEM and undergraduate status are preferences. Awards generally range from $5,000–$12,000.",
    url: "https://internationalcenter.umich.edu/resources/student-funding/ss-fund",
    note: "Next cycle: Nov 9–Dec 7, 2026 · reviewed Oct 14",
  },
  {
    type: "CAREERS",
    title: "Explore your university's career resources",
    detail:
      "Try a small reviewed Interstride internship shortlist and U-M career events, alongside information you choose to forward. Not a live or complete jobs database; confirm requirements at the original source.",
    url: "https://careercenter.umich.edu/community-toolkits",
    note: "Early career pilot · no personal account sync",
  },
];
export default function Home() {
  return (
    <main className="radar-home" id="main-content">
      <a className="skip-link" href="#sample">Skip to sample opportunities</a>
      <header className="site-header">
        <a className="brand" href="/">
          <span className="brand-mark">R</span>
          <span>Campus Radar</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#sample">Sample brief</a>
          <a href="#how">How it works</a>
          <a href="#faq">FAQ</a>
          <a className="nav-cta" href="/beta">
            Find my opportunities ↗
          </a>
        </nav>
      </header>
      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="live-dot" /> BUILT FOR U-M STUDENTS
          </p>
          <h1>
            Find the opportunities
            <br />
            <em>that fit your next step.</em>
          </h1>
          <p className="hero-text">
            Research, scholarships, and internships across scattered campus
            resources. See why an opportunity fits, what to check, and where to
            start.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="/beta">
              Find my opportunities ↗
            </a>
            <a className="button secondary" href="#sample">
              See a sample brief
            </a>
          </div>
          <p className="login-hint">
            Sign in with ChatGPT · No API key · No calendar connection required
          </p>
          <p className="trust-line">
            Independent student project · Not an official University of Michigan
            product
          </p>
        </div>
        <OpportunityDemo />
      </section>
      <section id="sample" className="sample-section">
        <div className="section-heading">
          <p className="eyebrow">REAL SOURCES · CLEAR BOUNDARIES</p>
          <h2>What your brief can help you explore</h2>
          <p>
            These are source-backed examples, not a personalized recommendation
            or a guarantee that you qualify.
          </p>
        </div>
        <div className="pivot-grid">
          {samples.map((item, index) => (
            <article key={item.type} className="opportunity-card">
              <span className="sample-index" aria-hidden="true">0{index + 1}</span>
              <p className="eyebrow">{item.type}</p>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
              <a href={item.url} target="_blank" rel="noreferrer">
                View official source ↗
              </a>
              <p className="field-note">{item.note}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="how-section" id="how">
        <div className="how-intro">
          <p className="eyebrow">FROM DISCOVERY TO ACTION</p>
          <h2>A little context. A useful next step.</h2>
          <p>
            Start with your major and goals; refine the results as you use them.
          </p>
        </div>
        <div className="steps">
          {[
            [
              "01",
              "Tell us your goals",
              "Choose what you are looking for, your interests and relevant eligibility preferences.",
            ],
            [
              "02",
              "Explore your matches",
              "Read a short list with reasons, source links and conditions that need checking.",
            ],
            [
              "03",
              "Take the next step",
              "Visit the official page, prepare materials, and tell Radar which recommendations helped.",
            ],
          ].map(([number, title, detail]) => (
            <article key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{detail}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="faq-section" id="faq">
        <div className="faq-heading">
          <p className="eyebrow">BEFORE YOU JOIN</p>
          <h2>Questions you may have</h2>
          <p>Know the current coverage before you start.</p>
        </div>
        <div className="faq-list">
          {[
            [
              "Is this an official U-M service?",
              "No. Campus Radar is an independent student-built project. Eligibility, availability and application decisions remain with the original organizations.",
            ],
            [
              "Which students is it for?",
              "The Beta focuses on U-M students looking for research, funding or internship opportunities, including mathematics, social science, political science and business. Source coverage varies; other universities' campus resources are not fully supported.",
            ],
            [
              "Do I need an API key or to connect Canvas?",
              "No. Use the hosted website with ChatGPT sign-in. Calendar and forwarded-email tools are optional settings.",
            ],
            [
              "Does a recommendation mean I qualify?",
              "No. Radar checks the conditions you provide and shows unknown requirements. A research directory does not establish an open position.",
            ],
            [
              "Can I receive the brief by email?",
              "You can opt into morning emails after viewing your brief, choose English or Chinese, and unsubscribe. Source collection and delivery status are monitored separately.",
            ],
            [
              "Is the Beta free?",
              "The early pilot is free and requires no card. New profiles are limited to the first 10 pilot places; existing users keep access. Future pricing will be explained before it applies.",
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>
                {q}
                <span>+</span>
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="pilot" id="pilot">
        <p className="eyebrow">SMALL BETA · REAL FEEDBACK</p>
        <h2>Did you find an opportunity you would have missed?</h2>
        <p>
          Help us test that question. Explore the brief, check its sources, and
          tell us what is relevant, inaccurate, or missing.
        </p>
        <a className="button light" href="/beta">
          Build my first brief ↗
        </a>
      </section>
      <footer>
        <div>
          <strong>Campus Radar</strong>
          <p>Discover. Check. Act.</p>
        </div>
        <nav>
          <a href="/privacy">Privacy</a>
          <a href="/docs">Product & access guide</a>
        </nav>
      </footer>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Campus Radar",
            url: "https://campus-radar-umich.aswelltoo.chatgpt.site",
            applicationCategory: "EducationalApplication",
            operatingSystem: "Web",
            description:
              "Student-built U-M research, scholarship and internship opportunity discovery with source links and eligibility checks.",
          }),
        }}
      />
    </main>
  );
}
