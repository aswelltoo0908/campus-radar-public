export type RadarAction = {
  title: string;
  why: string;
  when: string;
  label: string;
  priority: "high" | "medium";
  url: string;
};

export type RadarOpportunity = {
  title: string;
  time: string;
  location: string;
  why: string;
  category: string;
  match: number;
  url: string;
};

export const sampleRadar: {
  actions: RadarAction[];
  risk: { title: string; detail: string; recommendation: string };
  opportunities: RadarOpportunity[];
} = {
  actions: [
    {
      title: "Shortlist five employers for Engineering Career Day",
      why: "Tomorrow's fair targets CSE, ECE, and related majors. Research employers in Career Forge or Career Fair Plus tonight so your conversations are specific.",
      when: "Finish by 8:00 PM today",
      label: "HIGH VALUE",
      priority: "high",
      url: "https://events.umich.edu/event/149792",
    },
    {
      title: "Choose between Career Day, Internship Lab, and the CFE Open House",
      why: "The three events overlap tomorrow afternoon. Career Day has the clearest recruiting value; choose Internship Lab for search strategy or CFE for entrepreneurship.",
      when: "Overlap tomorrow, 1:00–4:00 PM",
      label: "DECISION",
      priority: "high",
      url: "https://events.umich.edu/event/150037",
    },
    {
      title: "Confirm the Beginner AI Workshop and bring one real problem",
      why: "The workshop compares U-M GPT and Gemini. Bring one real course or project task so you leave with a useful workflow.",
      when: "Tomorrow, 9:30–11:30 AM",
      label: "ACTIONABLE",
      priority: "medium",
      url: "https://events.umich.edu/event/151855",
    },
  ],
  risk: {
    title: "Three strong events create two afternoon conflicts",
    detail: "Career Day runs 11:00–3:00, Internship Lab 1:00–2:00, and the CFE Open House 2:00–4:00. Attending all three is not realistic.",
    recommendation: "Stay at Career Day for recruiting, RSVP to Internship Lab for search help, or move to CFE after 2:00 if entrepreneurship is the priority.",
  },
  opportunities: [
    {
      title: "Engineering Department Career Day",
      time: "Tue, Sep 29 · 11:00 AM–3:00 PM",
      location: "Duderstadt Center",
      why: "Employers are recruiting CSE, ECE, and related students for full-time, internship, and co-op roles.",
      category: "CAREER",
      match: 96,
      url: "https://events.umich.edu/event/149792",
    },
    {
      title: "Beginner AI Workshop featuring U-M GPT and Gemini",
      time: "Tue, Sep 29 · 9:30–11:30 AM",
      location: "LSA 1168",
      why: "Hands-on prompting and use cases make this a practical comparison of two generative AI tools available to U-M students.",
      category: "AI WORKSHOP",
      match: 93,
      url: "https://events.umich.edu/event/151855",
    },
    {
      title: "CFE Open House Carnival",
      time: "Tue, Sep 29 · 2:00–4:00 PM",
      location: "Duderstadt Center · CFE Office",
      why: "A direct way to meet the entrepreneurship community and learn about upcoming CFE programs and resources.",
      category: "STARTUP",
      match: 84,
      url: "https://events.umich.edu/event/151294",
    },
  ],
};
