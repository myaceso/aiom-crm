import assert from "node:assert/strict";
import test from "node:test";
import { resolveInspectTarget } from "./previewPick.ts";

test("a service card click opens that section and field", () => {
  assert.deepEqual(resolveInspectTarget("services", "svc:credito:title"), {
    panel: "section",
    sectionId: "services",
    field: "svc:credito:title",
  });
});

test("phone and brand clicks open the brand panel, not the hero", () => {
  assert.deepEqual(resolveInspectTarget("hero", "phoneDisplay"), {
    panel: "brand",
    sectionId: "brand",
    field: "phoneDisplay",
  });
  assert.equal(resolveInspectTarget("brand", "headerCta")?.panel, "brand");
});

test("a bare section click still selects the section", () => {
  assert.deepEqual(resolveInspectTarget("faq", null), {
    panel: "section",
    sectionId: "faq",
    field: undefined,
  });
  assert.equal(resolveInspectTarget(null, null), null);
});
