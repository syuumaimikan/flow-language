import type { Edge, Node, Viewport } from "@xyflow/react";

export type RuntimeDataType =
  | "number"
  | "string"
  | "boolean"
  | "array"
  | "object"
  | "bytes"
  | "audio"
  | "any";

export type AppTheme = "dark" | "light";
export type BuildLanguage = "rust" | "javascript" | "tauri-gui";
export type DebugMode =
  | "normal"
  | "step-from-start"
  | "step-from-breakpoint";

export type GroupExecutionMode =
  | "group"
  | "while-key"
  | "while-variable"
  | "for-count"
  | "try-catch";

export interface PortDefinition {
  id: string;
  label: string;
  dataType: RuntimeDataType;
  required?: boolean;
}

export interface PluginModuleDefinition {
  id: string;
  version?: string;
  kind:
    | "builtin"
    | "javascript"
    | "webaudio"
    | "external-process";
  source?: string;
  command?: string;
  args?: string[];
}

export interface PluginRuntimeDefinition {
  kind: "javascript" | "external-process";
  handler?: string;
  command?: string;
  args?: string[];
}

export interface PluginNodeDefinition {
  languageType: string;
  title: string;
  category: string;
  description?: string;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  defaultProperties: Record<string, unknown>;
  expression?: string;
  runtime?: PluginRuntimeDefinition;
  requiredModules?: string[];
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  enabled?: boolean;
  modules?: PluginModuleDefinition[];
  nodes: PluginNodeDefinition[];
}

export type EditorNodeData = {
  languageType: string;
  title: string;
  value?: unknown;
  prompt?: string;
  defaultValue?: unknown;
  executionOrder?: number;
  breakpoint?: boolean;
  parallel?: boolean;
  tag?: string;

  executionMode?: GroupExecutionMode;
  stopKey?: string;
  maxIterations?: number;
  loopVariable?: string;
  loopConditionValue?: boolean;
  repeatCount?: number;
  catchErrors?: boolean;
  errorVariable?: string;

  variableName?: string;
  comment?: string;
  typeName?: string;

  functionName?: string;
  parameters?: string;
  functionBody?: string;
  functionAsync?: boolean;
  recursionLimit?: number;

  structName?: string;
  schema?: Record<string, string>;
  className?: string;
  methods?: Record<string, string>;
  unionTag?: string;

  iteratorLimit?: number;
  generatorStartIndex?: number;

  timeoutMs?: number;
  retryCount?: number;
  retryDelayMs?: number;
  concurrency?: number;
  coroutineInitialState?: unknown;
  channelCapacity?: number;

  httpMethod?: string;
  httpTimeoutMs?: number;
  cacheTtlMs?: number;
  streamChunkSize?: number;
  databasePath?: string;
  sqlText?: string;
  cryptoAlgorithm?: string;
  websocketUrl?: string;
  networkTimeoutMs?: number;

  [key: string]: unknown;
};

export type EditorNode = Node<EditorNodeData>;
export type EditorEdge = Edge;

export interface ProgramNode {
  id: string;
  nodeType: string;
  position: { x: number; y: number };
  properties: Record<string, unknown>;
}

export interface ProgramConnection {
  id: string;
  sourceNode: string;
  sourcePort: string;
  targetNode: string;
  targetPort: string;
}

export interface FlowProgram {
  formatVersion: number;
  nodes: ProgramNode[];
  connections: ProgramConnection[];
  plugins: PluginManifest[];
  runtimeInputs: Record<string, unknown>;
}

export interface FlowProject {
  fileType: "flow-language-project";
  formatVersion: 1;
  name: string;
  nodes: EditorNode[];
  edges: EditorEdge[];
  plugins: PluginManifest[];
  theme: AppTheme;
  viewport: Viewport;
}

export interface BuildSettings {
  language: BuildLanguage;
  outputPath: string;
  optimize: boolean;
  pauseAtEnd: boolean;
}

export interface BuildResult {
  success: boolean;
  outputPath: string | null;
  error: string | null;
}

export interface NodeExecutionEvent {
  nodeId: string;
  phase: "before" | "after" | "error";
  outputs?: Record<string, unknown>;
  error?: string;
}

export interface NodeProfileRecord {
  nodeId: string;
  title: string;
  languageType: string;
  calls: number;
  totalMs: number;
  lastMs: number;
  maxMs: number;
  errors: number;
}

export interface PluginPackageInfo {
  id: string;
  name: string;
  version: string;
  description?: string;
  enabled: boolean;
  path: string;
}

export interface GuiComponentSpec {
  id: string;
  kind: "window" | "label" | "button" | "input" | "row" | "column";
  title?: string;
  text?: string;
  value?: string;
  width?: number;
  height?: number;
  children?: GuiComponentSpec[];
}
