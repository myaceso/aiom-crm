import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildServiceMetadata, resolveInstagramType } from "./metadata";

describe("Buffer channel metadata", () => {
  it("requires an Instagram type and shares posts and reels to the feed", () => {
    assert.equal(resolveInstagramType(undefined, false), "post");
    assert.equal(resolveInstagramType(undefined, true), "reel");
    assert.equal(resolveInstagramType("post", true), "reel");
    assert.equal(resolveInstagramType("story", true), "story");
    assert.deepEqual(buildServiceMetadata("instagram", { hasVideo: false, text: "hola" }).metadata, {
      instagram: { type: "post", shouldShareToFeed: true },
    });
    assert.deepEqual(buildServiceMetadata("instagram", { hasVideo: true, text: "clip" }).metadata, {
      instagram: { type: "reel", shouldShareToFeed: true },
    });
    assert.deepEqual(buildServiceMetadata("instagram", { hasVideo: false, instagramType: "story", text: "hola" }).metadata, {
      instagram: { type: "story", shouldShareToFeed: false },
    });
  });

  it("sets defaults for Facebook, Google Business and YouTube", () => {
    assert.deepEqual(buildServiceMetadata("facebook", { hasVideo: false, text: "hola" }).metadata, {
      facebook: { type: "post" },
    });
    assert.deepEqual(buildServiceMetadata("googlebusiness", { hasVideo: false, text: "hola" }).metadata, {
      google: { type: "post" },
    });
    const youtube = buildServiceMetadata("youtube", { hasVideo: true, text: "Título del video\nresto" }).metadata as {
      youtube: { title: string; categoryId: string };
    };
    assert.equal(youtube.youtube.title, "Título del video");
    assert.equal(youtube.youtube.categoryId, "22");
  });

  it("does not invent a Pinterest board", () => {
    const pin = buildServiceMetadata("pinterest", { hasVideo: false, text: "pin" });
    assert.equal(pin.metadata, undefined);
    assert.match(pin.error || "", /tablero/);
  });
});
