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

  it("sends TikTok photos with a title and trims captions to the network limit", () => {
    const photo = buildServiceMetadata("tiktok", { hasVideo: false, hasImage: true, text: "Gancho\n\nresto #viral", tiktokTitle: "Gancho" });
    assert.deepEqual(photo.metadata, { tiktok: { title: "Gancho" } });
    assert.equal(photo.text, "Gancho\n\nresto #viral");
    const long = "a".repeat(2300);
    const video = buildServiceMetadata("tiktok", { hasVideo: true, hasImage: false, text: long });
    assert.equal(video.metadata, undefined);
    assert.equal(video.text?.length, 2200);
    assert.match(video.warning || "", /2200/);
    const bare = buildServiceMetadata("tiktok", { hasVideo: false, hasImage: false, text: "solo texto" });
    assert.match(bare.error || "", /imagen o un video/);
  });

  it("does not invent a Pinterest board", () => {
    const pin = buildServiceMetadata("pinterest", { hasVideo: false, text: "pin" });
    assert.equal(pin.metadata, undefined);
    assert.match(pin.error || "", /tablero/);
  });
});
