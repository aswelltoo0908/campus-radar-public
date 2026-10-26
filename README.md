# Campus Radar

Campus Radar is a student-built opportunity discovery project. It organizes scattered public information—research, scholarships, internships, campus events, and selected field news—into a personalized, source-linked shortlist. It is independent and not affiliated with or endorsed by the University of Michigan.

This repository is a clean source snapshot. It intentionally excludes private development history, deployment credentials, student records, and internal planning documents. The hosted Beta may use services and secrets not included here, so this is not a one-click hosted clone.

## Run locally

Requires Node.js 22.13 or later.

```bash
npm install
npm run dev
```

Data-backed features expect a Cloudflare D1-compatible `DB` binding. Configure your own database and secrets; never reuse credentials from another deployment. The optional Gmail automation script also contains deployment/inbox placeholders that must be configured for your own instance. Run tests with `node --test tests/*.test.mjs`.

## Privacy and scope

Recommendations link to original sources and may require users to verify eligibility, availability, and deadlines. Coverage is limited and is not a complete or continuously synchronized database. The app does not apply, register, or change a user's calendar on their behalf.

## License and commercial use

This project is source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE). It is **not an OSI-approved open-source project** because the license restricts some commercial uses. Commercial business use requires a separate written license from the rights holders; contact the maintainer through the public GitHub profile associated with this repository.

Read the license for the full permitted-purpose definitions. In particular, it expressly treats use by educational institutions and certain other listed organizations as permitted regardless of funding source or related obligations. This README is a summary, not legal advice.
