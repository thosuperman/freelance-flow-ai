import type { Metadata } from "next";
import Link from "next/link";
import { ContactLine, LegalPage, Section } from "@/components/legal/legal";

export const metadata: Metadata = { title: "Disclaimer" };

export default function DisclaimerPage() {
  return (
    <LegalPage
      title="Disclaimer"
      intro={
        <>
          <strong>In short:</strong> this is a free, personal hobby project and experiment, provided <strong>&quot;AS IS&quot; and &quot;AS
          AVAILABLE&quot;</strong>. <strong>Use it at your own risk.</strong> Treat everything it shows, especially AI output, as a draft to check, not as
          advice or a guarantee. Payments are PayPal Sandbox simulations.
        </>
      }
    >
      <Section id="project" title="A personal hackathon project">
        <p>
          FreelanceFlow AI is a free, personal hobby project and experiment, built as a showcase for the PayPal AI Hackathon 2026. It is not a
          commercial product or service, and it is not affiliated with or endorsed by PayPal, Anthropic, Amazon Web Services, Bryntum or AG Grid.
          It is a separate project on a subdomain of hayaix.tech. The hayaix.tech website and any other applications linked from it are operated
          independently, and this disclaimer covers FreelanceFlow AI only.
        </p>
      </Section>

      <Section id="experimental" title="Informational and experimental use only">
        <ul>
          <li>The software and content are provided free of charge for demonstration, informational and experimental purposes. You use them voluntarily and at your own risk.</li>
          <li>
            There is no guarantee of availability, accuracy, completeness, reliability, security, uninterrupted operation or fitness for a particular
            purpose. Features and data may change, break or be deleted at any time.
          </li>
          <li>
            Nothing on this site is legal, financial, tax or business advice. Proposals, approvals and change requests are workflow records, not legally
            reviewed contracts or qualified electronic signatures. Consult a qualified professional for real agreements.
          </li>
          <li>
            <strong>Payments are simulated.</strong> The site uses PayPal Sandbox. Sandbox balances, receipts and captures have no real-world value,
            and no real money moves.
          </li>
          <li>Figures shown, such as totals, outstanding balances and timelines, are calculated from data entered in the app and can be wrong if that data is wrong.</li>
          <li>No income, payment, investment return or other financial outcome is promised or guaranteed.</li>
        </ul>
      </Section>

      <Section id="ai" title="AI-generated content">
        <ul>
          <li>
            AI features (project extraction, proposal drafts, scope checks, schedule explanations, financial answers and the analytics assistant) use
            Anthropic&apos;s Claude models. <strong>AI-generated content may contain errors</strong>, omissions or misunderstandings, and can sound
            confident when it is wrong.
          </li>
          <li>
            <strong>Always verify outputs independently</strong> before relying on them, especially amounts, dates, scope decisions and anything you
            send to a client.
          </li>
          <li>
            The app is designed so that AI suggests and people decide. Prices are calculated by code from your own rates, and commitments require
            explicit approval. You remain responsible for what you approve and send.
          </li>
          <li>
            AI services may change, slow down, hit usage limits or become unavailable at any time, and responses to the same input can differ between
            runs.
          </li>
          <li>Don&apos;t enter sensitive personal data into AI features. See the <Link href="/privacy">Privacy Policy</Link>.</li>
        </ul>
      </Section>

      <Section id="third-party" title="Third-party services and trial software">
        <p>
          The site depends on third-party services (PayPal, Anthropic, AWS) and uses Bryntum Gantt and AG Studio under their trial licences. Watermarks
          may appear, and these components or services may stop working when trials end or providers change their offerings. We are not responsible
          for third-party services; their own terms apply.
        </p>
      </Section>

      <Section id="liability" title="Responsibility for losses">
        <p>
          To the extent permitted by applicable law, we are not responsible for losses arising from reliance on experimental features, AI-generated
          content, calculations or third-party services. Nothing here excludes liability that cannot be excluded under Japanese law. See the{" "}
          <Link href="/terms">Terms of Service</Link>.
        </p>
      </Section>

      <Section id="contact" title="Contact">
        <ContactLine />
      </Section>
    </LegalPage>
  );
}
