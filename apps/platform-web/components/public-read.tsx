"use client";

import {
  PublicApiClient,
  PublicApiError,
  type PublicEligibilityDirectoryBundle,
  type PublicEligibilityDirectoryRecordProof,
  type PublicIssueListItem,
  type PublicIssueListResponse,
  type PublicIssueOverview,
} from "@konsensus/public-api";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import type { PlatformMessages } from "../lib/config";
import { interpolateRoute, withLocale } from "../lib/routes";

type SharedProps = {
  apiOrigin: string;
  issueRoute: string;
  locale: string;
  defaultLocale: string;
  messages: PlatformMessages;
};

type LoadState<T> =
  | { state: "loading" }
  | { state: "loaded"; data: T }
  | { state: "missing" }
  | { state: "error" };

export function IssueBrowser({
  compact = false,
  ...props
}: SharedProps & { compact?: boolean }) {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [result, setResult] = useState<LoadState<PublicIssueListResponse>>({
    state: "loading",
  });

  useEffect(() => {
    const controller = new AbortController();
    setResult({ state: "loading" });
    publicApi(props.apiOrigin)
      .listIssues(submittedQuery ? { q: submittedQuery } : {}, {
        signal: controller.signal,
      })
      .then((data) => setResult({ state: "loaded", data }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setResult({ state: "error" });
        reportPublicReadError(error);
      });
    return () => controller.abort();
  }, [props.apiOrigin, submittedQuery]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedQuery(query.trim());
  }

  return (
    <div>
      {!compact ? (
        <form className="search-form" onSubmit={submit}>
          <input
            aria-label={props.messages.allIssues}
            onChange={(event) => setQuery(event.currentTarget.value)}
            type="search"
            value={query}
          />
          <button type="submit">{props.messages.heroAction}</button>
        </form>
      ) : null}
      {result.state === "loading" ? (
        <output className="notice">{props.messages.loading}</output>
      ) : null}
      {result.state === "error" ? (
        <p className="empty-state" role="alert">
          {props.messages.apiUnavailable}
        </p>
      ) : null}
      {result.state === "loaded" && result.data.issues.length === 0 ? (
        <p className="empty-state">{props.messages.noIssues}</p>
      ) : null}
      {result.state === "loaded" && result.data.issues.length > 0 ? (
        <>
          <div className="issue-grid">
            {(compact
              ? result.data.issues.slice(0, 4)
              : result.data.issues
            ).map((issue) => (
              <IssueCard issue={issue} key={issue.id} {...props} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function EligibilityDirectory({
  voterRoute,
  ...props
}: SharedProps & { voterRoute: string }) {
  const [result, setResult] = useState<
    LoadState<PublicEligibilityDirectoryBundle>
  >({ state: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    publicApi(props.apiOrigin)
      .getEligibilityDirectory({ signal: controller.signal })
      .then((data) => setResult({ state: "loaded", data }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setResult({ state: "error" });
        reportPublicReadError(error);
      });
    return () => controller.abort();
  }, [props.apiOrigin]);

  if (result.state === "loading") {
    return <output className="notice">{props.messages.loading}</output>;
  }
  if (result.state === "error") {
    return (
      <p className="empty-state" role="alert">
        {props.messages.apiUnavailable}
      </p>
    );
  }
  if (result.state === "missing") {
    return (
      <p className="empty-state">{props.messages.noEligibleParticipants}</p>
    );
  }
  if (result.data.records.length === 0) {
    return (
      <p className="empty-state">{props.messages.noEligibleParticipants}</p>
    );
  }

  return (
    <div className="issue-grid">
      {result.data.records.map((record) => {
        const evidence =
          record.eligibilityAssertion.payload.registryEvidence.payload;
        const href = withLocale(
          interpolateRoute(voterRoute, {
            publicVoterId: record.publicVoterId,
          }),
          props.locale,
          props.defaultLocale,
        );
        return (
          <article className="issue-card" key={record.publicVoterId}>
            <div>
              <span className="badge">active</span>
              <h3>{evidence.checkedFullName}</h3>
              <p>{evidence.checkedEmail}</p>
            </div>
            <div className="card-footer">
              <span className="meta">
                {props.messages.eligibleSince}:{" "}
                {formatDate(
                  record.eligibilityDecision.payload.effectiveAt,
                  props.locale,
                )}
              </span>
              <a className="text-link" href={href}>
                {props.messages.openParticipant} →
              </a>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function EligibilityDirectoryRecord({
  publicVoterId,
  votersRoute,
  ...props
}: SharedProps & { publicVoterId: string; votersRoute: string }) {
  const [result, setResult] = useState<
    LoadState<PublicEligibilityDirectoryRecordProof>
  >({ state: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    publicApi(props.apiOrigin)
      .getEligibilityDirectoryRecord(publicVoterId, {
        signal: controller.signal,
      })
      .then((data) => setResult({ state: "loaded", data }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof PublicApiError && error.status === 404) {
          setResult({ state: "missing" });
        } else {
          setResult({ state: "error" });
          reportPublicReadError(error);
        }
      });
    return () => controller.abort();
  }, [props.apiOrigin, publicVoterId]);

  if (result.state === "loading") {
    return <output className="notice">{props.messages.loading}</output>;
  }
  if (result.state === "error") {
    return (
      <p className="empty-state" role="alert">
        {props.messages.apiUnavailable}
      </p>
    );
  }
  if (result.state === "missing") {
    return (
      <p className="empty-state">{props.messages.noEligibleParticipants}</p>
    );
  }

  const { record, recordSha256, checkpoint } = result.data;
  const evidence = record.eligibilityAssertion.payload.registryEvidence.payload;
  const registryUrl = safeExternalUrl(evidence.recordUrl);
  return (
    <article className="prose">
      <a
        className="text-link"
        href={withLocale(votersRoute, props.locale, props.defaultLocale)}
      >
        ← {props.messages.backToDirectory}
      </a>
      <span className="eyebrow">{record.publicVoterId}</span>
      <h1>{evidence.checkedFullName}</h1>
      <p className="lede">{props.messages.eligibilityDirectoryBody}</p>
      <div className="content-grid">
        <section className="question-card">
          <h2>{props.messages.registryEmail}</h2>
          <p>{evidence.checkedEmail}</p>
          {registryUrl ? (
            <a href={registryUrl} rel="noreferrer" target="_blank">
              {registryUrl}
            </a>
          ) : null}
        </section>
        <aside className="side-card">
          <h2>{props.messages.technicalRecord}</h2>
          <dl className="policy-list">
            <dt>recordSha256</dt>
            <dd>{recordSha256}</dd>
            <dt>checkpointSha256</dt>
            <dd>{checkpoint.payloadSha256}</dd>
            <dt>registrationProofId</dt>
            <dd>{record.registration.proofId}</dd>
          </dl>
        </aside>
      </div>
    </article>
  );
}

function IssueCard({
  issue,
  issueRoute,
  locale,
  defaultLocale,
  messages,
}: Omit<SharedProps, "apiOrigin"> & { issue: PublicIssueListItem }) {
  const href = withLocale(
    interpolateRoute(issueRoute, { slug: issue.slug }),
    locale,
    defaultLocale,
  );
  return (
    <article className="issue-card">
      <div>
        <span className="badge">{issue.currentStatusText}</span>
        <h3>{issue.shortTitle ?? issue.title}</h3>
        <p>{issue.plainLanguageSummary || issue.summary}</p>
      </div>
      <div className="meta">
        <span>{issue.jurisdictionLabel}</span>
        <span>
          {issue.positionCount} {messages.responses.toLocaleLowerCase(locale)}
        </span>
      </div>
      <div className="card-footer">
        <span className="meta">{formatDate(issue.updatedAt, locale)}</span>
        <a className="text-link" href={href}>
          {messages.openIssue} →
        </a>
      </div>
    </article>
  );
}

export function IssueDetail({
  slug,
  voteRoute,
  ...props
}: SharedProps & { slug: string; voteRoute: string }) {
  const [result, setResult] = useState<LoadState<PublicIssueOverview>>({
    state: "loading",
  });

  useEffect(() => {
    const controller = new AbortController();
    setResult({ state: "loading" });
    publicApi(props.apiOrigin)
      .getIssue(slug, { signal: controller.signal })
      .then((data) => setResult({ state: "loaded", data }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof PublicApiError && error.status === 404) {
          setResult({ state: "missing" });
        } else {
          setResult({ state: "error" });
          reportPublicReadError(error);
        }
      });
    return () => controller.abort();
  }, [props.apiOrigin, slug]);

  if (result.state === "loading") {
    return <output className="notice">{props.messages.loading}</output>;
  }
  if (result.state === "error") {
    return (
      <p className="empty-state" role="alert">
        {props.messages.apiUnavailable}
      </p>
    );
  }
  if (result.state === "missing") {
    return <p className="empty-state">{props.messages.issueNotFound}</p>;
  }

  const { issue, matters, questions, events, proceedings, decisions, sources } =
    result.data;
  const issuesHref = withLocale(
    props.issueRoute.replace(/\/\{slug\}.*$/, ""),
    props.locale,
    props.defaultLocale,
  );
  const voteHref = withLocale(
    interpolateRoute(voteRoute, { slug }),
    props.locale,
    props.defaultLocale,
  );

  return (
    <>
      <header className="issue-header">
        <a className="text-link" href={issuesHref}>
          ← {props.messages.backToIssues}
        </a>
        <h1>{issue.title}</h1>
        <p className="lede">{issue.plainLanguageSummary || issue.summary}</p>
        <div className="issue-meta">
          <span className="badge">{issue.currentStatusText}</span>
          <span>{issue.jurisdictionLabel}</span>
          <span>{formatDate(issue.updatedAt, props.locale)}</span>
        </div>
      </header>
      <div className="content-grid">
        <section aria-labelledby="questions-heading">
          <h2 id="questions-heading">{props.messages.questions}</h2>
          {questions.map((question) => (
            <article className="question-card" key={question.id}>
              <h3>{question.questionText}</h3>
              {question.plainLanguageText ? (
                <p>{question.plainLanguageText}</p>
              ) : null}
              <div className="question-meta">
                <span>
                  {question.counts.totalCount} {props.messages.responses}
                </span>
                <span>{question.status}</span>
              </div>
              {question.counts.choices.map((choice) => (
                <div className="choice" key={choice.id}>
                  <div className="choice-label">
                    <span>{choice.label}</span>
                    <strong>{choice.percentage.toFixed(1)}%</strong>
                  </div>
                  <div className="choice-track">
                    <div
                      aria-hidden="true"
                      className="choice-fill"
                      style={{
                        width: `${Math.max(0, Math.min(100, choice.percentage))}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </article>
          ))}
          <div className="actions">
            <a className="button" href={voteHref}>
              {props.messages.respond}
            </a>
          </div>
        </section>
        <aside>
          <section className="side-card">
            <h3>{props.messages.sources}</h3>
            <ul className="source-list">
              {sources.map((source) => {
                const href = safeExternalUrl(source.canonicalUrl ?? source.url);
                return (
                  <li key={source.id}>
                    {href ? (
                      <a href={href} rel="noreferrer" target="_blank">
                        {source.title}
                      </a>
                    ) : (
                      source.title
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
          <section className="side-card">
            <h3>{props.messages.methodology}</h3>
            <ul className="policy-list">
              {matters.map((matter) => (
                <li key={matter.id}>{matter.name}</li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
      <IssueRecordCollections
        decisions={decisions}
        events={events}
        locale={props.locale}
        messages={props.messages}
        proceedings={proceedings}
      />
    </>
  );
}

export function IssueRecordCollections({
  decisions,
  events,
  locale,
  messages,
  proceedings,
}: {
  decisions: PublicIssueOverview["decisions"];
  events: PublicIssueOverview["events"];
  locale: string;
  messages: PlatformMessages;
  proceedings: PublicIssueOverview["proceedings"];
}) {
  return (
    <>
      {events.length > 0 ? (
        <RecordSection heading={messages.events} id="events">
          {events.map((event) => (
            <article className="record-card" key={event.id}>
              <h3>{event.title}</h3>
              <p>{event.summary}</p>
              <div className="record-meta">
                <span>
                  {formatDate(event.occurredAt ?? event.updatedAt, locale)}
                </span>
                {event.actorName ? <span>{event.actorName}</span> : null}
                <span>{event.eventType}</span>
              </div>
            </article>
          ))}
        </RecordSection>
      ) : null}
      {proceedings.length > 0 ? (
        <RecordSection heading={messages.proceedings} id="proceedings">
          {proceedings.map((proceeding) => (
            <article className="record-card" key={proceeding.id}>
              <h3>
                {proceeding.bodyName}
                {proceeding.caseNumber ? ` · ${proceeding.caseNumber}` : ""}
              </h3>
              <p>{proceeding.partiesSummary}</p>
              <div className="record-meta">
                <span>{proceeding.proceedingType}</span>
                <span>{proceeding.status}</span>
                {proceeding.city ? <span>{proceeding.city}</span> : null}
                {proceeding.startedAt ? (
                  <span>{formatDate(proceeding.startedAt, locale)}</span>
                ) : null}
              </div>
            </article>
          ))}
        </RecordSection>
      ) : null}
      {decisions.length > 0 ? (
        <RecordSection heading={messages.decisions} id="decisions">
          {decisions.map((decision) => (
            <article className="record-card" key={decision.id}>
              <h3>{decision.decisionTitle}</h3>
              <p>{decision.decisionSummary}</p>
              <p>
                <strong>{decision.outcomeSummary}</strong>
              </p>
              <p>{decision.legalEffectSummary}</p>
              <div className="record-meta">
                <span>{decision.bodyName}</span>
                <span>{decision.finalityStatus}</span>
                {decision.decisionDate ? (
                  <span>{formatDate(decision.decisionDate, locale)}</span>
                ) : null}
              </div>
            </article>
          ))}
        </RecordSection>
      ) : null}
    </>
  );
}

function RecordSection({
  heading,
  id,
  children,
}: {
  heading: string;
  id: string;
  children: ReactNode;
}) {
  const headingId = `record-${id}`;
  return (
    <section aria-labelledby={headingId} className="record-section">
      <h2 id={headingId}>{heading}</h2>
      <div className="record-grid">{children}</div>
    </section>
  );
}

function publicApi(origin: string) {
  const baseUrl = origin.startsWith("/")
    ? new URL(origin, window.location.origin)
    : origin;
  return new PublicApiClient({ baseUrl });
}

function safeExternalUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
  }).format(new Date(value));
}

function reportPublicReadError(error: unknown) {
  if (process.env.NODE_ENV !== "test") {
    console.error("Public read failed", error);
  }
}
