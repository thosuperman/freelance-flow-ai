import type { Metadata } from "next";
import Link from "next/link";
import { ContactLine, LegalPage, Section } from "@/components/legal/legal";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={
        <>
          <strong>In short:</strong> we collect only what the app needs to work. There are no ads, no analytics and no tracking cookies. Text you give the
          AI features is sent to Anthropic (Claude) to process it. PayPal handles payment details; we never see card or bank data. Demo workspaces are
          deleted after 24 hours. This policy describes how the app actually works, and it follows Japan&apos;s Act on the Protection of Personal
          Information (APPI).
        </>
      }
    >
      <Section id="who" title="1. Who is responsible">
        <p>
          FreelanceFlow AI (freelanceflow.hayaix.tech) is a personal hackathon project operated by its developer (&quot;we&quot;), who is responsible for
          the handling of personal information described here. Contact details are in section 12.
        </p>
      </Section>

      <Section id="collected" title="2. Information we collect">
        <ul>
          <li>
            <strong>Account information:</strong> your name and email address, and your password stored only as a salted hash. Demo workspaces use a
            randomly generated placeholder email instead.
          </li>
          <li>
            <strong>Business profile:</strong> business name, default currency and hourly rate.
          </li>
          <li>
            <strong>Project content you enter:</strong> client conversations you paste, project terms, deliverables, milestones, proposals, change
            requests and notes. These can include information about your clients, such as names, company names and email addresses, which you
            provide.
          </li>
          <li>
            <strong>Client approvals:</strong> the name a client types when approving, the time, the approved version&apos;s fingerprint, the amount,
            and the browser identifier (user agent).
          </li>
          <li>
            <strong>Payment records:</strong> PayPal order and capture identifiers, amounts, statuses, the PayPal payer ID, and the event data PayPal
            sends to confirm payments (webhooks). We do <strong>not</strong> receive or store card numbers, bank details or PayPal passwords.
          </li>
          <li>
            <strong>Session and security data:</strong> a session record containing your IP address and browser identifier, and short-lived
            counters keyed by IP address or account to limit abuse (for example, how many demo workspaces a network can create per hour).
          </li>
          <li>
            <strong>AI records:</strong> the input and output of each AI request (for example, the client message and the extracted project) for
            traceability and troubleshooting.
          </li>
          <li>
            <strong>Activity log:</strong> an audit trail of key actions in a project, such as sending a proposal, approvals and payments.
          </li>
        </ul>
      </Section>

      <Section id="purposes" title="3. Purposes of use">
        <ul>
          <li>to provide the Service: accounts, projects, proposals, client portals, payment requests and financial views;</li>
          <li>to process payments through PayPal and verify them;</li>
          <li>to provide AI features (project extraction, proposal drafting, scope checks, schedule explanations, financial answers and analytics);</li>
          <li>to secure the Service, prevent abuse and investigate errors;</li>
          <li>to demonstrate and evaluate the project for the PayPal AI Hackathon 2026.</li>
        </ul>
        <p>We do not sell personal information, use it for advertising, or use it to train AI models.</p>
      </Section>

      <Section id="cookies" title="4. Cookies and local storage">
        <ul>
          <li>
            <strong>Session cookie:</strong> an essential, secure, HTTP-only cookie that keeps you signed in. It is not used for tracking.
          </li>
          <li>
            <strong>Local storage:</strong> if you click &quot;Save layout&quot; in Financial Intelligence, your dashboard layout is saved in your own
            browser only.
          </li>
          <li>
            <strong>PayPal:</strong> when you open the payment page, PayPal&apos;s checkout script and window may set their own cookies under
            PayPal&apos;s privacy policy.
          </li>
        </ul>
      </Section>

      <Section id="analytics" title="5. Analytics">
        <p>We do not use analytics, advertising or tracking tools.</p>
      </Section>

      <Section id="logs" title="6. Server logs and IP addresses">
        <p>
          Our web server does not keep access logs. The application logs errors without request contents, and logs are size-limited and rotated
          automatically. IP addresses are stored only in session records and in temporary rate-limit counters, as described above. Our hosting provider
          may process network-level data to operate its infrastructure.
        </p>
      </Section>

      <Section id="third-parties" title="7. Third-party service providers">
        <ul>
          <li>
            <strong>Amazon Web Services</strong> (Amazon Lightsail, United States, us-east-1): hosting of the application and its database.
          </li>
          <li>
            <strong>Anthropic</strong> (Claude API, United States): processes text sent to AI features, such as pasted client conversations, project
            terms, scope-check requests and financial figures, to generate responses.
          </li>
          <li>
            <strong>PayPal</strong> (Sandbox): processes payments. When you pay, you interact with PayPal directly under PayPal&apos;s own terms and
            privacy policy.
          </li>
          <li>
            <strong>Amazon Route 53 and Let&apos;s Encrypt:</strong> domain name resolution and the HTTPS certificate. No user content is shared with
            them.
          </li>
          <li>
            <strong>Bryntum Gantt and AG Studio:</strong> these components run inside your browser. We do not send your data to these vendors.
          </li>
        </ul>
      </Section>

      <Section id="ai" title="8. AI-related processing">
        <p>
          When you use an AI feature, the relevant text is sent to Anthropic&apos;s API, and the response is checked by our code before it is shown. Only
          send what the feature needs. Don&apos;t paste sensitive personal data, passwords, or payment card details. AI output can be wrong; see the{" "}
          <Link href="/disclaimer">Disclaimer</Link>. Under Anthropic&apos;s commercial API terms, API inputs and outputs are not used to train its
          models by default. Please refer to Anthropic&apos;s privacy policy for details.
        </p>
      </Section>

      <Section id="retention" title="9. Retention and deletion">
        <ul>
          <li>
            <strong>Demo workspaces:</strong> automatically deleted about 24 hours after creation, together with their projects, clients, AI records
            and payment records.
          </li>
          <li>
            <strong>Regular accounts:</strong> kept until you ask us to delete them (see section 12), or until the Service is shut down.
          </li>
          <li>
            <strong>Backups:</strong> daily database backups are stored on the same server and kept for 7 days, so deleted data disappears from backups
            within about a week.
          </li>
          <li>
            <strong>Payment event records</strong> (PayPal webhook data) are kept to prevent duplicate processing and are deleted when the Service is
            shut down.
          </li>
        </ul>
      </Section>

      <Section id="security" title="10. Security">
        <ul>
          <li>HTTPS everywhere, with HSTS.</li>
          <li>Passwords stored as salted hashes; client portal links stored as hashes and encrypted at rest (AES-256-GCM).</li>
          <li>Every workspace&apos;s data is isolated, and access is checked on every request.</li>
          <li>The database is not reachable from the internet. Server access is restricted, and secrets live only in protected server configuration.</li>
          <li>Rate limits protect against abuse.</li>
        </ul>
        <p>No system is perfectly secure. If you notice a vulnerability, please report it privately (section 12).</p>
      </Section>

      <Section id="transfers" title="11. International data transfers">
        <p>
          Your information is stored and processed in the <strong>United States</strong> (AWS us-east-1) and processed by Anthropic and PayPal, which
          may process data in the United States and other countries. The United States has no data protection law considered equivalent to
          Japan&apos;s APPI by the Personal Information Protection Commission. Data protection is generally covered by sector-specific federal laws and
          state laws. We choose providers that maintain recognised security programmes and contractual data protection commitments. By using the
          Service, you consent to these transfers. You may withdraw consent by stopping use and asking us to delete your data.
        </p>
      </Section>

      <Section id="rights" title="12. Your rights and contact">
        <p>
          Under the APPI and other applicable laws, you may ask us to disclose, correct, add to, delete, or stop using the personal information we hold
          about you, or to stop providing it to third parties, and to disclose records of provision to third parties. We will respond within a
          reasonable time after verifying your identity. If you live outside Japan, you may have additional rights under your local law.
        </p>
        <ContactLine />
      </Section>

      <Section id="changes" title="13. Changes to this policy">
        <p>We may update this policy. The &quot;Last updated&quot; date shows the current version. Significant changes will be noted on this page.</p>
      </Section>
    </LegalPage>
  );
}
