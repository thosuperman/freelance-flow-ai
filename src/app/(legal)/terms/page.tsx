import type { Metadata } from "next";
import Link from "next/link";
import { ContactLine, LegalPage, Section } from "@/components/legal/legal";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={
        <>
          <strong>In short:</strong> FreelanceFlow AI is a free, personal hobby project and hackathon showcase, not a commercial service. It is provided{" "}
          <strong>&quot;AS IS&quot; and &quot;AS AVAILABLE&quot;</strong>, and you use it <strong>at your own risk</strong>. Payments run in PayPal
          Sandbox (simulated money), and AI output can be wrong.
        </>
      }
    >
      <Section id="acceptance" title="1. Acceptance of these terms">
        <p>
          These terms apply only to FreelanceFlow AI at freelanceflow.hayaix.tech and its features (the &quot;Service&quot;), operated by the
          project&apos;s developer (&quot;we&quot;, &quot;us&quot;). By using the Service, including demo workspaces and client portal links, you agree
          to these terms and to our <Link href="/privacy">Privacy Policy</Link> and <Link href="/disclaimer">Disclaimer</Link>. If you do not agree,
          please do not use the Service.
        </p>
      </Section>

      <Section id="service" title="2. What the Service is">
        <p>
          The Service helps freelancers turn client conversations into proposals, milestones and payment requests, detect scope changes with AI, and
          view project financials. It is a free, personal hobby project and hackathon showcase, not a commercial product or service. All features and
          content are provided free of charge. Your use is voluntary.
        </p>
        <ul>
          <li>
            <strong>Payments are simulated.</strong> The deployment uses PayPal&apos;s Sandbox environment. No real money is transferred, and Sandbox
            &quot;payments&quot; have no monetary value.
          </li>
          <li>
            <strong>Not legal, financial or tax advice.</strong> Proposals, approvals and change requests are workflow records. Approvals are recorded
            consent, not qualified electronic signatures, and are not a substitute for a professionally drafted contract.
          </li>
          <li>
            <strong>No financial outcomes are promised.</strong> The Service does not guarantee any income, payment, investment return or other financial
            result.
          </li>
        </ul>
      </Section>

      <Section id="permitted" title="3. Permitted use">
        <p>You may use the Service to evaluate it, to explore the demo, and for personal, non-commercial testing.</p>
      </Section>

      <Section id="prohibited" title="4. Prohibited activities">
        <p>You agree not to:</p>
        <ul>
          <li>use the Service for real transactions, or enter real payment card or bank details;</li>
          <li>enter other people&apos;s personal data without a lawful basis, or sensitive personal data of any kind;</li>
          <li>attempt to access other users&apos; workspaces, data or portal links, or bypass authentication, rate limits or security controls;</li>
          <li>probe, scan, overload or disrupt the Service or its infrastructure, or run automated traffic beyond normal evaluation;</li>
          <li>use the AI features to produce unlawful, harmful, deceptive or infringing content, or to extract the system&apos;s prompts or keys;</li>
          <li>change the password or settings of the shared PayPal Sandbox test account shown to reviewers;</li>
          <li>upload or submit malware, or violate any applicable law or third-party rights.</li>
        </ul>
        <p>We may suspend or delete accounts, workspaces or data involved in prohibited use, without notice.</p>
      </Section>

      <Section id="responsibilities" title="5. Your responsibilities">
        <ul>
          <li>Keep your sign-in details and any client portal links private. Anyone with a portal link can act as that client.</li>
          <li>Check all AI-generated content, amounts and dates before relying on them.</li>
          <li>Make sure you are allowed to enter any information about clients or other people that you add to the Service.</li>
          <li>Keep your own copies of anything important. Demo workspaces are deleted automatically after 24 hours.</li>
        </ul>
      </Section>

      <Section id="ip" title="6. Intellectual property">
        <p>
          The Service&apos;s source code is published under the{" "}
          <a href="https://github.com/thosuperman/freelance-flow-ai/blob/main/LICENSE" target="_blank" rel="noopener">
            MIT License
          </a>
          . Names, logos and trademarks of third parties (including PayPal, Anthropic/Claude, AWS, Bryntum and AG Grid) belong to their owners and are
          used only to identify their services. Content you enter remains yours. You give us permission to store and process it only as needed to
          operate the Service.
        </p>
      </Section>

      <Section id="third-party" title="7. Third-party services and independently operated sites">
        <p>
          The Service relies on third-party services: PayPal (payments, Sandbox), Anthropic (Claude AI), Amazon Web Services (hosting), Bryntum Gantt and
          AG Studio (in-browser components, used under trial licences). Their own terms and privacy policies apply to your use of them, for example
          when you log in to PayPal. We do not control and are not responsible for third-party websites, services or content.
        </p>
        <p>
          FreelanceFlow AI is a separate project hosted on a subdomain of hayaix.tech. The hayaix.tech website and any other applications or
          subdomains linked from it are operated independently under their own terms and policies. These terms cover FreelanceFlow AI only, and
          those terms cover only their own sites.
        </p>
      </Section>

      <Section id="availability" title="8. Availability and changes">
        <p>
          The Service is provided on a best-effort basis. It may be slow, unavailable, changed, reset or discontinued at any time without notice,
          including after the hackathon. We may delete data, update features or change these terms. The &quot;Last updated&quot; date above shows the
          latest version.
        </p>
      </Section>

      <Section id="experimental" title="9. Experimental software and beta features">
        <p>
          All features are experimental, including AI extraction, scope checks, schedule explanations, the analytics assistant and the timeline. They
          may produce errors, behave unexpectedly or be removed. See the <Link href="/disclaimer">Disclaimer</Link>.
        </p>
      </Section>

      <Section id="warranty" title="10. Provided &quot;as is&quot;, at your own risk">
        <p>
          The Service and all content are provided free of charge, <strong>&quot;AS IS&quot; and &quot;AS AVAILABLE&quot;</strong>, without
          warranties of any kind, express or implied, including merchantability, fitness for a particular purpose, accuracy, reliability, security,
          non-infringement and uninterrupted or error-free operation. We do not guarantee that the Service will be available, accurate, secure or
          free of errors. <strong>You use the Service voluntarily and at your own risk.</strong>
        </p>
      </Section>

      <Section id="liability" title="11. Responsibility for losses">
        <p>
          To the extent permitted by applicable law, we are not responsible for any loss or damage arising from your use of, or inability to use, the
          Service. This includes losses from relying on experimental features, AI-generated content, calculations or third-party services, and loss
          of data, income or business opportunities.
        </p>
        <p>
          Nothing in these terms excludes or limits any liability that cannot be excluded or limited under Japanese law, including the Consumer
          Contract Act, such as liability for intentional misconduct or gross negligence. Where a provision cannot apply under such law, it applies
          only to the extent the law allows.
        </p>
      </Section>

      <Section id="law" title="12. Governing law">
        <p>
          These terms are governed by the laws of Japan, without regard to conflict-of-law rules, subject to any mandatory consumer protection laws of
          your place of residence that apply to you.
        </p>
      </Section>

      <Section id="contact" title="13. Contact">
        <ContactLine />
      </Section>
    </LegalPage>
  );
}
