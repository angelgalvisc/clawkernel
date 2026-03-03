import test from "node:test";
import assert from "node:assert/strict";
import {
  mapA2APartToCkpContent,
  mapCkpContentToA2APart,
  mapA2AMessageToCkpTaskMessage,
  mapCkpTaskMessageToA2AMessage,
  projectSkillToA2A,
  projectAgentCard,
} from "../dist/index.js";

test("A2A part and CKP content mapping is reversible for text/url/data", () => {
  const text = { kind: "text", text: "hello" };
  const mappedText = mapA2APartToCkpContent(text);
  assert.deepEqual(mappedText, { type: "text", text: "hello" });
  assert.deepEqual(mapCkpContentToA2APart(mappedText), text);

  const url = { kind: "url", url: "https://example.com", mime_type: "text/html" };
  const mappedUrl = mapA2APartToCkpContent(url);
  assert.equal(mappedUrl.type, "resource");
  assert.equal(mappedUrl.uri, "https://example.com");

  const data = { kind: "data", data: { x: 1 } };
  const mappedData = mapA2APartToCkpContent(data);
  assert.equal(mappedData.type, "resource");
  assert.deepEqual(mapCkpContentToA2APart(mappedData), data);
});

test("message mapping preserves role and metadata", () => {
  const msg = {
    role: "assistant",
    parts: [{ kind: "text", text: "ok" }],
    metadata: { trace: "1" },
  };
  const ckp = mapA2AMessageToCkpTaskMessage(msg);
  assert.equal(ckp.role, "assistant");
  const back = mapCkpTaskMessageToA2AMessage(ckp);
  assert.equal(back.role, "assistant");
  assert.equal(back.metadata.trace, "1");
});

test("skill and agent projection generate expected A2A fields", () => {
  const skill = projectSkillToA2A({
    name: "deep_research",
    description: "Research deeply",
    labels: { domain: "science" },
    tools_required: ["web-search"],
    input_schema: { type: "object" },
  });
  assert.equal(skill.id, "deep-research");
  assert.ok(skill.tags.includes("domain:science"));
  assert.ok(skill.tags.includes("tool:web-search"));

  const card = projectAgentCard({
    name: "agent",
    version: "1.0.0",
    personality: "x".repeat(250),
    skills: [{ name: "deep_research", description: "Research deeply" }],
  });
  assert.equal(card.name, "agent");
  assert.equal(card.skills.length, 1);
  assert.ok(card.description.endsWith("..."));
});
