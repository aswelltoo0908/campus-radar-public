import Link from "next/link";
export const metadata = { alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <Link className="legal-back" href="/">
        ← Back to Campus Radar
      </Link>
      <p className="eyebrow">BETA DATA POLICY · 2026-10-14</p>
      <h1>Privacy and data</h1>
      <p className="legal-lead">
        Campus Radar is an independent student project, not an official
        University of Michigan product. The Beta minimizes data collection and
        stores only what is needed to build your personalized Radar.
      </p>

      <section>
        <h2>What we save</h2>
        <p>
          Your login and report-delivery email addresses and name; the school,
          major, year, goals, role directions, career stage, bottleneck, and
          eligibility preferences you provide; structured courses, meeting
          times, and deadlines parsed from pasted content; encrypted calendar
          connection information; generated Radar reports; and feedback you
          submit.
        </p>
      </section>
      <section>
        <h2>How we use it</h2>
        <p>
          We use this data to filter opportunities, read course-calendar
          deadlines, generate personalized actions, and send your Radar to the
          delivery address you choose when email delivery is enabled. We do not
          sell personal data, apply on your behalf, contact recruiters, or edit
          calendars.
        </p>
      </section>
      <section>
        <h2>Pilot administration</h2>
        <p>
          We record your first and most recent signed-in Beta visits and your
          current and furthest setup step to understand onboarding problems. We
          do not collect unsaved form contents. Only the authorized pilot
          administrator can view user progress, report counts, subscription
          addresses, and delivery status. The admin dashboard does not expose
          private calendar links, tokens, report contents, or forwarded email
          contents. Deleting your Beta data also deletes these visit and
          delivery records.
        </p>
      </section>
      <section>
        <h2>Courses and calendars</h2>
        <p>
          Raw schedule or syllabus text is used for parsing and is not saved in
          full. The system stores structured courses, times, and deadlines.
          Calendar connections are optional; private iCal addresses and Canvas
          tokens are encrypted and never displayed again. Radar does not write
          to or edit calendars.
        </p>
      </section>
      <section>
        <h2>Schedule screenshot recognition</h2>
        <p>
          Schedule and deadline screenshots are processed with OCR in your
          browser and are not uploaded to Campus Radar. You review and edit the
          extracted text first; only the parsed courses and dates enter your
          account data when you save.
        </p>
      </section>
      <section>
        <h2>Ask Radar</h2>
        <p>
          Beta questions read only your own profile, latest Radar, course
          deadlines, and calendar signals. The current system uses deterministic
          retrieval and ranking, does not send course content to an external
          language model, and never references another user’s data.
        </p>
      </section>
      <section>
        <h2>Email and job platforms</h2>
        <p>
          Radar does not request passwords for Gmail, Handshake, Interstride,
          LinkedIn, or other job sites. Forwarding is optional and off by
          default. When you enable it, Radar processes messages delivered to
          your private Radar address from your manual forwards or Gmail filters.
          It saves an encrypted copy of the subject, sender, and up to 24,000
          characters of message text, and uses recent messages in your reports.
          We do not connect to the rest of your Gmail mailbox. The pilot
          owner&apos;s dedicated Radar Gmail account runs the receiving and
          sending script. You can disable processing in settings; remove your
          Gmail filter separately to stop delivery to the pilot inbox.
        </p>
      </section>
      <section>
        <h2>Third-party sources</h2>
        <p>
          Public opportunities come from U-M Happening @ Michigan.
          Recommendations are guidance only; confirm times, eligibility, and
          registration requirements on the linked official page. Campus Radar
          does not represent or imply endorsement by U-M.
        </p>
      </section>
      <section>
        <h2>Your control</h2>
        <p>
          Use the unsubscribe button in a Radar email or on your Beta page to
          stop daily emails without deleting your account. Email links are
          signed and require a confirmation button; opening the link alone does
          not unsubscribe. The pilot administrator can also stop daily emails
          for an individual user. You can delete your profile, courses and
          deadlines, calendar connections, Radar history, and feedback from the
          Beta page at any time. Deletion cannot be undone. Accounts that do not
          continue after the pilot will also be cleaned up.
        </p>
      </section>
      <section>
        <h2>Current Beta scope</h2>
        <p>
          The opportunity Beta focuses on U-M research pathways, funding and
          accessible career signals, with optional public news and other
          universities&apos; events. You may provide visa/residency category,
          citizenship region, STEM and transfer preferences to filter funding;
          unknown answers are allowed. These preferences are stored with your
          private profile and are not sent to public news sources. Morning email
          subscriptions and unsubscribe are available; delivery and source
          health are monitored separately. This is not a complete scholarship or
          job database.
        </p>
      </section>
      <p className="legal-note">
        If you find a problem, contact the project creator who invited you to
        the pilot. This policy will be updated as Beta capabilities change, with
        the date shown above.
      </p>
    </main>
  );
}
