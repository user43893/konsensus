import { describe, expect, test } from "bun:test";
import { PublicApiClient, PublicApiError } from "./client";

describe("PublicApiClient", () => {
  test("requests the current unversioned endpoint without ambient credentials", async () => {
    let requestedUrl = "";
    let requestedInit: RequestInit | undefined;
    const client = new PublicApiClient({
      baseUrl: "https://example.test/api",
      fetch: async (input, init) => {
        requestedUrl = String(input);
        requestedInit = init;
        return Response.json({
          issues: [],
        });
      },
    });

    await client.listIssues({
      q: "constitutional review",
      matter: "public",
    });

    const url = new URL(requestedUrl);
    expect(url.pathname).toBe("/api/issues");
    expect(url.searchParams.get("q")).toBe("constitutional review");
    expect(url.searchParams.get("matter")).toBe("public");
    expect(url.searchParams.has("limit")).toBe(false);
    expect(url.searchParams.has("offset")).toBe(false);
    expect(requestedInit?.method).toBe("GET");
    expect(requestedInit?.credentials).toBe("omit");
  });

  test("encodes resource identifiers as one path segment", async () => {
    let requestedUrl = "";
    const client = new PublicApiClient({
      baseUrl: "https://example.test/api/",
      fetch: async (input) => {
        requestedUrl = String(input);
        return new Response(JSON.stringify({ error: "not_found" }), {
          status: 404,
        });
      },
    });

    await expect(client.getIssue("../private")).rejects.toBeInstanceOf(
      PublicApiError,
    );
    expect(new URL(requestedUrl).pathname).toBe("/api/issues/..%2Fprivate");
  });

  test("returns structured HTTP failures", async () => {
    const client = new PublicApiClient({
      baseUrl: "https://example.test/api",
      fetch: async () => Response.json({ error: "not_found" }, { status: 404 }),
    });

    try {
      await client.getQuestionCounts("missing");
      throw new Error("expected request to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(PublicApiError);
      expect((error as PublicApiError).status).toBe(404);
      expect((error as PublicApiError).code).toBe("not_found");
    }
  });
});
