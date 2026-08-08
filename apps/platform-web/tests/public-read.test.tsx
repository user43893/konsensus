import { describe, expect, test } from "bun:test";
import {
  conformanceDemoFrontend,
  conformanceDemoProfile,
} from "@konsensus/instance-conformance-demo";
import { demoIssueOverviews } from "@konsensus/instance-conformance-demo/public-data";
import { renderToStaticMarkup } from "react-dom/server";
import { IssueRecordCollections } from "../components/public-read";
import { definePlatformFrontendConfig } from "../lib/config";

describe("public issue rendering", () => {
  test("renders every core issue collection with localized section headings", () => {
    const config = definePlatformFrontendConfig({
      profile: conformanceDemoProfile,
      publicApiOrigin: "/api",
      relyingApplicationOrigin: null,
      ...conformanceDemoFrontend,
    });
    const overview = demoIssueOverviews["coastal-access"];
    const html = renderToStaticMarkup(
      <IssueRecordCollections
        decisions={overview.decisions}
        events={overview.events}
        locale="en-NZ"
        messages={config.messages["en-NZ"]}
        proceedings={overview.proceedings}
      />,
    );

    expect(html).toContain('aria-labelledby="record-events"');
    expect(html).toContain(">Timeline<");
    expect(html).toContain("Synthetic consultation opened");
    expect(html).toContain(">Proceedings<");
    expect(html).toContain("Synthetic Coastal Access Commission");
    expect(html).toContain(">Decisions<");
    expect(html).toContain("Synthetic interim access direction");
  });
});
