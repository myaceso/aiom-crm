import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BufferApiError, createBufferClient } from "./client";
import { runDailyPass } from "./daily";
import { BUFFER_MSG } from "./messages";
import { createMockBuffer, MOCK_FB, MOCK_IG } from "./mock";
import { blankConfig, type BufferAuthRecord } from "./model";
import { refreshAccessToken } from "./oauth";
import { dueSlots, pickDailyContent, studioGalleryAssets, zonedSlotToUtc } from "./schedule";

function auth(channelIds: string[]): BufferAuthRecord {
  return {
    method: "api_key",
    apiKey: "ok-key",
    accessToken: "",
    refreshToken: "",
    accessTokenExpiresAt: "",
    accountId: "111111111111111111111111",
    accountEmail: "hola@enone.app",
    organizationId: "aaaaaaaaaaaaaaaaaaaaaaaa",
    organizationName: "enone",
    channelIds,
    verifiedAt: "2026-11-25T00:00:00.000Z",
    channels: [
      {
        id: MOCK_IG,
        name: "enone",
        displayName: "enone",
        service: "instagram",
        type: "business",
        avatar: "",
        descriptor: "Instagram Business",
        isDisconnected: false,
        isLocked: false,
        isQueuePaused: false,
        organizationId: "aaaaaaaaaaaaaaaaaaaaaaaa",
      },
      {
        id: MOCK_FB,
        name: "enone",
        displayName: "enone fb",
        service: "facebook",
        type: "page",
        avatar: "",
        descriptor: "Facebook Page",
        isDisconnected: false,
        isLocked: false,
        isQueuePaused: false,
        organizationId: "aaaaaaaaaaaaaaaaaaaaaaaa",
      },
    ],
  };
}

describe("Buffer client (mock)", () => {
  it("rejects a missing key in Spanish", async () => {
    const mock = createMockBuffer();
    const client = createBufferClient("", mock.transport);
    await assert.rejects(() => client.inspect(), (err: unknown) => {
      assert.ok(err instanceof BufferApiError);
      assert.equal(err.message, BUFFER_MSG.missing);
      return true;
    });
    assert.equal(mock.calls, 0);
  });

  it("rejects an invalid key in Spanish", async () => {
    const mock = createMockBuffer();
    const client = createBufferClient("invalid", mock.transport);
    await assert.rejects(() => client.inspect(), (err: unknown) => {
      assert.ok(err instanceof BufferApiError);
      assert.equal(err.message, BUFFER_MSG.unauthorized);
      return true;
    });
  });

  it("lists organizations and channels, then queues an image and schedules a video", async () => {
    const mock = createMockBuffer();
    const client = createBufferClient("ok-key", mock.transport);
    const snap = await client.inspect();
    assert.equal(snap.email, "hola@enone.app");
    assert.equal(snap.organizations[0].channels.length, 2);

    const queued = await client.createPost({
      channelId: MOCK_IG,
      text: "Hola desde enone",
      mode: "addToQueue",
      media: [{ url: "https://cdn.example.test/a.jpg", kind: "image", name: "a.jpg" }],
    });
    assert.equal(queued.id, "post_1");
    assert.equal(mock.posts[0].input.mode, "addToQueue");
    assert.deepEqual(mock.posts[0].input.assets, [{ image: { url: "https://cdn.example.test/a.jpg" } }]);

    const scheduled = await client.createPost({
      channelId: MOCK_FB,
      text: "Video",
      mode: "customScheduled",
      dueAt: "2026-12-01T15:00:00.000Z",
      media: [
        { url: "https://cdn.example.test/v.mp4", kind: "video", name: "v.mp4" },
        { url: "https://cdn.example.test/extra.jpg", kind: "image", name: "extra.jpg" },
      ],
    });
    assert.equal(scheduled.dueAt, "2026-12-01T15:00:00.000Z");
    assert.match(scheduled.warning || "", /un solo video/);
    assert.deepEqual(mock.posts[1].input.assets, [{ video: { url: "https://cdn.example.test/v.mp4" } }]);
  });

  it("translates Buffer channel errors and retries notification-only profiles", async () => {
    const mock = createMockBuffer();
    const client = createBufferClient("ok-key", mock.transport);
    await assert.rejects(
      () => client.createPost({ channelId: "dddddddddddddddddddddddd", text: "x", mode: "shareNow", media: [] }),
      (err: unknown) => {
        assert.ok(err instanceof BufferApiError);
        assert.match(err.message, /no encontrado/);
        return true;
      }
    );
    const post = await client.createPost({
      channelId: "eeeeeeeeeeeeeeeeeeeeeeee",
      text: "aviso",
      mode: "addToQueue",
      media: [],
    });
    assert.equal(post.schedulingType, "notification");
  });

  it("maps rate limits to Spanish", async () => {
    const mock = createMockBuffer();
    const client = createBufferClient("limited", mock.transport);
    await assert.rejects(() => client.inspect(), (err: unknown) => {
      assert.ok(err instanceof BufferApiError);
      assert.equal(err.message, BUFFER_MSG.rate);
      return true;
    });
  });
});

describe("daily schedule", () => {
  it("converts a Mexico City slot to UTC and only returns due times", () => {
    const utc = zonedSlotToUtc("2026-11-25", "09:00", "America/Mexico_City");
    assert.equal(utc.toISOString(), "2026-11-25T15:00:00.000Z");
    const schedule = blankConfig().schedule;
    schedule.enabled = true;
    schedule.timezone = "UTC";
    schedule.times = ["09:00", "18:00"];
    const morning = dueSlots(new Date("2026-11-25T10:00:00.000Z"), schedule);
    assert.deepEqual(morning, ["09:00"]);
    schedule.fired["09:00"] = "2026-11-25";
    assert.deepEqual(dueSlots(new Date("2026-11-25T10:00:00.000Z"), schedule), []);
  });

  it("prefers an unused draft, then the gallery", () => {
    const drafts = [
      { id: "d1", body: "Primero", status: "draft" as const, mediaIds: ["a1"], createdAt: "2026-11-01T00:00:00.000Z" },
      { id: "d2", body: "Publicado", status: "published" as const, mediaIds: [], createdAt: "2026-11-02T00:00:00.000Z" },
    ];
    const assets = [
      { id: "a1", url: "https://cdn.example.test/a.jpg", kind: "image" as const, name: "a.jpg", createdAt: "2026-11-01T00:00:00.000Z" },
      { id: "g1", url: "https://cdn.example.test/g.jpg", kind: "image" as const, name: "g.jpg", createdAt: "2026-11-03T00:00:00.000Z" },
    ];
    const first = pickDailyContent({ source: "both", drafts, assets, usedDraftIds: [], usedAssetIds: [] });
    assert.equal(first?.kind, "draft");
    assert.equal(first?.refId, "d1");
    assert.equal(first?.media[0].url, "https://cdn.example.test/a.jpg");
    const second = pickDailyContent({ source: "both", drafts, assets, usedDraftIds: ["d1"], usedAssetIds: [] });
    assert.equal(second?.kind, "asset");
    assert.equal(second?.refId, "g1");
    const none = pickDailyContent({ source: "drafts", drafts, assets, usedDraftIds: ["d1"], usedAssetIds: [] });
    assert.equal(none, null);
    const studio = studioGalleryAssets([
      { id: "11111111-2222-3333-4444-555555555555", url: "/api/marketing/creative/file/local", kind: "image", name: "local.jpg", createdAt: "2026-11-04T00:00:00.000Z" },
      { id: "66666666-7777-8888-9999-aaaaaaaaaaaa", url: "https://blob.example.test/estudio.jpg", kind: "image", name: "estudio.jpg", createdAt: "2026-11-04T00:00:00.000Z" },
    ]);
    assert.equal(studio.length, 1);
    assert.equal(studio[0].id, "creative:66666666-7777-8888-9999-aaaaaaaaaaaa");
    const fromStudio = pickDailyContent({
      source: "gallery",
      drafts: [],
      assets: studio,
      usedDraftIds: [],
      usedAssetIds: [],
    });
    assert.equal(fromStudio?.refId, studio[0].id);
    assert.equal(fromStudio?.media[0].url, "https://blob.example.test/estudio.jpg");
    const pinnedFirst = pickDailyContent({
      source: "drafts",
      drafts,
      assets: studio,
      usedDraftIds: [],
      usedAssetIds: [],
      pinnedIds: ["66666666-7777-8888-9999-aaaaaaaaaaaa"],
    });
    assert.equal(pinnedFirst?.kind, "asset");
    assert.equal(pinnedFirst?.refId, studio[0].id);
    assert.equal(pinnedFirst?.media[0].name, "estudio.jpg");
  });

  it("sends one daily post per due slot and does not repeat it the same day", async () => {
    const mock = createMockBuffer();
    const cfg = blankConfig();
    cfg.auth = auth([MOCK_IG]);
    cfg.schedule.enabled = true;
    cfg.schedule.timezone = "UTC";
    cfg.schedule.times = ["09:00", "10:00"];
    cfg.schedule.mode = "queue";
    cfg.schedule.source = "both";
    cfg.schedule.channelIds = [MOCK_IG, MOCK_FB];
    cfg.schedule.aiCaptions = true;
    const now = new Date("2026-11-25T10:30:00.000Z");
    const deps = {
      now,
      config: cfg,
      drafts: [{ id: "d1", body: "Borrador del día", status: "draft", mediaIds: ["a1"], createdAt: "2026-11-01T00:00:00.000Z" }],
      assets: [
        { id: "a1", url: "https://cdn.example.test/a.jpg", kind: "image" as const, name: "a.jpg", createdAt: "2026-11-01T00:00:00.000Z" },
        { id: "g1", url: "https://cdn.example.test/g.jpg", kind: "image" as const, name: "g.jpg", createdAt: "2026-11-02T00:00:00.000Z" },
      ],
      resolveToken: async () => "ok-key",
      clientFor: (token: string) => createBufferClient(token, mock.transport),
      caption: async () => ({ text: "Pie generado", ai: true, warning: null }),
    };
    const first = await runDailyPass(deps);
    assert.equal(first.sent, 2);
    assert.equal(mock.posts.length, 4);
    assert.equal(mock.posts[0].input.text, "Pie generado");
    assert.equal(mock.posts[0].input.aiAssisted, true);
    assert.equal(mock.posts[0].input.mode, "addToQueue");
    assert.equal(cfg.schedule.fired["09:00"], "2026-11-25");
    assert.equal(cfg.schedule.fired["10:00"], "2026-11-25");
    assert.deepEqual(cfg.schedule.usedDraftIds, ["d1"]);
    assert.deepEqual(cfg.schedule.usedAssetIds, ["g1"]);
    assert.ok(cfg.logs.filter((l) => l.ok).length >= 4);

    const again = await runDailyPass(deps);
    assert.equal(again.due, 0);
    assert.equal(mock.posts.length, 4);
  });

  it("publishes a saved studio caption instead of asking the text model for a new one", async () => {
    const mock = createMockBuffer();
    const cfg = blankConfig();
    cfg.auth = auth([MOCK_IG]);
    cfg.schedule.enabled = true;
    cfg.schedule.timezone = "UTC";
    cfg.schedule.times = ["09:00"];
    cfg.schedule.mode = "queue";
    cfg.schedule.source = "gallery";
    cfg.schedule.channelIds = [MOCK_IG];
    cfg.schedule.aiCaptions = true;
    let calls = 0;
    const saved = "Nadie te dice esto.\n\nCafé en la terraza\n\n#viral #cafe";
    await runDailyPass({
      now: new Date("2026-11-25T12:00:00.000Z"),
      config: cfg,
      drafts: [],
      assets: [{ id: "creative:cafe", url: "https://cdn.example.test/cafe.jpg", kind: "image", name: "cafe.jpg", createdAt: "2026-11-02T00:00:00.000Z", text: saved }],
      resolveToken: async () => "ok-key",
      clientFor: (token: string) => createBufferClient(token, mock.transport),
      caption: async () => {
        calls += 1;
        return { text: "otro texto", ai: true, warning: null };
      },
    });
    assert.equal(calls, 0);
    assert.equal(mock.posts[0].input.text, saved);
    assert.ok(!mock.posts[0].input.aiAssisted);
  });

  it("records a Spanish error once when credentials are missing and does not call Buffer", async () => {
    const mock = createMockBuffer();
    const cfg = blankConfig();
    cfg.schedule.enabled = true;
    cfg.schedule.timezone = "UTC";
    cfg.schedule.times = ["09:00"];
    cfg.schedule.channelIds = [MOCK_IG];
    const deps = {
      now: new Date("2026-11-25T12:00:00.000Z"),
      config: cfg,
      drafts: [],
      assets: [],
      resolveToken: async () => {
        throw new BufferApiError(BUFFER_MSG.missing, 0, "missing");
      },
      clientFor: (token: string) => createBufferClient(token, mock.transport),
      caption: async ({ text }: { text: string }) => ({ text, ai: false, warning: null }),
    };
    await runDailyPass(deps);
    await runDailyPass(deps);
    assert.equal(mock.calls, 0);
    const errors = cfg.logs.filter((l) => !l.ok);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].error, BUFFER_MSG.missing);
  });

  it("records that there is no pending content", async () => {
    const mock = createMockBuffer();
    const cfg = blankConfig();
    cfg.auth = auth([MOCK_IG]);
    cfg.schedule.enabled = true;
    cfg.schedule.timezone = "UTC";
    cfg.schedule.times = ["09:00"];
    cfg.schedule.channelIds = [MOCK_IG];
    cfg.schedule.source = "drafts";
    await runDailyPass({
      now: new Date("2026-11-25T12:00:00.000Z"),
      config: cfg,
      drafts: [],
      assets: [],
      resolveToken: async () => "ok-key",
      clientFor: (token: string) => createBufferClient(token, mock.transport),
      caption: async ({ text }: { text: string }) => ({ text, ai: false, warning: null }),
    });
    assert.equal(mock.posts.length, 0);
    assert.equal(cfg.logs[0].error, BUFFER_MSG.emptyContent);
  });
});

describe("OAuth refresh", () => {
  it("stores the new single-use refresh token", async () => {
    process.env.BUFFER_CLIENT_ID = "cid";
    process.env.BUFFER_CLIENT_SECRET = "sec";
    let body = "";
    const pair = await refreshAccessToken("old-refresh", async (_url, init) => {
      body = String(init?.body || "");
      return new Response(JSON.stringify({ access_token: "new-access", refresh_token: "new-refresh", expires_in: 3600 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    assert.match(body, /refresh_token=old-refresh/);
    assert.match(body, /client_secret=sec/);
    assert.equal(pair.accessToken, "new-access");
    assert.equal(pair.refreshToken, "new-refresh");
    assert.ok(+new Date(pair.expiresAt) > Date.now());
  });
});
