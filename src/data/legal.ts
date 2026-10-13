/**
 * Legal documents.
 *
 * IMPORTANT: these are well-structured TEMPLATES, not legal advice. They are
 * deliberately specific about what the software does and does not do, and they
 * avoid claiming compliance that has not been verified. Before any commercial
 * launch, qualified counsel must review them for your target markets.
 *
 * Each document carries a version, effective date and last-updated date, and
 * the versions a user accepted are stored on their account.
 */

export interface LegalSection {
  heading: string;
  body: string[];
  list?: string[];
}

export interface LegalDocument {
  slug: string;
  title: string;
  version: string;
  effectiveDate: string;
  lastUpdated: string;
  summary: string;
  sections: LegalSection[];
}

export const LEGAL_VERSION = "1.0";
export const LEGAL_EFFECTIVE_DATE = "2025-01-01";
export const LEGAL_LAST_UPDATED = "2025-01-01";

export const LEGAL_DOCUMENTS: LegalDocument[] = [
  {
    slug: "terms",
    title: "Terms of Service",
    version: LEGAL_VERSION,
    effectiveDate: LEGAL_EFFECTIVE_DATE,
    lastUpdated: LEGAL_LAST_UPDATED,
    summary:
      "The rules for using Lattice. This is a research discovery and educational tool — not professional advice.",
    sections: [
      {
        heading: "1. Service description",
        body: [
          "Lattice is a research discovery and educational tool. It helps you explore a topic by extracting concepts from material you provide and surfacing related cases, research, data and perspectives from sources that are actually available to it.",
          "Lattice is a discovery and linking service. It does not republish third-party content. It is not a search engine, an academic database, a news service, or a professional advisory service.",
        ],
      },
      {
        heading: "2. Acceptable use",
        body: ["You agree not to:"],
        list: [
          "abuse, overload, probe or attack the service or its infrastructure;",
          "scrape or harvest the platform in ways that breach these terms or applicable provider terms;",
          "upload malware, or any file intended to compromise the service or another user;",
          "attempt to access another user's account, documents or data;",
          "use the service for unlawful purposes, or in a way that infringes third-party rights;",
          "misuse third-party content retrieved through the service, including by redistributing it in breach of the publisher's terms.",
        ],
      },
      {
        heading: "3. Your content",
        body: [
          "You retain whatever rights you hold in the material you upload or paste. You grant Lattice only the limited permission necessary to process that material in order to provide the service to you.",
          "You are responsible for ensuring you have the right to upload and process the material you provide. Do not upload confidential material you are not permitted to share, and do not upload material you do not have the rights to use.",
        ],
      },
      {
        heading: "4. AI limitations and output accuracy",
        body: [
          "Some deployments enable an optional AI synthesis feature. Where it is enabled, its output is clearly labelled as AI-generated interpretation and is separated from source claims.",
          "AI-generated output can be inaccurate, incomplete or out of date. Any such output must be independently verified against the cited original sources before you rely on it. Deterministic analysis (concept extraction, relevance scoring, summaries) is produced by local software and may also be imperfect.",
          "Lattice is provided for research and educational purposes. It is not a substitute for professional legal, medical, financial or other advice, and must not be relied upon as such.",
        ],
      },
      {
        heading: "5. Third-party sources",
        body: [
          "Lattice links to external websites and displays metadata about third-party sources. It does not control those websites and is not responsible for their content, availability, terms or privacy practices. Your use of a third-party site is governed by that site's own terms.",
          "Source metadata may be incomplete or may change. Where a record is a demonstration record, it is explicitly labelled as fictional in the interface.",
        ],
      },
      {
        heading: "6. Availability",
        body: [
          "The service may experience downtime, errors or interruptions, and external providers may be unavailable. Lattice is designed to degrade gracefully — for example, by using cached results — but no availability guarantee is given.",
        ],
      },
      {
        heading: "7. Account termination",
        body: [
          "You may delete your account at any time from Settings. We may suspend or terminate an account where these terms are breached, where required by law, or where necessary to protect the service or other users.",
        ],
      },
      {
        heading: "8. Liability",
        body: [
          "To the maximum extent permitted by applicable law, Lattice is provided “as is” without warranties of any kind. Liability for any loss arising from your use of the service is limited to the extent permitted by the law applicable in your jurisdiction.",
          "Nothing in these terms excludes liability that cannot lawfully be excluded. The precise scope of this clause depends on the jurisdictions in which the service operates and must be reviewed by qualified counsel.",
        ],
      },
      {
        heading: "9. Changes to these terms",
        body: [
          "We may update these terms. Material changes will be reflected in a new version number and effective date on this page. Where applicable law requires notice or consent for a change, we will provide it before the change takes effect.",
        ],
      },
    ],
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    version: LEGAL_VERSION,
    effectiveDate: LEGAL_EFFECTIVE_DATE,
    lastUpdated: LEGAL_LAST_UPDATED,
    summary:
      "What we collect, why, how long we keep it, and how to remove it. Built to minimise collection by default.",
    sections: [
      {
        heading: "1. What we collect",
        body: ["We deliberately collect as little as possible. In practice:"],
        list: [
          "Account information: your email address and a securely hashed credential (or a credential managed by our authentication provider).",
          "Uploaded material: documents and text you choose to submit, together with the concepts and structure derived from them.",
          "Saved items and exploration history: the cases, ideas, sources and explorations you choose to keep.",
          "Usage information: which features you used and when, used for quotas, cost control and reliability.",
          "Technical information: the minimum needed to operate securely, such as request metadata used for rate limiting.",
        ],
      },
      {
        heading: "2. What we do not collect",
        body: [
          "We do not ask for or store your legal name, phone number, precise location, date of birth, contacts, or unrelated profile information. We do not collect sensitive personal information.",
          "We do not use tracking or advertising cookies. Analytics, where enabled, are privacy-conscious and configured to avoid identifying individuals.",
        ],
      },
      {
        heading: "3. Why we process it",
        body: ["We process data to:"],
        list: [
          "create and manage your account;",
          "provide the service, including analysing your material and retrieving relevant sources;",
          "enforce usage limits and control cost;",
          "maintain security and prevent abuse;",
          "comply with legal obligations.",
        ],
      },
      {
        heading: "4. Legal bases (where applicable)",
        body: [
          "Where the GDPR or similar law applies, processing is based on: performance of a contract (providing the service), legitimate interests (security, reliability, cost control), consent (optional communications, and any non-essential analytics), and legal obligation.",
          "This section describes the intended design. It does not assert that the deployment is compliant; compliance depends on the operator's configuration and jurisdiction.",
        ],
      },
      {
        heading: "5. Third-party processors",
        body: [
          "Depending on configuration, the following categories of processors may be used: hosting, authentication, database, analytics, AI (only if explicitly enabled), source/search providers, and email.",
          "Where AI synthesis is enabled, only relevant excerpts of your material are sent to the configured provider — not entire documents. Where AI is disabled, no material is sent to any AI provider.",
          "A specific, current list of processors must be maintained by the operator of this deployment and disclosed here before launch.",
        ],
      },
      {
        heading: "6. Data retention",
        body: [
          "Account data is retained while your account is active. Uploaded material and derived analysis are retained until you delete them or delete your account.",
          "When you delete your account, your profile, saved items, exploration history and uploaded material are removed. Limited records may be retained only where a legal or security obligation requires it, and only for as long as that obligation lasts.",
        ],
      },
      {
        heading: "7. Your rights",
        body: [
          "Depending on your jurisdiction, you may have rights to access, correct, delete, restrict or object to processing, to data portability, and to withdraw consent.",
          "You can exercise deletion and consent controls directly in Settings. For any other request, use the privacy request form.",
          "We do not claim that every right applies in every jurisdiction. Where a right applies to you, we will honour it in accordance with applicable law.",
        ],
      },
      {
        heading: "8. Security",
        body: [
          "We use HTTPS, hashed credentials, server-side session handling, access controls, input and file validation, size limits, rate limiting and server-side API keys. Uploaded files are treated as untrusted input and are never executed.",
        ],
      },
      {
        heading: "9. Children",
        body: [
          "The minimum age to use Lattice is 16 unless a higher age is required in your jurisdiction. We do not knowingly collect data from children below that age. If you believe a child has provided us with personal data, contact us so it can be removed.",
        ],
      },
      {
        heading: "10. Contact",
        body: [
          "For privacy questions or requests, use the privacy request form or the contact details on the Contact page.",
        ],
      },
    ],
  },
  {
    slug: "cookies",
    title: "Cookie Policy",
    version: LEGAL_VERSION,
    effectiveDate: LEGAL_EFFECTIVE_DATE,
    lastUpdated: LEGAL_LAST_UPDATED,
    summary: "Lattice sets only the cookies it needs to keep you signed in. No advertising or tracking cookies.",
    sections: [
      {
        heading: "1. Cookies we set",
        body: ["Lattice uses a minimal set of cookies:"],
        list: [
          "Session cookie — an httpOnly, SameSite=Lax cookie that keeps you signed in. It is strictly necessary and cannot be disabled while you are signed in.",
          "Authentication provider cookies — if Supabase Auth is configured, that provider may set its own session cookies, managed server-side.",
        ],
      },
      {
        heading: "2. Cookies we do not set",
        body: [
          "We do not set advertising, tracking or cross-site profiling cookies. We do not embed third-party tracking SDKs. Where privacy-conscious analytics are enabled, they are configured to avoid identifying individuals and to require consent where applicable law demands it.",
        ],
      },
      {
        heading: "3. Managing cookies",
        body: [
          "You can clear or block cookies in your browser. Blocking the session cookie will sign you out, and the service will still be usable without an account for basic exploration.",
        ],
      },
    ],
  },
  {
    slug: "copyright",
    title: "Copyright & Content Policy",
    version: LEGAL_VERSION,
    effectiveDate: LEGAL_EFFECTIVE_DATE,
    lastUpdated: LEGAL_LAST_UPDATED,
    summary: "How Lattice respects copyright, and how to report a concern.",
    sections: [
      {
        heading: "1. Our approach",
        body: ["Lattice is a discovery tool, not a content-republication service. We:"],
        list: [
          "link to original sources rather than reproducing them;",
          "store metadata (title, publisher, author, date, URL, short description) instead of full articles;",
          "do not copy large copyrighted passages into the database;",
          "respect publisher and API licensing terms, including rate limits and caching rules;",
          "respect robots.txt and technical restrictions where applicable;",
          "provide attribution wherever a third-party source is shown;",
          "keep records of source URLs so provenance is traceable.",
        ],
      },
      {
        heading: "2. User-uploaded content",
        body: [
          "You are responsible for ensuring you have the right to upload and process the material you submit. Educational use does not automatically grant permission to reproduce or commercially process all content.",
        ],
      },
      {
        heading: "3. Reporting a copyright concern",
        body: [
          "If you believe content indexed by Lattice infringes your rights, contact us with: identification of the work, the specific Lattice record or URL, your contact details, and a statement of your good-faith belief.",
          "We will review the claim, restrict or remove the relevant record where appropriate, notify relevant parties where required, and record the action taken.",
          "This is a good-faith process. It is not asserted to satisfy the formal requirements of any particular jurisdiction's notice-and-takedown regime; operators must obtain legal advice for their markets.",
        ],
      },
    ],
  },
  {
    slug: "attribution",
    title: "Source Attribution",
    version: LEGAL_VERSION,
    effectiveDate: LEGAL_EFFECTIVE_DATE,
    lastUpdated: LEGAL_LAST_UPDATED,
    summary: "How sources are credited, and what different source types mean.",
    sections: [
      {
        heading: "1. Attribution format",
        body: ["Third-party sources are displayed with, where available:"],
        list: [
          "the title, publisher and author;",
          "the publication date;",
          "the source type and quality tier;",
          "a link to the original.",
        ],
      },
      {
        heading: "2. Source types",
        body: ["Lattice distinguishes between:"],
        list: [
          "Academic — peer-reviewed papers and preprints;",
          "Government and Primary — official publications, statistics and original datasets;",
          "High-quality journalism — established news organisations;",
          "Reference — encyclopaedic and educational sources;",
          "Debate / Perspective — pro/contra framing, including Britannica ProCon, treated strictly as debate framing rather than as an academic database.",
        ],
      },
      {
        heading: "3. No endorsement",
        body: [
          "Displaying a source does not imply that the publisher endorses Lattice, nor that Lattice endorses the source's conclusions. Where a record is synthetic demonstration content, it is labelled as such.",
        ],
      },
    ],
  },
  {
    slug: "contact",
    title: "Contact",
    version: LEGAL_VERSION,
    effectiveDate: LEGAL_EFFECTIVE_DATE,
    lastUpdated: LEGAL_LAST_UPDATED,
    summary: "How to reach the operator of this deployment.",
    sections: [
      {
        heading: "Operator details",
        body: [
          "This is an open-source deployment. The operator of this instance must publish its own contact details, legal entity name, registered address and, where applicable, a data protection contact here before launch.",
          "For privacy and data-deletion requests, use the privacy request form so the request is recorded and tracked.",
        ],
      },
    ],
  },
];

export function getLegalDocument(slug: string): LegalDocument | undefined {
  return LEGAL_DOCUMENTS.find((d) => d.slug === slug);
}
