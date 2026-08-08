import { notFound, redirect } from "next/navigation";
import {
  EligibilityDirectory,
  EligibilityDirectoryRecord,
  IssueBrowser,
  IssueDetail,
} from "../../components/public-read";
import { platformConfig } from "../../instance.config";
import {
  matchPlatformRoute,
  publicApiResourceUrl,
  relyingApplicationUrl,
  selectLocale,
  withLocale,
} from "../../lib/routes";

type PageProps = {
  params: Promise<{ segments?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
type InstanceLocale = keyof typeof platformConfig.messages;

export default async function PlatformPage({
  params,
  searchParams,
}: PageProps) {
  const { segments = [] } = await params;
  const query = await searchParams;
  const route = matchPlatformRoute(platformConfig.profile, segments);
  if (route.kind === "not-found") notFound();

  const requestedLocale =
    typeof query.lang === "string" ? query.lang : query.lang?.[0];
  const locale = selectLocale(platformConfig.profile, requestedLocale);
  const messages = platformConfig.messages[locale];
  const currentPath = `/${segments.map(encodeURIComponent).join("/")}`;

  if (
    route.kind === "vote" &&
    platformConfig.relyingApplicationOrigin !== null
  ) {
    redirect(
      relyingApplicationUrl(
        platformConfig.relyingApplicationOrigin,
        currentPath,
      ),
    );
  }

  const shared = {
    apiOrigin: platformConfig.publicApiOrigin,
    defaultLocale: platformConfig.profile.locales.default,
    issueRoute: platformConfig.profile.routes.issue,
    locale,
    messages,
  };

  return (
    <div className="site-frame">
      <header className="site-header">
        <a className="brand" href="/">
          <span className="brand-mark">{platformConfig.theme.mark}</span>
          <span className="brand-copy">
            <strong>{platformConfig.profile.brand.name}</strong>
            <small>{platformConfig.profile.brand.shortDescription}</small>
          </span>
        </a>
        <nav aria-label="Primary" className="navigation">
          <a
            href={withLocale(
              platformConfig.profile.routes.issues,
              locale,
              platformConfig.profile.locales.default,
            )}
          >
            {messages.allIssues}
          </a>
          <a
            href={withLocale(
              platformConfig.profile.routes.methodology,
              locale,
              platformConfig.profile.locales.default,
            )}
          >
            {messages.methodology}
          </a>
          <a
            href={withLocale(
              platformConfig.profile.routes.verification,
              locale,
              platformConfig.profile.locales.default,
            )}
          >
            {messages.verification}
          </a>
          {platformConfig.profile.features.publicVoterPages ? (
            <a
              href={withLocale(
                platformConfig.profile.routes.voters,
                locale,
                platformConfig.profile.locales.default,
              )}
            >
              {messages.eligibilityDirectory}
            </a>
          ) : null}
        </nav>
        <nav aria-label="Locale" className="locale-list">
          {platformConfig.profile.locales.supported.map((supportedLocale) => (
            <a
              aria-current={locale === supportedLocale}
              href={withLocale(
                currentPath,
                supportedLocale,
                platformConfig.profile.locales.default,
              )}
              key={supportedLocale}
              lang={supportedLocale}
            >
              {supportedLocale}
            </a>
          ))}
        </nav>
      </header>
      <main className="page">
        {route.kind === "home" ? (
          <Home locale={locale} shared={shared} />
        ) : null}
        {route.kind === "issues" ? (
          <>
            <div className="section-heading">
              <h1>{messages.allIssues}</h1>
            </div>
            <IssueBrowser {...shared} />
          </>
        ) : null}
        {route.kind === "issue" ? (
          <IssueDetail
            {...shared}
            slug={route.slug}
            voteRoute={platformConfig.profile.routes.vote}
          />
        ) : null}
        {route.kind === "methodology" ? <Methodology locale={locale} /> : null}
        {route.kind === "verification" ? (
          <Verification locale={locale} />
        ) : null}
        {route.kind === "voters" ? (
          <article className="prose">
            <span className="eyebrow">
              {platformConfig.profile.qualification.policyId}
            </span>
            <h1>{messages.eligibilityDirectory}</h1>
            <p className="lede">{messages.eligibilityDirectoryBody}</p>
            <EligibilityDirectory
              {...shared}
              voterRoute={platformConfig.profile.routes.voter}
            />
          </article>
        ) : null}
        {route.kind === "voter" ? (
          <EligibilityDirectoryRecord
            {...shared}
            publicVoterId={route.publicVoterId}
            votersRoute={platformConfig.profile.routes.voters}
          />
        ) : null}
        {route.kind === "vote" ? (
          <ReadOnlyBoundary issueSlug={route.slug} locale={locale} />
        ) : null}
      </main>
      <footer className="site-footer">
        <span>
          {platformConfig.profile.brand.name} ·{" "}
          {platformConfig.profile.jurisdiction.name}
        </span>
        <a href={`mailto:${platformConfig.profile.brand.contactEmail}`}>
          {messages.contact}
        </a>
        <a href="/.well-known/deployment.json">deployment.json</a>
        <a href="/.well-known/source.json">source.json</a>
      </footer>
    </div>
  );
}

function Home({
  locale,
  shared,
}: {
  locale: InstanceLocale;
  shared: Parameters<typeof IssueBrowser>[0];
}) {
  const messages = platformConfig.messages[locale];
  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">{messages.heroEyebrow}</span>
          <h1>{platformConfig.profile.brand.name}</h1>
          <p className="lede">
            {platformConfig.profile.brand.shortDescription}
          </p>
          <div className="actions">
            <a
              className="button"
              href={withLocale(
                platformConfig.profile.routes.issues,
                locale,
                platformConfig.profile.locales.default,
              )}
            >
              {messages.heroAction}
            </a>
            <a
              className="button secondary"
              href={withLocale(
                platformConfig.profile.routes.verification,
                locale,
                platformConfig.profile.locales.default,
              )}
            >
              {messages.verification}
            </a>
          </div>
        </div>
        <aside className="hero-note">
          <strong>
            {messages.jurisdiction}: {platformConfig.profile.jurisdiction.name}
          </strong>
          {messages.readOnlyNotice}
        </aside>
      </section>
      <section>
        <div className="section-heading">
          <h2>{messages.featuredIssues}</h2>
          <a
            className="text-link"
            href={withLocale(
              platformConfig.profile.routes.issues,
              locale,
              platformConfig.profile.locales.default,
            )}
          >
            {messages.allIssues} →
          </a>
        </div>
        <IssueBrowser {...shared} compact />
      </section>
    </>
  );
}

function Methodology({ locale }: { locale: InstanceLocale }) {
  const { profile } = platformConfig;
  const messages = platformConfig.messages[locale];
  return (
    <article className="prose">
      <span className="eyebrow">{profile.opinionIndex.policyId}</span>
      <h1>{messages.methodologyTitle}</h1>
      <p className="lede">{messages.methodologyBody}</p>
      <div className="content-grid">
        <div>
          <section className="question-card">
            <h2>{messages.responses}</h2>
            <ul className="policy-list">
              {profile.opinionIndex.groups.map((group) => (
                <li key={group.id}>
                  {group.id}: {group.weight}
                </li>
              ))}
            </ul>
          </section>
        </div>
        <aside className="side-card">
          <h3>{profile.qualification.policyId}</h3>
          <ul className="policy-list">
            {profile.qualification.evidenceTypes.map((type) => (
              <li key={type}>{type}</li>
            ))}
          </ul>
        </aside>
      </div>
    </article>
  );
}

function Verification({ locale }: { locale: InstanceLocale }) {
  const messages = platformConfig.messages[locale];
  return (
    <article className="prose">
      <span className="eyebrow">{messages.verification}</span>
      <h1>{messages.verificationTitle}</h1>
      <p className="lede">{messages.proofBody}</p>
      <section className="question-card">
        <h2>{platformConfig.profile.qualification.policyId}</h2>
        <div className="evidence-types">
          {platformConfig.profile.qualification.evidenceTypes.map((type) => (
            <code key={type}>{type}</code>
          ))}
        </div>
      </section>
      <h2>{messages.featuredProofs}</h2>
      {platformConfig.featuredProofs.length === 0 ? (
        <p className="empty-state">{messages.proofUnavailable}</p>
      ) : (
        <div className="proof-list">
          {platformConfig.featuredProofs.map((proof) => (
            <section className="proof-card" key={`${proof.kind}:${proof.id}`}>
              <span className="badge">{proof.kind}</span>
              <h3>{proof.labels[locale]}</h3>
              <a
                className="text-link"
                href={publicApiResourceUrl(
                  platformConfig.publicApiOrigin,
                  proof.kind,
                  proof.id,
                )}
              >
                {messages.viewRawProof} →
              </a>
            </section>
          ))}
        </div>
      )}
    </article>
  );
}

function ReadOnlyBoundary({
  issueSlug,
  locale,
}: {
  issueSlug: string;
  locale: InstanceLocale;
}) {
  const messages = platformConfig.messages[locale];
  return (
    <article className="prose">
      <span className="eyebrow">{messages.respond}</span>
      <h1>{messages.readOnlyNotice}</h1>
      <p className="empty-state">
        Set <code>KONSENSUS_RELYING_APP_ORIGIN</code> at build time to redirect
        this route to the application responsible for authentication and
        mutations.
      </p>
      <a
        className="text-link"
        href={withLocale(
          platformConfig.profile.routes.issue.replace("{slug}", issueSlug),
          locale,
          platformConfig.profile.locales.default,
        )}
      >
        ← {messages.backToIssues}
      </a>
    </article>
  );
}
