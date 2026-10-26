"use client";
import { useState } from "react";

const examples = [
  { label: "Funding", source: "U-M International Center", title: "S&S Scholarship Fund", fact: "$5,000–$12,000", detail: "For eligible U-M international students from Africa or Asia. STEM and undergraduate status are preferences, not requirements.", next: "Check the eligibility criteria before the next application cycle.", note: "Nov 9–Dec 7, 2026 · reviewed Oct 14", url: "https://internationalcenter.umich.edu/resources/student-funding/ss-fund" },
  { label: "Research", source: "U-M Undergraduate Research Opportunity Program", title: "A starting point for undergraduate research", fact: "Official research pathway", detail: "Explore UROP and its program options. A program directory is a starting point, not confirmation of an available lab position.", next: "Check which program and application cycle fit your academic stage.", note: "Confirm current eligibility and availability", url: "https://lsa.umich.edu/urop/prospective-students/fall-winter-programs.html" },
  { label: "Careers", source: "U-M University Career Center", title: "Start with your university’s career resources", fact: "Handshake + Interstride", detail: "Find the career services and opportunity platforms available to you. Radar does not connect to a complete personal job database.", next: "Open the official toolkit and check the opportunities available with your access.", note: "Resource entry · not an account connection", url: "https://careercenter.umich.edu/community-toolkits" },
];

export default function OpportunityDemo() {
  const [active, setActive] = useState(0);
  const item = examples[active];
  return <aside className="demo-brief" aria-label="Sample opportunity brief">
    <div className="demo-masthead"><span className="mini-mark" aria-hidden="true">R</span><div><strong>Your next chapter.</strong><span>THE CAMPUS RADAR BRIEF</span></div><span className="demo-tag">SAMPLE</span></div>
    <div className="demo-tabs" role="group" aria-label="Explore a sample category">{examples.map((example, index) => <button key={example.label} type="button" aria-pressed={active === index} onClick={() => setActive(index)}>{example.label}</button>)}</div>
    <div className="demo-body" key={item.label} aria-live="polite" aria-atomic="true">
      <p className="demo-source">{item.source}</p><h2>{item.title}</h2><p className="demo-fact">{item.fact}</p><p>{item.detail}</p>
      <div className="demo-next"><span>YOUR NEXT STEP</span><p>{item.next}</p></div>
      <a href={item.url} target="_blank" rel="noreferrer">Read the original source <span aria-hidden="true">↗</span></a><small>{item.note}</small>
    </div>
    <p className="demo-disclaimer">Source-backed example. Not a personal match or a guarantee of eligibility.</p>
  </aside>;
}
