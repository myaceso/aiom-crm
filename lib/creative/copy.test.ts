import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeStoredCopy, postText } from "./copy";

describe("creative caption text", () => {
  it("joins the caption and hashtags with a blank line", () => {
    const text = postText("Nadie te dice esto.\n\nGuárdalo.", ["#viral", "#parati"]);
    assert.equal(text, "Nadie te dice esto.\n\nGuárdalo.\n\n#viral #parati");
  });

  it("reads caption and hashtags saved under the current field names", () => {
    const copy = normalizeStoredCopy({
      caption: "Espera al final.",
      hashtags: ["#viral", "parati"],
    });
    assert.equal(copy.caption, "Espera al final.");
    assert.deepEqual(copy.hashtags, ["#viral", "#parati"]);
    assert.match(postText(copy.caption, copy.hashtags), /#viral #parati$/);
  });

  it("accepts older metadata names when caption or hashtags used another field", () => {
    const copy = normalizeStoredCopy({
      viralCaption: "Texto viejo",
      tags: "#marketing, contenido",
    });
    assert.equal(copy.caption, "Texto viejo");
    assert.deepEqual(copy.hashtags, ["#marketing", "#contenido"]);
  });

  it("keeps an empty caption distinguishable from a saved one", () => {
    assert.equal(postText("", []), "");
    assert.equal(normalizeStoredCopy({ caption: "  ", hashtags: [] }).caption, "");
  });
});
