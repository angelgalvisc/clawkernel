/**
 * CKP ↔ A2A Adapter (experimental)
 *
 * Boundary utilities for projecting CKP runtime metadata to A2A discovery
 * objects and mapping task payload/state models.
 */

import type { ContentBlock } from "./types.js";

// ── Discovery Projection Types ─────────────────────────────────────────────

export interface CkpSkillProjection {
  name: string;
  description: string;
  labels?: Record<string, string>;
  tools_required?: string[];
  input_schema?: Record<string, unknown>;
  input_modes?: string[];
  output_modes?: string[];
}

export interface CkpAgentProjectionInput {
  name: string;
  version: string;
  personality?: string;
  interfaces?: A2ASupportedInterface[];
  capabilities?: Record<string, unknown>;
  security_schemes?: Record<string, unknown>;
  security_requirements?: Array<Record<string, unknown>>;
  default_input_modes?: string[];
  default_output_modes?: string[];
  skills?: CkpSkillProjection[];
}

export interface A2ASupportedInterface {
  url: string;
  protocol_binding: string;
  protocol_version: string;
}

export interface A2AAgentSkill {
  id: string;
  name: string;
  description: string;
  tags?: string[];
  input_modes?: string[];
  output_modes?: string[];
  extensions?: Record<string, unknown>;
}

export interface A2AAgentCard {
  name: string;
  version: string;
  description?: string;
  supported_interfaces?: A2ASupportedInterface[];
  capabilities?: Record<string, unknown>;
  security_schemes?: Record<string, unknown>;
  security_requirements?: Array<Record<string, unknown>>;
  default_input_modes?: string[];
  default_output_modes?: string[];
  skills?: A2AAgentSkill[];
}

// ── Task State Mapping ─────────────────────────────────────────────────────

export type A2ATaskState =
  | "submitted"
  | "working"
  | "input_required"
  | "auth_required"
  | "completed"
  | "failed"
  | "canceled"
  | "rejected";

export type CkpTaskState = A2ATaskState;

const TASK_STATES: readonly A2ATaskState[] = [
  "submitted",
  "working",
  "input_required",
  "auth_required",
  "completed",
  "failed",
  "canceled",
  "rejected",
] as const;

export function mapA2ATaskStateToCkp(state: A2ATaskState): CkpTaskState {
  return state;
}

export function mapCkpTaskStateToA2A(state: CkpTaskState): A2ATaskState {
  return state;
}

export function isSupportedA2ATaskState(value: string): value is A2ATaskState {
  return TASK_STATES.includes(value as A2ATaskState);
}

// ── Payload Mapping ────────────────────────────────────────────────────────

export interface A2ATextPart {
  kind: "text";
  text: string;
}

export interface A2ADataPart {
  kind: "data";
  data: Record<string, unknown>;
}

export interface A2AUrlPart {
  kind: "url";
  url: string;
  mime_type?: string;
}

export interface A2ARawPart {
  kind: "raw";
  data: string;
  mime_type?: string;
}

export type A2APart = A2ATextPart | A2ADataPart | A2AUrlPart | A2ARawPart;

export interface A2AMessage {
  role: string;
  parts: A2APart[];
  metadata?: Record<string, unknown>;
}

export interface CkpTaskMessage {
  role: string;
  content: ContentBlock[];
  metadata?: Record<string, unknown>;
}

export function mapA2APartToCkpContent(part: A2APart): ContentBlock {
  switch (part.kind) {
    case "text":
      return { type: "text", text: part.text };
    case "url":
      return {
        type: "resource",
        uri: part.url,
        ...(part.mime_type ? { mimeType: part.mime_type } : {}),
      };
    case "data":
      return {
        type: "resource",
        data: part.data,
      };
    case "raw":
      return {
        type: "resource",
        data: part.data,
        encoding: "base64",
        ...(part.mime_type ? { mimeType: part.mime_type } : {}),
      };
    default: {
      const exhaustive: never = part;
      return exhaustive;
    }
  }
}

export function mapCkpContentToA2APart(content: ContentBlock): A2APart {
  if (content.type === "text") {
    return { kind: "text", text: String(content.text ?? "") };
  }

  const uri = typeof content.uri === "string" ? content.uri : undefined;
  const mimeType = typeof content.mimeType === "string" ? content.mimeType : undefined;

  if (uri) {
    return {
      kind: "url",
      url: uri,
      ...(mimeType ? { mime_type: mimeType } : {}),
    };
  }

  if (typeof content.data === "string") {
    return {
      kind: "raw",
      data: content.data,
      ...(mimeType ? { mime_type: mimeType } : {}),
    };
  }

  if (content.data && typeof content.data === "object") {
    return {
      kind: "data",
      data: content.data as Record<string, unknown>,
    };
  }

  return {
    kind: "data",
    data: content,
  };
}

export function mapA2AMessageToCkpTaskMessage(message: A2AMessage): CkpTaskMessage {
  return {
    role: message.role,
    content: message.parts.map(mapA2APartToCkpContent),
    ...(message.metadata ? { metadata: message.metadata } : {}),
  };
}

export function mapCkpTaskMessageToA2AMessage(message: CkpTaskMessage): A2AMessage {
  return {
    role: message.role,
    parts: message.content.map(mapCkpContentToA2APart),
    ...(message.metadata ? { metadata: message.metadata } : {}),
  };
}

// ── Projection Helpers ─────────────────────────────────────────────────────

function toSkillId(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

function humanize(name: string): string {
  const normalized = name.replace(/[-_]+/g, " ").trim();
  return normalized.length === 0 ? name : normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function summarizePersonality(personality?: string): string | undefined {
  if (!personality) return undefined;
  const compact = personality.replace(/\s+/g, " ").trim();
  if (compact.length <= 200) return compact;
  return compact.slice(0, 197) + "...";
}

export function projectSkillToA2A(skill: CkpSkillProjection): A2AAgentSkill {
  const tags: string[] = [];

  if (skill.labels) {
    for (const [key, value] of Object.entries(skill.labels)) {
      tags.push(`${key}:${value}`);
    }
  }

  if (skill.tools_required) {
    for (const tool of skill.tools_required) {
      tags.push(`tool:${tool}`);
    }
  }

  return {
    id: toSkillId(skill.name),
    name: humanize(skill.name),
    description: skill.description,
    ...(tags.length > 0 ? { tags } : {}),
    ...(skill.input_modes ? { input_modes: skill.input_modes } : {}),
    ...(skill.output_modes ? { output_modes: skill.output_modes } : {}),
    ...(skill.input_schema ? { extensions: { ckp: { input_schema: skill.input_schema } } } : {}),
  };
}

export function projectAgentCard(input: CkpAgentProjectionInput): A2AAgentCard {
  return {
    name: input.name,
    version: input.version,
    ...(summarizePersonality(input.personality) ? { description: summarizePersonality(input.personality) } : {}),
    ...(input.interfaces ? { supported_interfaces: input.interfaces } : {}),
    ...(input.capabilities ? { capabilities: input.capabilities } : {}),
    ...(input.security_schemes ? { security_schemes: input.security_schemes } : {}),
    ...(input.security_requirements ? { security_requirements: input.security_requirements } : {}),
    ...(input.default_input_modes ? { default_input_modes: input.default_input_modes } : {}),
    ...(input.default_output_modes ? { default_output_modes: input.default_output_modes } : {}),
    ...(input.skills ? { skills: input.skills.map(projectSkillToA2A) } : {}),
  };
}
