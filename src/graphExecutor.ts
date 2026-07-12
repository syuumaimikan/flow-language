import { invoke } from "@tauri-apps/api/core";
import {
  exists,
  readTextFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import type { NodeDefinition } from "./nodeDefinitions";
import { runPluginNode } from "./pluginRuntime";
import type {
  DebugMode,
  EditorEdge,
  EditorNode,
  GroupExecutionMode,
  NodeExecutionEvent,
  PluginManifest,
} from "./types";

export interface ExecutionController {
  next(): void;
  continue(): void;
  stop(): void;
}

export interface ExecuteGraphOptions {
  nodes: EditorNode[];
  edges: EditorEdge[];
  definitions: Record<
    string,
    NodeDefinition
  >;
  plugins: PluginManifest[];
  mode: DebugMode;
  onEvent(
    event: NodeExecutionEvent,
  ): void;
  onLog(message: string): void;
  onWaiting(nodeId: string): void;
}

type Gate = {
  promise: Promise<
    "next" | "continue" | "stop"
  >;
  resolve(
    value:
      | "next"
      | "continue"
      | "stop",
  ): void;
};

type LoopSignal =
  | "none"
  | "break"
  | "continue";

type FunctionValue = {
  __flowFunction: true;
  name: string;
  parameters: string[];
  body: string;
  statementBody: boolean;
  asynchronous: boolean;
  recursionLimit: number;
};


type IteratorOperation =
  | {
      kind: "map";
      function: FunctionValue;
    }
  | {
      kind: "filter";
      function: FunctionValue;
    }
  | {
      kind: "take";
      count: number;
    }
  | {
      kind: "skip";
      count: number;
    }
  | {
      kind: "enumerate";
      index: number;
    };

type IteratorSource =
  | {
      kind: "array";
      values: unknown[];
    }
  | {
      kind: "range";
      start: number;
      end: number;
      step: number;
    }
  | {
      kind: "generator";
      function: FunctionValue;
      startIndex: number;
    }
  | {
      kind: "zip";
      first: IteratorValue;
      second: IteratorValue;
    };

type IteratorValue = {
  __flowIterator: true;
  source: IteratorSource;
  operations: IteratorOperation[];
  cursor: number;
};


type PromiseStatus =
  | "pending"
  | "fulfilled"
  | "rejected"
  | "cancelled";

type PromiseValue = {
  __flowPromise: true;
  id: string;
  promise: Promise<unknown>;
  status: PromiseStatus;
  value?: unknown;
  error?: unknown;
  cancel?: () => void;
};

type CoroutineValue = {
  __flowCoroutine: true;
  function: FunctionValue;
  index: number;
  state: unknown;
  done: boolean;
};

type ChannelWaiter = {
  resolve(value: unknown): void;
  reject(error: unknown): void;
};

type ChannelValue = {
  __flowChannel: true;
  id: string;
  capacity: number;
  queue: unknown[];
  waiters: ChannelWaiter[];
  closed: boolean;
};

type CacheEntry = {
  value: unknown;
  expiresAt: number | null;
};

type WebSocketWaiter = {
  resolve(value: unknown): void;
  reject(error: unknown): void;
};

type WebSocketValue = {
  __flowWebSocket: true;
  socket: WebSocket;
  queue: unknown[];
  waiters: WebSocketWaiter[];
  closed: boolean;
};

type StreamOperation =
  | {
      kind: "map";
      function: FunctionValue;
    }
  | {
      kind: "filter";
      function: FunctionValue;
    };

type StreamValue = {
  __flowStream: true;
  values: unknown[];
  operations: StreamOperation[];
  cursor: number;
};

type RuntimeContext = {
  variables: Map<string, unknown>;
  functions: Map<string, FunctionValue>;
  cache: Map<string, CacheEntry>;
};

type NodeRunResult = {
  outputs: Record<string, unknown>;
  signal: LoopSignal;
};

function createGate(): Gate {
  let resolve!: Gate["resolve"];

  const promise = new Promise<
    "next" | "continue" | "stop"
  >((done) => {
    resolve = done;
  });

  return {
    promise,
    resolve,
  };
}

export function createExecutionController() {
  let gate: Gate | null = null;
  let continuing = false;
  let stopped = false;

  return {
    controller: {
      next() {
        gate?.resolve("next");
        gate = null;
      },

      continue() {
        continuing = true;
        gate?.resolve("continue");
        gate = null;
      },

      stop() {
        stopped = true;
        gate?.resolve("stop");
        gate = null;
      },
    } satisfies ExecutionController,

    async wait(
      nodeId: string,
      onWaiting: (
        nodeId: string,
      ) => void,
    ) {
      if (continuing) {
        return;
      }

      if (stopped) {
        throw new Error(
          "実行を停止しました。",
        );
      }

      onWaiting(nodeId);
      gate = createGate();

      const action =
        await gate.promise;

      gate = null;

      if (action === "stop") {
        stopped = true;

        throw new Error(
          "実行を停止しました。",
        );
      }

      if (action === "continue") {
        continuing = true;
      }
    },

    isContinuing() {
      return continuing;
    },
  };
}

function compareNodes(
  a: EditorNode,
  b: EditorNode,
): number {
  const ao =
    a.data.languageType ===
    "core.print"
      ? Number(
          a.data.executionOrder ?? 0,
        )
      : Number.MIN_SAFE_INTEGER;

  const bo =
    b.data.languageType ===
    "core.print"
      ? Number(
          b.data.executionOrder ?? 0,
        )
      : Number.MIN_SAFE_INTEGER;

  return (
    ao -
      bo ||
    a.id.localeCompare(b.id)
  );
}

function topologicalLayers(
  nodes: EditorNode[],
  edges: EditorEdge[],
): EditorNode[][] {
  const byId = new Map(
    nodes.map((node) => [
      node.id,
      node,
    ]),
  );

  const indegree = new Map(
    nodes.map((node) => [
      node.id,
      0,
    ]),
  );

  const outgoing =
    new Map<string, string[]>();

  for (const edge of edges) {
    if (
      !byId.has(edge.source) ||
      !byId.has(edge.target)
    ) {
      continue;
    }

    indegree.set(
      edge.target,
      (indegree.get(edge.target) ??
        0) + 1,
    );

    outgoing.set(
      edge.source,
      [
        ...(outgoing.get(
          edge.source,
        ) ?? []),
        edge.target,
      ],
    );
  }

  const result: EditorNode[][] =
    [];

  let ready = nodes
    .filter(
      (node) =>
        indegree.get(node.id) === 0,
    )
    .sort(compareNodes);

  let count = 0;

  while (ready.length > 0) {
    const current = ready;
    result.push(current);
    ready = [];

    for (const node of current) {
      count += 1;

      for (const target of
        outgoing.get(node.id) ??
        []) {
        const next =
          (indegree.get(target) ??
            1) - 1;

        indegree.set(
          target,
          next,
        );

        if (next === 0) {
          ready.push(
            byId.get(target)!,
          );
        }
      }
    }

    ready.sort(compareNodes);
  }

  if (count !== nodes.length) {
    throw new Error(
      "グラフに循環があります。ループには実行モード付きグループを使用してください。",
    );
  }

  return result;
}

function findPluginNode(
  plugins: PluginManifest[],
  languageType: string,
) {
  for (const plugin of plugins) {
    if (
      plugin.enabled === false
    ) {
      continue;
    }

    const definition =
      plugin.nodes.find(
        (node) =>
          node.languageType ===
          languageType,
      );

    if (definition) {
      return definition;
    }
  }

  return undefined;
}

function runtimeType(
  value: unknown,
): string {
  if (Array.isArray(value)) {
    return "array";
  }

  if (value === null) {
    return "null";
  }

  return typeof value;
}


function inferType(value: unknown): string {
  if (
    typeof value === "object" &&
    value !== null &&
    (value as Record<string, unknown>).__flowOption === true
  ) {
    return "option";
  }

  if (
    typeof value === "object" &&
    value !== null &&
    (value as Record<string, unknown>).__flowUnion === true
  ) {
    return "union";
  }

  if (isFunctionValue(value)) return "function";
  if (isWebSocketValue(value)) return "websocket";
  if (isStreamValue(value)) return "stream";
  if (isPromiseValue(value)) return "promise";
  if (isCoroutineValue(value)) return "coroutine";
  if (isChannelValue(value)) return "channel";
  if (isIteratorValue(value)) return "iterator";
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

function parseParameters(value: unknown): string[] {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function makeFunction(
  node: EditorNode,
  statementBody: boolean,
): FunctionValue {
  return Object.freeze({
    __flowFunction: true as const,
    name: String(node.data.functionName ?? "anonymous"),
    parameters: parseParameters(node.data.parameters),
    body: String(node.data.functionBody ?? "undefined"),
    statementBody,
    asynchronous: Boolean(node.data.functionAsync),
    recursionLimit: Math.max(1, Number(node.data.recursionLimit ?? 128)),
  });
}

function isFunctionValue(value: unknown): value is FunctionValue {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as Record<string, unknown>).__flowFunction === true,
  );
}

async function invokeFunctionValue(
  fn: FunctionValue,
  args: unknown[],
  runtime: RuntimeContext,
  depth = 0,
): Promise<unknown> {
  if (depth >= fn.recursionLimit) {
    throw new Error(
      `関数 ${fn.name} の再帰上限 ${fn.recursionLimit} を超えました。`,
    );
  }

  const recur = (...nextArgs: unknown[]) =>
    invokeFunctionValue(fn, nextArgs, runtime, depth + 1);

  const parameterNames = fn.parameters;
  const parameterValues = parameterNames.map((_, index) => args[index]);

  if (fn.statementBody) {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as
      new (...names: string[]) => (...values: unknown[]) => Promise<unknown>;

    const executor = new AsyncFunction(
      ...parameterNames,
      "recur",
      "variables",
      `"use strict";\n${fn.body}`,
    );

    return executor(
      ...parameterValues,
      recur,
      runtime.variables,
    );
  }

  if (fn.asynchronous) {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as
      new (...names: string[]) => (...values: unknown[]) => Promise<unknown>;

    const executor = new AsyncFunction(
      ...parameterNames,
      "recur",
      "variables",
      `"use strict"; return (${fn.body});`,
    );

    return executor(
      ...parameterValues,
      recur,
      runtime.variables,
    );
  }

  const executor = new Function(
    ...parameterNames,
    "recur",
    "variables",
    `"use strict"; return (${fn.body});`,
  );

  return executor(
    ...parameterValues,
    recur,
    runtime.variables,
  );
}



function textEncoder(): TextEncoder {
  return new TextEncoder();
}

function bytesToHex(
  bytes:
    | ArrayBuffer
    | ArrayBufferLike
    | Uint8Array,
): string {
  const view =
    bytes instanceof Uint8Array
      ? bytes
      : new Uint8Array(bytes);

  return [...view]
    .map((value) =>
      value
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
}

function bytesToBase64(
  bytes: Uint8Array,
): string {
  let binary = "";

  for (const value of bytes) {
    binary += String.fromCharCode(
      value,
    );
  }

  return btoa(binary);
}

function base64ToBytes(
  value: string,
): Uint8Array {
  const binary = atob(value);

  return Uint8Array.from(
    binary,
    (character) =>
      character.charCodeAt(0),
  );
}

function base64Url(
  value: string,
): string {
  return bytesToBase64(
    textEncoder().encode(value),
  )
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function decodeBase64Url(
  value: string,
): string {
  const padded =
    value
      .replaceAll("-", "+")
      .replaceAll("_", "/") +
    "=".repeat(
      (4 - (value.length % 4)) %
        4,
    );

  return new TextDecoder().decode(
    base64ToBytes(padded),
  );
}

async function importAesKey(
  secret: string,
): Promise<CryptoKey> {
  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      textEncoder().encode(
        secret,
      ),
    );

  return crypto.subtle.importKey(
    "raw",
    digest,
    {
      name: "AES-GCM",
    },
    false,
    [
      "encrypt",
      "decrypt",
    ],
  );
}

async function hmacBytes(
  value: string,
  secret: string,
): Promise<Uint8Array> {
  const key =
    await crypto.subtle.importKey(
      "raw",
      textEncoder().encode(
        secret,
      ),
      {
        name: "HMAC",
        hash: "SHA-256",
      },
      false,
      [
        "sign",
        "verify",
      ],
    );

  return new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      textEncoder().encode(
        value,
      ),
    ),
  );
}

function isWebSocketValue(
  value: unknown,
): value is WebSocketValue {
  return Boolean(
    value &&
      typeof value === "object" &&
      (
        value as Record<
          string,
          unknown
        >
      ).__flowWebSocket === true,
  );
}

function connectWebSocket(
  url: string,
): Promise<WebSocketValue> {
  return new Promise(
    (resolve, reject) => {
      const socket =
        new WebSocket(url);

      const value: WebSocketValue = {
        __flowWebSocket: true,
        socket,
        queue: [],
        waiters: [],
        closed: false,
      };

      socket.addEventListener(
        "open",
        () => resolve(value),
        {
          once: true,
        },
      );

      socket.addEventListener(
        "error",
        () =>
          reject(
            new Error(
              `WebSocket接続に失敗しました: ${url}`,
            ),
          ),
        {
          once: true,
        },
      );

      socket.addEventListener(
        "message",
        (event) => {
          let message: unknown =
            event.data;

          if (
            typeof event.data ===
            "string"
          ) {
            try {
              message = JSON.parse(
                event.data,
              );
            } catch {
              message =
                event.data;
            }
          }

          const waiter =
            value.waiters.shift();

          if (waiter) {
            waiter.resolve(message);
          } else {
            value.queue.push(
              message,
            );
          }
        },
      );

      socket.addEventListener(
        "close",
        () => {
          value.closed = true;

          for (const waiter of
            value.waiters.splice(0)) {
            waiter.reject(
              new Error(
                "WebSocketが閉じられました。",
              ),
            );
          }
        },
      );
    },
  );
}

function receiveWebSocket(
  value: WebSocketValue,
): PromiseValue {
  if (
    value.queue.length > 0
  ) {
    return createPromiseValue(
      Promise.resolve(
        value.queue.shift(),
      ),
    );
  }

  if (value.closed) {
    return createPromiseValue(
      Promise.reject(
        new Error(
          "WebSocketは閉じられています。",
        ),
      ),
    );
  }

  let waiter:
    | WebSocketWaiter
    | undefined;

  const promise =
    new Promise<unknown>(
      (resolve, reject) => {
        waiter = {
          resolve,
          reject,
        };

        value.waiters.push(
          waiter,
        );
      },
    );

  return createPromiseValue(
    promise,
    () => {
      if (!waiter) {
        return;
      }

      const index =
        value.waiters.indexOf(
          waiter,
        );

      if (index >= 0) {
        value.waiters.splice(
          index,
          1,
        );
      }

      waiter.reject(
        new Error(
          "WebSocket受信をキャンセルしました。",
        ),
      );
    },
  );
}

function isStreamValue(
  value: unknown,
): value is StreamValue {
  return Boolean(
    value &&
      typeof value === "object" &&
      (
        value as Record<
          string,
          unknown
        >
      ).__flowStream === true,
  );
}

function createStream(
  values: unknown[],
  operations: StreamOperation[] = [],
  cursor = 0,
): StreamValue {
  return Object.freeze({
    __flowStream: true as const,
    values: Object.freeze(
      [...values],
    ) as unknown as unknown[],
    operations: Object.freeze(
      [...operations],
    ) as unknown as StreamOperation[],
    cursor: Math.max(
      0,
      Math.floor(cursor),
    ),
  });
}

async function collectStream(
  stream: StreamValue,
  runtime: RuntimeContext,
  limit: number,
): Promise<unknown[]> {
  const result:
    unknown[] = [];

  const maximum = Math.max(
    0,
    Math.min(
      Math.floor(limit),
      1_000_000,
    ),
  );

  for (
    let index = stream.cursor;
    index <
      stream.values.length &&
    result.length < maximum;
    index += 1
  ) {
    let value =
      stream.values[index];

    let accepted = true;

    for (const operation of
      stream.operations) {
      if (
        operation.kind ===
        "map"
      ) {
        value =
          await invokeFunctionValue(
            operation.function,
            [
              value,
              index,
            ],
            runtime,
          );
      } else {
        accepted = Boolean(
          await invokeFunctionValue(
            operation.function,
            [
              value,
              index,
            ],
            runtime,
          ),
        );

        if (!accepted) {
          break;
        }
      }
    }

    if (accepted) {
      result.push(value);
    }
  }

  return result;
}

function xmlElementToValue(
  element: Element,
): unknown {
  const object: Record<
    string,
    unknown
  > = {};

  if (
    element.attributes.length >
    0
  ) {
    object["@attributes"] =
      Object.fromEntries(
        [...element.attributes].map(
          (attribute) => [
            attribute.name,
            attribute.value,
          ],
        ),
      );
  }

  const children = [
    ...element.children,
  ];

  if (children.length === 0) {
    const text =
      element.textContent?.trim() ??
      "";

    if (
      Object.keys(object).length ===
      0
    ) {
      return text;
    }

    object["#text"] = text;
    return object;
  }

  for (const child of children) {
    const value =
      xmlElementToValue(child);

    const existing =
      object[child.tagName];

    if (existing === undefined) {
      object[child.tagName] =
        value;
    } else if (
      Array.isArray(existing)
    ) {
      existing.push(value);
    } else {
      object[child.tagName] = [
        existing,
        value,
      ];
    }
  }

  return object;
}

function safeSqlIdentifier(
  value: string,
): string {
  if (
    !/^[A-Za-z_][A-Za-z0-9_]*$/.test(
      value,
    )
  ) {
    throw new Error(
      `SQL識別子が不正です: ${value}`,
    );
  }

  return `"${value}"`;
}

function ormWhere(
  where: unknown,
): {
  sql: string;
  params: unknown[];
} {
  if (
    !where ||
    typeof where !== "object" ||
    Array.isArray(where)
  ) {
    return {
      sql: "",
      params: [],
    };
  }

  const entries =
    Object.entries(
      where as Record<
        string,
        unknown
      >,
    );

  if (entries.length === 0) {
    return {
      sql: "",
      params: [],
    };
  }

  return {
    sql:
      " WHERE " +
      entries
        .map(
          ([key]) =>
            `${safeSqlIdentifier(
              key,
            )} = ?`,
        )
        .join(" AND "),
    params: entries.map(
      ([, value]) => value,
    ),
  };
}

async function gpuVectorAdd(
  a: number[],
  b: number[],
): Promise<{
  result: number[];
  backend: string;
}> {
  const gpu = (
    navigator as Navigator & {
      gpu?: any;
    }
  ).gpu;

  if (
    !gpu ||
    a.length === 0 ||
    a.length !== b.length
  ) {
    return {
      result: a.map(
        (value, index) =>
          value +
          Number(b[index] ?? 0),
      ),
      backend: "cpu",
    };
  }

  try {
    const adapter =
      await gpu.requestAdapter();

    if (!adapter) {
      throw new Error(
        "WebGPU adapter unavailable",
      );
    }

    const device =
      await adapter.requestDevice();

    const dataA =
      new Float32Array(a);

    const dataB =
      new Float32Array(b);

    const byteLength =
      dataA.byteLength;

    const usage = (
      globalThis as any
    ).GPUBufferUsage;

    const bufferA =
      device.createBuffer({
        size: byteLength,
        usage:
          usage.STORAGE |
          usage.COPY_DST,
      });

    const bufferB =
      device.createBuffer({
        size: byteLength,
        usage:
          usage.STORAGE |
          usage.COPY_DST,
      });

    const output =
      device.createBuffer({
        size: byteLength,
        usage:
          usage.STORAGE |
          usage.COPY_SRC,
      });

    const read =
      device.createBuffer({
        size: byteLength,
        usage:
          usage.COPY_DST |
          usage.MAP_READ,
      });

    device.queue.writeBuffer(
      bufferA,
      0,
      dataA,
    );

    device.queue.writeBuffer(
      bufferB,
      0,
      dataB,
    );

    const module =
      device.createShaderModule({
        code: `
          @group(0) @binding(0)
          var<storage, read> a: array<f32>;
          @group(0) @binding(1)
          var<storage, read> b: array<f32>;
          @group(0) @binding(2)
          var<storage, read_write> output: array<f32>;

          @compute @workgroup_size(64)
          fn main(@builtin(global_invocation_id) id: vec3<u32>) {
            let index = id.x;
            if (index < arrayLength(&output)) {
              output[index] = a[index] + b[index];
            }
          }
        `,
      });

    const pipeline =
      device.createComputePipeline({
        layout: "auto",
        compute: {
          module,
          entryPoint: "main",
        },
      });

    const bindGroup =
      device.createBindGroup({
        layout:
          pipeline.getBindGroupLayout(
            0,
          ),
        entries: [
          {
            binding: 0,
            resource: {
              buffer: bufferA,
            },
          },
          {
            binding: 1,
            resource: {
              buffer: bufferB,
            },
          },
          {
            binding: 2,
            resource: {
              buffer: output,
            },
          },
        ],
      });

    const encoder =
      device.createCommandEncoder();

    const pass =
      encoder.beginComputePass();

    pass.setPipeline(pipeline);
    pass.setBindGroup(
      0,
      bindGroup,
    );

    pass.dispatchWorkgroups(
      Math.ceil(
        a.length / 64,
      ),
    );

    pass.end();

    encoder.copyBufferToBuffer(
      output,
      0,
      read,
      0,
      byteLength,
    );

    device.queue.submit([
      encoder.finish(),
    ]);

    await read.mapAsync(
      (
        globalThis as any
      ).GPUMapMode.READ,
    );

    const result = [
      ...new Float32Array(
        read.getMappedRange()
          .slice(0),
      ),
    ];

    read.unmap();

    return {
      result,
      backend: "webgpu",
    };
  } catch {
    return {
      result: a.map(
        (value, index) =>
          value +
          Number(b[index] ?? 0),
      ),
      backend: "cpu-fallback",
    };
  }
}

type GuiSpec = {
  id: string;
  kind:
    | "window"
    | "label"
    | "button"
    | "input"
    | "row"
    | "column";
  title?: string;
  text?: string;
  value?: string;
  width?: number;
  height?: number;
  children?: GuiSpec[];
};

function isGuiSpec(
  value: unknown,
): value is GuiSpec {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (
        value as Record<
          string,
          unknown
        >
      ).kind === "string",
  );
}

function createGuiElement(
  spec: GuiSpec,
): HTMLElement {
  switch (spec.kind) {
    case "label": {
      const element =
        document.createElement(
          "span",
        );

      element.textContent =
        spec.text ?? "";

      return element;
    }

    case "button": {
      const element =
        document.createElement(
          "button",
        );

      const text =
        spec.text ?? "Button";

      let count = 0;
      element.textContent = text;

      element.addEventListener(
        "click",
        () => {
          count += 1;
          element.textContent =
            `${text} (${count})`;
        },
      );

      return element;
    }

    case "input": {
      const element =
        document.createElement(
          "input",
        );

      element.type = "text";
      element.placeholder =
        spec.text ?? "";
      element.value =
        spec.value ?? "";

      return element;
    }

    case "row":
    case "column": {
      const element =
        document.createElement(
          "div",
        );

      element.style.display =
        "flex";
      element.style.gap =
        "8px";
      element.style.alignItems =
        "center";
      element.style.flexDirection =
        spec.kind === "row"
          ? "row"
          : "column";

      for (const child of
        spec.children ?? []) {
        element.appendChild(
          createGuiElement(
            child,
          ),
        );
      }

      return element;
    }

    default: {
      const element =
        document.createElement(
          "div",
        );

      return element;
    }
  }
}

function showGuiWindow(
  spec: GuiSpec,
): string {
  if (spec.kind !== "window") {
    throw new Error(
      "Show GUIにはWindow仕様が必要です。",
    );
  }

  const id =
    crypto.randomUUID();

  const section =
    document.createElement(
      "section",
    );

  section.className =
    "plugin-window";

  section.dataset
    .pluginWindowId = id;

  section.style.width =
    `${Math.max(
      240,
      Number(
        spec.width ?? 480,
      ),
    )}px`;

  section.style.minHeight =
    `${Math.max(
      120,
      Number(
        spec.height ?? 240,
      ),
    )}px`;

  const header =
    document.createElement(
      "header",
    );

  const title =
    document.createElement(
      "span",
    );

  title.textContent =
    spec.title ??
    "Flow GUI";

  const close =
    document.createElement(
      "button",
    );

  close.textContent = "×";

  close.addEventListener(
    "click",
    () =>
      section.remove(),
  );

  header.append(
    title,
    close,
  );

  const body =
    document.createElement(
      "div",
    );

  body.className =
    "plugin-window__body";

  for (const child of
    spec.children ?? []) {
    body.appendChild(
      createGuiElement(
        child,
      ),
    );
  }

  section.append(
    header,
    body,
  );

  document.body.appendChild(
    section,
  );

  return id;
}

function isPromiseValue(
  value: unknown,
): value is PromiseValue {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as Record<string, unknown>).__flowPromise === true,
  );
}

function createPromiseValue(
  promise: Promise<unknown>,
  cancel?: () => void,
): PromiseValue {
  const value: PromiseValue = {
    __flowPromise: true,
    id: crypto.randomUUID(),
    promise: Promise.resolve(),
    status: "pending",
    cancel,
  };

  value.promise = Promise.resolve(promise).then(
    (result) => {
      if (value.status === "cancelled") {
        throw new Error("Task was cancelled.");
      }

      value.status = "fulfilled";
      value.value = result;
      return result;
    },
    (error) => {
      if (value.status !== "cancelled") {
        value.status = "rejected";
        value.error = error;
      }

      throw error;
    },
  );

  // Prevent browser-level unhandled rejection warnings until Await consumes it.
  value.promise.catch(() => undefined);

  return value;
}

async function awaitFlowValue(
  value: unknown,
): Promise<unknown> {
  if (isPromiseValue(value)) {
    if (value.status === "cancelled") {
      throw new Error("Task was cancelled.");
    }

    return value.promise;
  }

  if (value instanceof Promise) {
    return value;
  }

  return value;
}

function cancelPromiseValue(
  value: PromiseValue,
): boolean {
  if (value.status !== "pending") {
    return false;
  }

  value.status = "cancelled";

  try {
    value.cancel?.();
  } catch {
    // Cancellation hooks are best effort.
  }

  return true;
}

function delayPromiseValue(
  milliseconds: number,
  result: unknown,
): PromiseValue {
  const safeDelay = Math.max(
    0,
    Math.min(
      Number(milliseconds) || 0,
      2_147_483_647,
    ),
  );

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let rejectDelay: ((error: unknown) => void) | undefined;

  const promise = new Promise<unknown>(
    (resolve, reject) => {
      rejectDelay = reject;
      timeoutId = setTimeout(
        () => resolve(result),
        safeDelay,
      );
    },
  );

  return createPromiseValue(
    promise,
    () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }

      rejectDelay?.(
        new Error("Delay was cancelled."),
      );
    },
  );
}

async function parallelMapWithLimit(
  values: unknown[],
  concurrency: number,
  mapper: (
    value: unknown,
    index: number,
  ) => Promise<unknown>,
): Promise<unknown[]> {
  const safeConcurrency = Math.max(
    1,
    Math.min(
      Math.floor(concurrency || 1),
      1024,
    ),
  );

  const result = new Array<unknown>(
    values.length,
  );

  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;

      if (index >= values.length) {
        return;
      }

      result[index] = await mapper(
        values[index],
        index,
      );
    }
  };

  await Promise.all(
    Array.from(
      {
        length: Math.min(
          safeConcurrency,
          Math.max(
            1,
            values.length,
          ),
        ),
      },
      () => worker(),
    ),
  );

  return result;
}

function isCoroutineValue(
  value: unknown,
): value is CoroutineValue {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as Record<string, unknown>).__flowCoroutine === true,
  );
}

function createCoroutineValue(
  fn: FunctionValue,
  state: unknown,
  index = 0,
  done = false,
): CoroutineValue {
  return Object.freeze({
    __flowCoroutine: true as const,
    function: fn,
    index: Math.max(
      0,
      Math.floor(index),
    ),
    state,
    done,
  });
}

async function resumeCoroutine(
  coroutine: CoroutineValue,
  input: unknown,
  runtime: RuntimeContext,
): Promise<{
  value: unknown;
  next: CoroutineValue;
  done: boolean;
}> {
  if (coroutine.done) {
    return {
      value: undefined,
      next: coroutine,
      done: true,
    };
  }

  const raw = await invokeFunctionValue(
    coroutine.function,
    [
      coroutine.index,
      input,
      coroutine.state,
    ],
    runtime,
  );

  let value = raw;
  let state = coroutine.state;
  let done = false;

  if (
    raw &&
    typeof raw === "object" &&
    !Array.isArray(raw)
  ) {
    const object = raw as Record<
      string,
      unknown
    >;

    if (
      Object.prototype.hasOwnProperty.call(
        object,
        "value",
      )
    ) {
      value = object.value;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        object,
        "state",
      )
    ) {
      state = object.state;
    }

    done = Boolean(
      object.done,
    );
  }

  return {
    value,
    next: createCoroutineValue(
      coroutine.function,
      state,
      coroutine.index + 1,
      done,
    ),
    done,
  };
}

function isChannelValue(
  value: unknown,
): value is ChannelValue {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as Record<string, unknown>).__flowChannel === true,
  );
}

function createChannelValue(
  capacity: number,
): ChannelValue {
  return {
    __flowChannel: true,
    id: crypto.randomUUID(),
    capacity: Math.max(
      0,
      Math.floor(
        Number(capacity) || 0,
      ),
    ),
    queue: [],
    waiters: [],
    closed: false,
  };
}

function sendChannelValue(
  channel: ChannelValue,
  value: unknown,
): boolean {
  if (channel.closed) {
    throw new Error(
      "Closed channel cannot receive new values.",
    );
  }

  const waiter = channel.waiters.shift();

  if (waiter) {
    waiter.resolve(value);
    return true;
  }

  if (
    channel.capacity > 0 &&
    channel.queue.length >= channel.capacity
  ) {
    throw new Error(
      `Channel capacity ${channel.capacity} was exceeded.`,
    );
  }

  channel.queue.push(value);
  return true;
}

function receiveChannelValue(
  channel: ChannelValue,
): PromiseValue {
  if (channel.queue.length > 0) {
    return createPromiseValue(
      Promise.resolve(
        channel.queue.shift(),
      ),
    );
  }

  if (channel.closed) {
    return createPromiseValue(
      Promise.reject(
        new Error(
          "Channel is closed.",
        ),
      ),
    );
  }

  let waiter:
    | ChannelWaiter
    | undefined;

  const promise =
    new Promise<unknown>(
      (resolve, reject) => {
        waiter = {
          resolve,
          reject,
        };

        channel.waiters.push(
          waiter,
        );
      },
    );

  return createPromiseValue(
    promise,
    () => {
      if (!waiter) {
        return;
      }

      const index =
        channel.waiters.indexOf(
          waiter,
        );

      if (index >= 0) {
        channel.waiters.splice(
          index,
          1,
        );
      }

      waiter.reject(
        new Error(
          "Channel receive was cancelled.",
        ),
      );
    },
  );
}

function closeChannelValue(
  channel: ChannelValue,
): boolean {
  if (channel.closed) {
    return false;
  }

  channel.closed = true;

  for (const waiter of channel.waiters.splice(0)) {
    waiter.reject(
      new Error(
        "Channel was closed.",
      ),
    );
  }

  return true;
}

function isIteratorValue(
  value: unknown,
): value is IteratorValue {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as Record<string, unknown>).__flowIterator === true,
  );
}

function freezeIterator(
  source: IteratorSource,
  operations: IteratorOperation[] = [],
  cursor = 0,
): IteratorValue {
  return Object.freeze({
    __flowIterator: true as const,
    source,
    operations: Object.freeze([...operations]) as unknown as IteratorOperation[],
    cursor: Math.max(0, Math.floor(cursor)),
  });
}

function someOption(
  value: unknown,
): Record<string, unknown> {
  return Object.freeze({
    __flowOption: true,
    some: true,
    value,
  });
}

function noneOption(): Record<string, unknown> {
  return Object.freeze({
    __flowOption: true,
    some: false,
  });
}

async function rawIteratorValueAt(
  iterator: IteratorValue,
  index: number,
  runtime: RuntimeContext,
): Promise<
  | {
      exists: true;
      value: unknown;
    }
  | {
      exists: false;
    }
> {
  const source = iterator.source;

  switch (source.kind) {
    case "array":
      return index < source.values.length
        ? {
            exists: true,
            value: source.values[index],
          }
        : { exists: false };

    case "range": {
      if (source.step === 0) {
        throw new Error("Range IteratorのStepは0にできません。");
      }

      const value = source.start + index * source.step;
      const inside =
        source.step > 0
          ? value < source.end
          : value > source.end;

      return inside
        ? {
            exists: true,
            value,
          }
        : { exists: false };
    }

    case "generator":
      return {
        exists: true,
        value: await invokeFunctionValue(
          source.function,
          [source.startIndex + index],
          runtime,
        ),
      };

    case "zip": {
      const first = await iteratorNext(source.first, runtime);
      const second = await iteratorNext(source.second, runtime);

      if (!first.hasValue || !second.hasValue) {
        return { exists: false };
      }

      let firstRest = first.rest;
      let secondRest = second.rest;

      for (let current = 0; current < index; current += 1) {
        const a = await iteratorNext(firstRest, runtime);
        const b = await iteratorNext(secondRest, runtime);

        if (!a.hasValue || !b.hasValue) {
          return { exists: false };
        }

        firstRest = a.rest;
        secondRest = b.rest;

        if (current === index - 1) {
          return {
            exists: true,
            value: [a.value, b.value],
          };
        }
      }

      return {
        exists: true,
        value: [first.value, second.value],
      };
    }
  }
}

async function iteratorNext(
  iterator: IteratorValue,
  runtime: RuntimeContext,
): Promise<{
  hasValue: boolean;
  value?: unknown;
  rest: IteratorValue;
}> {
  let sourceIndex = iterator.cursor;
  let operations = iterator.operations.map((operation) => ({
    ...operation,
  })) as IteratorOperation[];

  while (true) {
    const exhaustedTake = operations.some(
      (operation) =>
        operation.kind === "take" &&
        operation.count <= 0,
    );

    if (exhaustedTake) {
      return {
        hasValue: false,
        rest: freezeIterator(
          iterator.source,
          operations,
          sourceIndex,
        ),
      };
    }

    const raw = await rawIteratorValueAt(
      iterator,
      sourceIndex,
      runtime,
    );

    if (!raw.exists) {
      return {
        hasValue: false,
        rest: freezeIterator(
          iterator.source,
          operations,
          sourceIndex,
        ),
      };
    }

    const currentSourceIndex = sourceIndex;
    sourceIndex += 1;

    let value = raw.value;
    let accepted = true;

    for (
      let operationIndex = 0;
      operationIndex < operations.length;
      operationIndex += 1
    ) {
      const operation = operations[operationIndex];

      if (operation.kind === "map") {
        value = await invokeFunctionValue(
          operation.function,
          [
            value,
            currentSourceIndex,
          ],
          runtime,
        );
        continue;
      }

      if (operation.kind === "filter") {
        accepted = Boolean(
          await invokeFunctionValue(
            operation.function,
            [
              value,
              currentSourceIndex,
            ],
            runtime,
          ),
        );

        if (!accepted) {
          break;
        }

        continue;
      }

      if (operation.kind === "skip") {
        if (operation.count > 0) {
          operations[operationIndex] = {
            ...operation,
            count:
              operation.count - 1,
          };
          accepted = false;
          break;
        }

        continue;
      }

      if (operation.kind === "take") {
        if (operation.count <= 0) {
          return {
            hasValue: false,
            rest: freezeIterator(
              iterator.source,
              operations,
              sourceIndex,
            ),
          };
        }

        operations[operationIndex] = {
          ...operation,
          count:
            operation.count - 1,
        };
        continue;
      }

      value = Object.freeze({
        index: operation.index,
        value,
      });

      operations[operationIndex] = {
        ...operation,
        index:
          operation.index + 1,
      };
    }

    if (!accepted) {
      continue;
    }

    return {
      hasValue: true,
      value,
      rest: freezeIterator(
        iterator.source,
        operations,
        sourceIndex,
      ),
    };
  }
}

async function collectIterator(
  iterator: IteratorValue,
  runtime: RuntimeContext,
  limit: number,
): Promise<unknown[]> {
  const safeLimit = Math.max(
    0,
    Math.min(
      Math.floor(limit),
      1_000_000,
    ),
  );

  const result: unknown[] = [];
  let current = iterator;

  for (let index = 0; index < safeLimit; index += 1) {
    const next = await iteratorNext(current, runtime);

    if (!next.hasValue) {
      break;
    }

    result.push(next.value);
    current = next.rest;
  }

  return result;
}

function requireFunctionValue(
  value: unknown,
  label: string,
): FunctionValue {
  if (!isFunctionValue(value)) {
    throw new Error(`${label}にはFlow関数が必要です。`);
  }

  return value;
}

function requireIteratorValue(
  value: unknown,
  label: string,
): IteratorValue {
  if (!isIteratorValue(value)) {
    throw new Error(`${label}にはIteratorまたはGeneratorが必要です。`);
  }

  return value;
}

function validateSchema(
  schema: Record<string, unknown>,
  values: Record<string, unknown>,
): void {
  for (const [key, expected] of Object.entries(schema)) {
    const actual = inferType(values[key]);

    if (String(expected) !== "any" && actual !== String(expected)) {
      throw new Error(
        `構造体フィールド ${key} は ${String(expected)} が必要ですが ${actual} です。`,
      );
    }
  }
}

async function executeBuiltin(
  node: EditorNode,
  inputs: Record<
    string,
    unknown
  >,
  runtime: RuntimeContext,
  onLog: (
    message: string,
  ) => void,
): Promise<NodeRunResult | null> {
  const type =
    node.data.languageType;

  const success = (
    outputs: Record<
      string,
      unknown
    > = {},
  ): NodeRunResult => ({
    outputs,
    signal: "none",
  });

  switch (type) {
    case "core.number":
    case "core.string":
    case "core.boolean":
    case "core.array":
    case "core.object":
      return success({
        value: structuredClone(
          node.data.value,
        ),
      });

    case "core.comment":
      return success();

    case "core.input_number": {
      const raw = window.prompt(
        String(
          node.data.prompt ??
            "数値を入力してください",
        ),
        String(
          node.data.defaultValue ??
            0,
        ),
      );

      if (raw === null) {
        throw new Error(
          "入力をキャンセルしました。",
        );
      }

      const value = Number(raw);

      if (!Number.isFinite(value)) {
        throw new Error(
          "数値ではありません。",
        );
      }

      return success({ value });
    }

    case "core.input_string": {
      const value = window.prompt(
        String(
          node.data.prompt ??
            "文字を入力してください",
        ),
        String(
          node.data.defaultValue ??
            "",
        ),
      );

      if (value === null) {
        throw new Error(
          "入力をキャンセルしました。",
        );
      }

      return success({ value });
    }

    case "math.add":
      return success({
        result:
          Number(inputs.a) +
          Number(inputs.b),
      });

    case "math.subtract":
      return success({
        result:
          Number(inputs.a) -
          Number(inputs.b),
      });

    case "math.multiply":
      return success({
        result:
          Number(inputs.a) *
          Number(inputs.b),
      });

    case "math.divide": {
      const divisor =
        Number(inputs.b);

      if (divisor === 0) {
        throw new Error(
          "0で割ることはできません。",
        );
      }

      return success({
        result:
          Number(inputs.a) /
          divisor,
      });
    }

    case "math.modulo": {
      const divisor =
        Number(inputs.b);

      if (divisor === 0) {
        throw new Error(
          "0で剰余を計算できません。",
        );
      }

      return success({
        result:
          Number(inputs.a) %
          divisor,
      });
    }

    case "math.power":
      return success({
        result: Math.pow(
          Number(inputs.a),
          Number(inputs.b),
        ),
      });

    case "compare.equal":
      return success({
        result:
          inputs.a === inputs.b,
      });

    case "compare.not_equal":
      return success({
        result:
          inputs.a !== inputs.b,
      });

    case "compare.greater":
      return success({
        result:
          Number(inputs.a) >
          Number(inputs.b),
      });

    case "compare.less":
      return success({
        result:
          Number(inputs.a) <
          Number(inputs.b),
      });

    case "compare.greater_equal":
      return success({
        result:
          Number(inputs.a) >=
          Number(inputs.b),
      });

    case "compare.less_equal":
      return success({
        result:
          Number(inputs.a) <=
          Number(inputs.b),
      });

    case "compare.between": {
      const value =
        Number(inputs.value);

      return success({
        result:
          value >=
            Number(inputs.min) &&
          value <=
            Number(inputs.max),
      });
    }

    case "compare.is_null":
      return success({
        result:
          inputs.value === null ||
          inputs.value ===
            undefined,
      });

    case "compare.type_is":
      return success({
        result:
          runtimeType(
            inputs.value,
          ) ===
          String(inputs.type),
      });

    case "logic.and":
      return success({
        result:
          Boolean(inputs.a) &&
          Boolean(inputs.b),
      });

    case "logic.or":
      return success({
        result:
          Boolean(inputs.a) ||
          Boolean(inputs.b),
      });

    case "logic.xor":
      return success({
        result:
          Boolean(inputs.a) !==
          Boolean(inputs.b),
      });

    case "logic.not":
      return success({
        result:
          !Boolean(inputs.value),
      });

    case "logic.if":
      return success({
        result: Boolean(
          inputs.condition,
        )
          ? inputs.whenTrue
          : inputs.whenFalse,
      });

    case "logic.switch": {
      const cases =
        (inputs.cases ??
          {}) as Record<
          string,
          unknown
        >;

      const key = String(
        inputs.key,
      );

      return success({
        result:
          Object.prototype
            .hasOwnProperty.call(
              cases,
              key,
            )
            ? cases[key]
            : inputs.default,
      });
    }

    case "variable.set": {
      const name = String(
        inputs.name,
      );

      runtime.variables.set(
        name,
        inputs.value,
      );

      return success({
        value: inputs.value,
      });
    }

    case "variable.get": {
      const name = String(
        inputs.name,
      );

      if (
        !runtime.variables.has(
          name,
        )
      ) {
        throw new Error(
          `変数が存在しません: ${name}`,
        );
      }

      return success({
        value:
          runtime.variables.get(
            name,
          ),
      });
    }

    case "variable.exists":
      return success({
        result:
          runtime.variables.has(
            String(inputs.name),
          ),
      });

    case "variable.delete":
      return success({
        success:
          runtime.variables.delete(
            String(inputs.name),
          ),
      });

    case "loop.break_if":
      return {
        outputs: {},
        signal: Boolean(
          inputs.condition,
        )
          ? "break"
          : "none",
      };

    case "loop.continue_if":
      return {
        outputs: {},
        signal: Boolean(
          inputs.condition,
        )
          ? "continue"
          : "none",
      };

    case "error.throw":
      throw new Error(
        String(inputs.message),
      );

    case "error.message": {
      const name = String(
        inputs.name,
      );

      return success({
        message: String(
          runtime.variables.get(
            name,
          ) ?? "",
        ),
      });
    }


    case "function.define": {
      const fn = makeFunction(node, false);
      runtime.functions.set(fn.name, fn);
      return success({ function: fn });
    }

    case "function.subroutine": {
      const fn = makeFunction(node, true);
      runtime.functions.set(fn.name, fn);
      return success({ function: fn });
    }

    case "function.lambda":
      return success({ function: makeFunction(node, false) });

    case "function.call": {
      const fn = inputs.function;
      if (!isFunctionValue(fn)) {
        throw new Error("Function入力はFlow関数ではありません。");
      }

      return success({
        result: await invokeFunctionValue(
          fn,
          Array.isArray(inputs.args) ? inputs.args : [],
          runtime,
        ),
      });
    }

    case "function.call_named": {
      const name = String(inputs.name);
      const fn = runtime.functions.get(name);

      if (!fn) {
        throw new Error(`関数が登録されていません: ${name}`);
      }

      return success({
        result: await invokeFunctionValue(
          fn,
          Array.isArray(inputs.args) ? inputs.args : [],
          runtime,
        ),
      });
    }

    case "type.infer":
      return success({ type: inferType(inputs.value) });

    case "type.assert": {
      const expected = String(inputs.type);
      const actual = inferType(inputs.value);

      if (expected !== "any" && expected !== actual) {
        throw new Error(`型エラー: ${expected} が必要ですが ${actual} です。`);
      }

      return success({ value: inputs.value });
    }

    case "generic.identity":
      return success({ value: structuredClone(inputs.value) });

    case "generic.pair":
      return success({
        pair: Object.freeze({
          first: structuredClone(inputs.first),
          second: structuredClone(inputs.second),
        }),
      });

    case "option.some":
      return success({
        option: Object.freeze({
          __flowOption: true,
          some: true,
          value: structuredClone(inputs.value),
        }),
      });

    case "option.none":
      return success({
        option: Object.freeze({
          __flowOption: true,
          some: false,
        }),
      });

    case "option.is_some":
      return success({
        result: Boolean(
          inputs.option &&
            typeof inputs.option === "object" &&
            (inputs.option as Record<string, unknown>).some === true,
        ),
      });

    case "option.unwrap_or": {
      const option = inputs.option as Record<string, unknown> | undefined;
      return success({
        value: option?.some === true ? option.value : inputs.default,
      });
    }

    case "union.create":
      return success({
        union: Object.freeze({
          __flowUnion: true,
          tag: String(inputs.tag),
          value: structuredClone(inputs.value),
        }),
      });

    case "union.match": {
      const union = inputs.union as Record<string, unknown> | undefined;
      if (!union || union.__flowUnion !== true) {
        throw new Error("Union入力が不正です。");
      }

      const cases = (inputs.cases ?? {}) as Record<string, unknown>;
      const selected = Object.prototype.hasOwnProperty.call(cases, String(union.tag))
        ? cases[String(union.tag)]
        : inputs.default;

      if (isFunctionValue(selected)) {
        return success({
          result: await invokeFunctionValue(selected, [union.value], runtime),
        });
      }

      return success({ result: selected });
    }

    case "struct.create": {
      const schema = (inputs.schema ?? {}) as Record<string, unknown>;
      const values = (inputs.values ?? {}) as Record<string, unknown>;
      validateSchema(schema, values);

      return success({
        struct: Object.freeze({
          __flowStruct: true,
          name: String(inputs.name),
          schema: structuredClone(schema),
          fields: Object.freeze(structuredClone(values)),
        }),
      });
    }

    case "struct.get": {
      const value = inputs.struct as Record<string, unknown> | undefined;
      const fields = value?.fields as Record<string, unknown> | undefined;
      return success({ value: fields?.[String(inputs.key)] });
    }

    case "class.create":
      return success({
        instance: Object.freeze({
          __flowClass: true,
          className: String(inputs.name),
          fields: Object.freeze(
            structuredClone((inputs.fields ?? {}) as Record<string, unknown>),
          ),
          methods: Object.freeze(
            structuredClone((inputs.methods ?? {}) as Record<string, unknown>),
          ),
        }),
      });

    case "class.get": {
      const instance = inputs.instance as Record<string, unknown> | undefined;
      const fields = instance?.fields as Record<string, unknown> | undefined;
      return success({ value: fields?.[String(inputs.key)] });
    }

    case "class.with_field": {
      const instance = inputs.instance as Record<string, unknown> | undefined;
      if (!instance || instance.__flowClass !== true) {
        throw new Error("Class Instance入力が不正です。");
      }

      const fields = (instance.fields ?? {}) as Record<string, unknown>;
      return success({
        instance: Object.freeze({
          ...instance,
          fields: Object.freeze({
            ...structuredClone(fields),
            [String(inputs.key)]: structuredClone(inputs.value),
          }),
        }),
      });
    }

    case "class.call_method": {
      const instance = inputs.instance as Record<string, unknown> | undefined;
      const methods = instance?.methods as Record<string, unknown> | undefined;
      const body = methods?.[String(inputs.method)];

      if (typeof body !== "string") {
        throw new Error(`メソッドがありません: ${String(inputs.method)}`);
      }

      const executor = new Function(
        "self",
        "args",
        "variables",
        `"use strict"; ${body}`,
      );

      return success({
        result: await executor(
          instance,
          Array.isArray(inputs.args) ? inputs.args : [],
          runtime.variables,
        ),
      });
    }

    case "file.read_text":
      return success({
        content:
          await readTextFile(
            String(inputs.path),
          ),
      });

    case "file.write_text":
      await writeTextFile(
        String(inputs.path),
        String(
          inputs.content ?? "",
        ),
      );

      return success({
        success: true,
      });

    case "file.exists":
      return success({
        exists: await exists(
          String(inputs.path),
        ),
      });


    case "functional.map": {
      const array = Array.isArray(inputs.array) ? inputs.array : [];
      const fn = requireFunctionValue(inputs.function, "Function");
      const result: unknown[] = [];

      for (let index = 0; index < array.length; index += 1) {
        result.push(
          await invokeFunctionValue(
            fn,
            [array[index], index, array],
            runtime,
          ),
        );
      }

      return success({ result });
    }

    case "functional.filter": {
      const array = Array.isArray(inputs.array) ? inputs.array : [];
      const predicate = requireFunctionValue(inputs.predicate, "Predicate");
      const result: unknown[] = [];

      for (let index = 0; index < array.length; index += 1) {
        if (
          Boolean(
            await invokeFunctionValue(
              predicate,
              [array[index], index, array],
              runtime,
            ),
          )
        ) {
          result.push(array[index]);
        }
      }

      return success({ result });
    }

    case "functional.reduce": {
      const array = Array.isArray(inputs.array) ? inputs.array : [];
      const fn = requireFunctionValue(inputs.function, "Function");
      let accumulator = inputs.initial;

      for (let index = 0; index < array.length; index += 1) {
        accumulator = await invokeFunctionValue(
          fn,
          [accumulator, array[index], index, array],
          runtime,
        );
      }

      return success({ result: accumulator });
    }

    case "functional.flat_map": {
      const array = Array.isArray(inputs.array) ? inputs.array : [];
      const fn = requireFunctionValue(inputs.function, "Function");
      const result: unknown[] = [];

      for (let index = 0; index < array.length; index += 1) {
        const mapped = await invokeFunctionValue(
          fn,
          [array[index], index, array],
          runtime,
        );

        if (Array.isArray(mapped)) {
          result.push(...mapped);
        } else {
          result.push(mapped);
        }
      }

      return success({ result });
    }

    case "functional.find": {
      const array = Array.isArray(inputs.array) ? inputs.array : [];
      const predicate = requireFunctionValue(inputs.predicate, "Predicate");

      for (let index = 0; index < array.length; index += 1) {
        if (
          Boolean(
            await invokeFunctionValue(
              predicate,
              [array[index], index, array],
              runtime,
            ),
          )
        ) {
          return success({
            option: someOption(array[index]),
          });
        }
      }

      return success({
        option: noneOption(),
      });
    }

    case "functional.some": {
      const array = Array.isArray(inputs.array) ? inputs.array : [];
      const predicate = requireFunctionValue(inputs.predicate, "Predicate");

      for (let index = 0; index < array.length; index += 1) {
        if (
          Boolean(
            await invokeFunctionValue(
              predicate,
              [array[index], index, array],
              runtime,
            ),
          )
        ) {
          return success({ result: true });
        }
      }

      return success({ result: false });
    }

    case "functional.every": {
      const array = Array.isArray(inputs.array) ? inputs.array : [];
      const predicate = requireFunctionValue(inputs.predicate, "Predicate");

      for (let index = 0; index < array.length; index += 1) {
        if (
          !Boolean(
            await invokeFunctionValue(
              predicate,
              [array[index], index, array],
              runtime,
            ),
          )
        ) {
          return success({ result: false });
        }
      }

      return success({ result: true });
    }

    case "iterator.from_array":
      return success({
        iterator: freezeIterator({
          kind: "array",
          values: Array.isArray(inputs.array)
            ? structuredClone(inputs.array)
            : [],
        }),
      });

    case "iterator.range": {
      const step =
        inputs.step === undefined
          ? 1
          : Number(inputs.step);

      if (step === 0) {
        throw new Error("Range IteratorのStepは0にできません。");
      }

      return success({
        iterator: freezeIterator({
          kind: "range",
          start: Number(inputs.start),
          end: Number(inputs.end),
          step,
        }),
      });
    }

    case "iterator.map": {
      const iterator = requireIteratorValue(inputs.iterator, "Iterator");
      const fn = requireFunctionValue(inputs.function, "Function");

      return success({
        iterator: freezeIterator(
          iterator.source,
          [
            ...iterator.operations,
            {
              kind: "map",
              function: fn,
            },
          ],
          iterator.cursor,
        ),
      });
    }

    case "iterator.filter": {
      const iterator = requireIteratorValue(inputs.iterator, "Iterator");
      const fn = requireFunctionValue(inputs.predicate, "Predicate");

      return success({
        iterator: freezeIterator(
          iterator.source,
          [
            ...iterator.operations,
            {
              kind: "filter",
              function: fn,
            },
          ],
          iterator.cursor,
        ),
      });
    }

    case "iterator.take": {
      const iterator = requireIteratorValue(inputs.iterator, "Iterator");

      return success({
        iterator: freezeIterator(
          iterator.source,
          [
            ...iterator.operations,
            {
              kind: "take",
              count: Math.max(0, Math.floor(Number(inputs.count))),
            },
          ],
          iterator.cursor,
        ),
      });
    }

    case "iterator.skip": {
      const iterator = requireIteratorValue(inputs.iterator, "Iterator");

      return success({
        iterator: freezeIterator(
          iterator.source,
          [
            ...iterator.operations,
            {
              kind: "skip",
              count: Math.max(0, Math.floor(Number(inputs.count))),
            },
          ],
          iterator.cursor,
        ),
      });
    }

    case "iterator.next": {
      const iterator = requireIteratorValue(inputs.iterator, "Iterator");
      const next = await iteratorNext(iterator, runtime);

      return success({
        option: next.hasValue
          ? someOption(next.value)
          : noneOption(),
        rest: next.rest,
      });
    }

    case "iterator.collect": {
      const iterator = requireIteratorValue(inputs.iterator, "Iterator");
      const limit =
        inputs.limit === undefined
          ? Number(node.data.iteratorLimit ?? 10000)
          : Number(inputs.limit);

      return success({
        array: await collectIterator(
          iterator,
          runtime,
          limit,
        ),
      });
    }

    case "iterator.enumerate": {
      const iterator = requireIteratorValue(inputs.iterator, "Iterator");

      return success({
        iterator: freezeIterator(
          iterator.source,
          [
            ...iterator.operations,
            {
              kind: "enumerate",
              index: 0,
            },
          ],
          iterator.cursor,
        ),
      });
    }

    case "iterator.zip": {
      const first = requireIteratorValue(inputs.first, "First");
      const second = requireIteratorValue(inputs.second, "Second");

      return success({
        iterator: freezeIterator({
          kind: "zip",
          first,
          second,
        }),
      });
    }

    case "generator.create": {
      const fn = requireFunctionValue(inputs.function, "Function");
      const startIndex =
        inputs.startIndex === undefined
          ? Number(node.data.generatorStartIndex ?? 0)
          : Number(inputs.startIndex);

      return success({
        generator: freezeIterator({
          kind: "generator",
          function: fn,
          startIndex: Math.floor(startIndex),
        }),
      });
    }

    case "generator.next": {
      const generator = requireIteratorValue(inputs.generator, "Generator");
      const next = await iteratorNext(generator, runtime);

      return success({
        value: next.hasValue
          ? someOption(next.value)
          : noneOption(),
        next: next.rest,
      });
    }

    case "generator.collect": {
      const generator = requireIteratorValue(inputs.generator, "Generator");

      return success({
        array: await collectIterator(
          generator,
          runtime,
          Number(inputs.limit),
        ),
      });
    }


    case "async.delay":
      return success({
        promise: delayPromiseValue(
          Number(inputs.milliseconds),
          inputs.value,
        ),
      });

    case "async.task_from_function": {
      const fn = requireFunctionValue(
        inputs.function,
        "Function",
      );

      const args = Array.isArray(
        inputs.args,
      )
        ? inputs.args
        : [];

      return success({
        promise: createPromiseValue(
          invokeFunctionValue(
            fn,
            args,
            runtime,
          ),
        ),
      });
    }

    case "async.await":
      return success({
        value: await awaitFlowValue(
          inputs.promise,
        ),
      });

    case "async.promise_all": {
      const promises = Array.isArray(
        inputs.promises,
      )
        ? inputs.promises
        : [];

      return success({
        promise: createPromiseValue(
          Promise.all(
            promises.map(
              awaitFlowValue,
            ),
          ),
        ),
      });
    }

    case "async.promise_race": {
      const promises = Array.isArray(
        inputs.promises,
      )
        ? inputs.promises
        : [];

      if (promises.length === 0) {
        throw new Error(
          "Promise Race requires at least one promise.",
        );
      }

      return success({
        promise: createPromiseValue(
          Promise.race(
            promises.map(
              (value) =>
                Promise.resolve(
                  awaitFlowValue(
                    value,
                  ),
                ),
            ),
          ),
        ),
      });
    }

    case "async.timeout": {
      const milliseconds =
        inputs.milliseconds === undefined
          ? Number(
              node.data.timeoutMs ??
                5000,
            )
          : Number(
              inputs.milliseconds,
            );

      const source =
        Promise.resolve(
          awaitFlowValue(
            inputs.promise,
          ),
        );

      const timeout =
        delayPromiseValue(
          milliseconds,
          undefined,
        );

      const timeoutFailure =
        timeout.promise.then(
          () => {
            throw new Error(
              `Promise timed out after ${milliseconds} ms.`,
            );
          },
        );

      return success({
        promise: createPromiseValue(
          Promise.race([
            source,
            timeoutFailure,
          ]).finally(
            () => {
              cancelPromiseValue(
                timeout,
              );
            },
          ),
        ),
      });
    }

    case "async.retry": {
      const fn = requireFunctionValue(
        inputs.function,
        "Function",
      );

      const args = Array.isArray(
        inputs.args,
      )
        ? inputs.args
        : [];

      const retries = Math.max(
        0,
        Math.floor(
          inputs.retries === undefined
            ? Number(
                node.data.retryCount ??
                  3,
              )
            : Number(
                inputs.retries,
              ),
        ),
      );

      const delayMs = Math.max(
        0,
        inputs.delayMs === undefined
          ? Number(
              node.data.retryDelayMs ??
                250,
            )
          : Number(
              inputs.delayMs,
            ),
      );

      const task =
        (async () => {
          let lastError:
            | unknown
            | undefined;

          for (
            let attempt = 0;
            attempt <= retries;
            attempt += 1
          ) {
            try {
              return await invokeFunctionValue(
                fn,
                [
                  ...args,
                  attempt,
                ],
                runtime,
              );
            } catch (error) {
              lastError = error;

              if (
                attempt < retries &&
                delayMs > 0
              ) {
                await new Promise<void>(
                  (resolve) =>
                    setTimeout(
                      resolve,
                      delayMs,
                    ),
                );
              }
            }
          }

          throw lastError;
        })();

      return success({
        promise:
          createPromiseValue(
            task,
          ),
      });
    }

    case "async.status": {
      const promise =
        inputs.promise;

      return success({
        status:
          isPromiseValue(
            promise,
          )
            ? promise.status
            : "fulfilled",
      });
    }

    case "async.cancel":
      return success({
        cancelled:
          isPromiseValue(
            inputs.promise,
          )
            ? cancelPromiseValue(
                inputs.promise,
              )
            : false,
      });

    case "async.parallel_map": {
      const array = Array.isArray(
        inputs.array,
      )
        ? inputs.array
        : [];

      const fn = requireFunctionValue(
        inputs.function,
        "Function",
      );

      const concurrency =
        inputs.concurrency === undefined
          ? Number(
              node.data.concurrency ??
                4,
            )
          : Number(
              inputs.concurrency,
            );

      return success({
        promise: createPromiseValue(
          parallelMapWithLimit(
            array,
            concurrency,
            (
              value,
              index,
            ) =>
              invokeFunctionValue(
                fn,
                [
                  value,
                  index,
                  array,
                ],
                runtime,
              ),
          ),
        ),
      });
    }

    case "async.parallel_filter": {
      const array = Array.isArray(
        inputs.array,
      )
        ? inputs.array
        : [];

      const predicate =
        requireFunctionValue(
          inputs.predicate,
          "Predicate",
        );

      const concurrency =
        inputs.concurrency === undefined
          ? Number(
              node.data.concurrency ??
                4,
            )
          : Number(
              inputs.concurrency,
            );

      const task =
        parallelMapWithLimit(
          array,
          concurrency,
          async (
            value,
            index,
          ) => ({
            value,
            keep: Boolean(
              await invokeFunctionValue(
                predicate,
                [
                  value,
                  index,
                  array,
                ],
                runtime,
              ),
            ),
          }),
        ).then(
          (results) =>
            results
              .filter(
                (item) =>
                  Boolean(
                    (
                      item as {
                        keep: boolean;
                      }
                    ).keep,
                  ),
              )
              .map(
                (item) =>
                  (
                    item as {
                      value: unknown;
                    }
                  ).value,
              ),
        );

      return success({
        promise:
          createPromiseValue(
            task,
          ),
      });
    }

    case "async.parallel_invoke": {
      const functions =
        Array.isArray(
          inputs.functions,
        )
          ? inputs.functions
          : [];

      const args = Array.isArray(
        inputs.args,
      )
        ? inputs.args
        : [];

      const tasks =
        functions.map(
          (
            value,
            index,
          ) => {
            const fn =
              requireFunctionValue(
                value,
                `Functions[${index}]`,
              );

            return invokeFunctionValue(
              fn,
              args,
              runtime,
            );
          },
        );

      return success({
        promise: createPromiseValue(
          Promise.all(
            tasks,
          ),
        ),
      });
    }

    case "coroutine.create": {
      const fn =
        requireFunctionValue(
          inputs.function,
          "Function",
        );

      const state =
        inputs.initialState ===
        undefined
          ? node.data
              .coroutineInitialState
          : inputs.initialState;

      return success({
        coroutine:
          createCoroutineValue(
            fn,
            state,
          ),
      });
    }

    case "coroutine.resume": {
      const coroutine =
        inputs.coroutine;

      if (
        !isCoroutineValue(
          coroutine,
        )
      ) {
        throw new Error(
          "CoroutineにはCoroutine値が必要です。",
        );
      }

      const result =
        await resumeCoroutine(
          coroutine,
          inputs.input,
          runtime,
        );

      return success(
        result,
      );
    }

    case "coroutine.collect": {
      const coroutine =
        inputs.coroutine;

      if (
        !isCoroutineValue(
          coroutine,
        )
      ) {
        throw new Error(
          "CoroutineにはCoroutine値が必要です。",
        );
      }

      const limit = Math.max(
        0,
        Math.min(
          Math.floor(
            Number(
              inputs.limit,
            ),
          ),
          1_000_000,
        ),
      );

      const values:
        unknown[] = [];

      let current =
        coroutine;

      for (
        let index = 0;
        index < limit &&
        !current.done;
        index += 1
      ) {
        const resumed =
          await resumeCoroutine(
            current,
            undefined,
            runtime,
          );

        values.push(
          resumed.value,
        );

        current =
          resumed.next;
      }

      return success({
        values,
        next: current,
        done: current.done,
      });
    }

    case "coroutine.status": {
      const coroutine =
        inputs.coroutine;

      if (
        !isCoroutineValue(
          coroutine,
        )
      ) {
        throw new Error(
          "CoroutineにはCoroutine値が必要です。",
        );
      }

      return success({
        status:
          coroutine.done
            ? "done"
            : "suspended",
      });
    }

    case "channel.create":
      return success({
        channel:
          createChannelValue(
            inputs.capacity ===
            undefined
              ? Number(
                  node.data
                    .channelCapacity ??
                    0,
                )
              : Number(
                  inputs.capacity,
                ),
          ),
      });

    case "channel.send": {
      const channel =
        inputs.channel;

      if (
        !isChannelValue(
          channel,
        )
      ) {
        throw new Error(
          "ChannelにはChannel値が必要です。",
        );
      }

      return success({
        channel,
        sent:
          sendChannelValue(
            channel,
            inputs.value,
          ),
      });
    }

    case "channel.receive": {
      const channel =
        inputs.channel;

      if (
        !isChannelValue(
          channel,
        )
      ) {
        throw new Error(
          "ChannelにはChannel値が必要です。",
        );
      }

      return success({
        promise:
          receiveChannelValue(
            channel,
          ),
      });
    }

    case "channel.try_receive": {
      const channel =
        inputs.channel;

      if (
        !isChannelValue(
          channel,
        )
      ) {
        throw new Error(
          "ChannelにはChannel値が必要です。",
        );
      }

      const hasValue =
        channel.queue.length > 0;

      return success({
        option: hasValue
          ? someOption(
              channel.queue.shift(),
            )
          : noneOption(),
        channel,
      });
    }

    case "channel.close": {
      const channel =
        inputs.channel;

      if (
        !isChannelValue(
          channel,
        )
      ) {
        throw new Error(
          "ChannelにはChannel値が必要です。",
        );
      }

      return success({
        closed:
          closeChannelValue(
            channel,
          ),
      });
    }

case "network.http_request": {
  const result =
    await invoke<{
      status: number;
      headers: Record<
        string,
        string
      >;
      body: string;
      json: unknown;
    }>("http_request", {
      url: String(
        inputs.url,
      ),
      method:
        inputs.method ===
        undefined
          ? String(
              node.data
                .httpMethod ??
                "GET",
            )
          : String(
              inputs.method,
            ),
      headers:
        inputs.headers &&
        typeof inputs.headers ===
          "object" &&
        !Array.isArray(
          inputs.headers,
        )
          ? inputs.headers
          : {},
      body:
        inputs.body ??
        null,
      timeoutMs:
        inputs.timeoutMs ===
        undefined
          ? Number(
              node.data
                .httpTimeoutMs ??
                15000,
            )
          : Number(
              inputs.timeoutMs,
            ),
    });

  return success(result);
}

case "network.websocket_connect":
  return success({
    socket:
      await connectWebSocket(
        String(inputs.url),
      ),
  });

case "network.websocket_send": {
  const socket =
    inputs.socket;

  if (
    !isWebSocketValue(
      socket,
    )
  ) {
    throw new Error(
      "SocketにはWebSocket接続が必要です。",
    );
  }

  if (
    socket.closed ||
    socket.socket.readyState !==
      WebSocket.OPEN
  ) {
    throw new Error(
      "WebSocketは接続されていません。",
    );
  }

  socket.socket.send(
    typeof inputs.message ===
      "string"
      ? inputs.message
      : JSON.stringify(
          inputs.message,
        ),
  );

  return success({
    socket,
    sent: true,
  });
}

case "network.websocket_receive": {
  const socket =
    inputs.socket;

  if (
    !isWebSocketValue(
      socket,
    )
  ) {
    throw new Error(
      "SocketにはWebSocket接続が必要です。",
    );
  }

  return success({
    promise:
      receiveWebSocket(
        socket,
      ),
  });
}

case "network.websocket_close": {
  const socket =
    inputs.socket;

  if (
    !isWebSocketValue(
      socket,
    )
  ) {
    throw new Error(
      "SocketにはWebSocket接続が必要です。",
    );
  }

  socket.socket.close();
  socket.closed = true;

  return success({
    closed: true,
  });
}

case "network.tcp_request":
  return success({
    response:
      await invoke<string>(
        "tcp_request",
        {
          host: String(
            inputs.host,
          ),
          port: Math.max(
            0,
            Math.min(
              65535,
              Math.floor(
                Number(
                  inputs.port,
                ),
              ),
            ),
          ),
          data: String(
            inputs.data ??
              "",
          ),
          timeoutMs:
            inputs.timeoutMs ===
            undefined
              ? Number(
                  node.data
                    .networkTimeoutMs ??
                    5000,
                )
              : Number(
                  inputs.timeoutMs,
                ),
        },
      ),
  });

case "network.udp_request":
  return success({
    response:
      await invoke<string>(
        "udp_request",
        {
          host: String(
            inputs.host,
          ),
          port: Math.max(
            0,
            Math.min(
              65535,
              Math.floor(
                Number(
                  inputs.port,
                ),
              ),
            ),
          ),
          data: String(
            inputs.data ??
              "",
          ),
          timeoutMs:
            inputs.timeoutMs ===
            undefined
              ? Number(
                  node.data
                    .networkTimeoutMs ??
                    3000,
                )
              : Number(
                  inputs.timeoutMs,
                ),
        },
      ),
  });

case "parse.json_parse":
  return success({
    value: JSON.parse(
      String(inputs.text),
    ),
  });

case "parse.json_stringify":
  return success({
    text: JSON.stringify(
      inputs.value,
      null,
      Boolean(
        inputs.pretty,
      )
        ? 2
        : 0,
    ),
  });

case "parse.xml_parse": {
  const document =
    new DOMParser()
      .parseFromString(
        String(inputs.text),
        "application/xml",
      );

  const error =
    document.querySelector(
      "parsererror",
    );

  if (error) {
    throw new Error(
      error.textContent ??
        "XML解析に失敗しました。",
    );
  }

  return success({
    value: {
      [document.documentElement
        .tagName]:
        xmlElementToValue(
          document
            .documentElement,
        ),
    },
  });
}

case "parse.html_select": {
  const document =
    new DOMParser()
      .parseFromString(
        String(inputs.html),
        "text/html",
      );

  const elements = [
    ...document.querySelectorAll(
      String(
        inputs.selector,
      ),
    ),
  ].map((element) => ({
    tag:
      element.tagName
        .toLowerCase(),
    text:
      element.textContent ??
      "",
    html:
      element.innerHTML,
    attributes:
      Object.fromEntries(
        [
          ...element.attributes,
        ].map(
          (attribute) => [
            attribute.name,
            attribute.value,
          ],
        ),
      ),
  }));

  return success({
    elements,
  });
}

case "stream.from_text": {
  const text = String(
    inputs.text ??
      "",
  );

  const size = Math.max(
    1,
    Math.floor(
      inputs.chunkSize ===
      undefined
        ? Number(
            node.data
              .streamChunkSize ??
              4096,
          )
        : Number(
            inputs.chunkSize,
          ),
    ),
  );

  const chunks:
    string[] = [];

  for (
    let index = 0;
    index < text.length;
    index += size
  ) {
    chunks.push(
      text.slice(
        index,
        index + size,
      ),
    );
  }

  return success({
    stream:
      createStream(
        chunks,
      ),
  });
}

case "stream.lines":
  return success({
    stream:
      createStream(
        String(
          inputs.text ??
            "",
        ).split(
          /\r?\n/,
        ),
      ),
  });

case "stream.map": {
  const stream =
    inputs.stream;

  if (
    !isStreamValue(
      stream,
    )
  ) {
    throw new Error(
      "StreamにはStream値が必要です。",
    );
  }

  const fn =
    requireFunctionValue(
      inputs.function,
      "Function",
    );

  return success({
    stream:
      createStream(
        stream.values,
        [
          ...stream.operations,
          {
            kind: "map",
            function: fn,
          },
        ],
        stream.cursor,
      ),
  });
}

case "stream.filter": {
  const stream =
    inputs.stream;

  if (
    !isStreamValue(
      stream,
    )
  ) {
    throw new Error(
      "StreamにはStream値が必要です。",
    );
  }

  const fn =
    requireFunctionValue(
      inputs.predicate,
      "Predicate",
    );

  return success({
    stream:
      createStream(
        stream.values,
        [
          ...stream.operations,
          {
            kind:
              "filter",
            function: fn,
          },
        ],
        stream.cursor,
      ),
  });
}

case "stream.collect": {
  const stream =
    inputs.stream;

  if (
    !isStreamValue(
      stream,
    )
  ) {
    throw new Error(
      "StreamにはStream値が必要です。",
    );
  }

  return success({
    array:
      await collectStream(
        stream,
        runtime,
        inputs.limit ===
        undefined
          ? 10000
          : Number(
              inputs.limit,
            ),
      ),
  });
}

case "stream.join": {
  const stream =
    inputs.stream;

  if (
    !isStreamValue(
      stream,
    )
  ) {
    throw new Error(
      "StreamにはStream値が必要です。",
    );
  }

  const values =
    await collectStream(
      stream,
      runtime,
      inputs.limit ===
      undefined
        ? 10000
        : Number(
            inputs.limit,
          ),
    );

  return success({
    text: values
      .map(String)
      .join(
        inputs.separator ===
        undefined
          ? ""
          : String(
              inputs.separator,
            ),
      ),
  });
}

case "cache.set": {
  const ttl =
    inputs.ttlMs ===
    undefined
      ? Number(
          node.data
            .cacheTtlMs ??
            0,
        )
      : Number(
          inputs.ttlMs,
        );

  runtime.cache.set(
    String(inputs.key),
    {
      value:
        inputs.value,
      expiresAt:
        ttl > 0
          ? Date.now() +
            ttl
          : null,
    },
  );

  return success({
    value:
      inputs.value,
  });
}

case "cache.get": {
  const key = String(
    inputs.key,
  );

  const entry =
    runtime.cache.get(
      key,
    );

  if (
    entry &&
    entry.expiresAt !==
      null &&
    entry.expiresAt <=
      Date.now()
  ) {
    runtime.cache.delete(
      key,
    );

    return success({
      option:
        noneOption(),
    });
  }

  return success({
    option: entry
      ? someOption(
          entry.value,
        )
      : noneOption(),
  });
}

case "cache.delete":
  return success({
    deleted:
      runtime.cache.delete(
        String(
          inputs.key,
        ),
      ),
  });

case "cache.clear":
  runtime.cache.clear();

  return success({
    cleared: true,
  });

case "database.sqlite_execute":
  return success({
    affected:
      await invoke<number>(
        "sqlite_execute",
        {
          path: String(
            inputs.path,
          ),
          sql: String(
            inputs.sql,
          ),
          params:
            Array.isArray(
              inputs.params,
            )
              ? inputs.params
              : [],
        },
      ),
  });

case "database.sqlite_query":
  return success({
    rows:
      await invoke<
        unknown[]
      >(
        "sqlite_query",
        {
          path: String(
            inputs.path,
          ),
          sql: String(
            inputs.sql,
          ),
          params:
            Array.isArray(
              inputs.params,
            )
              ? inputs.params
              : [],
        },
      ),
  });

case "database.orm_select": {
  const table =
    safeSqlIdentifier(
      String(
        inputs.table,
      ),
    );

  const columns =
    Array.isArray(
      inputs.columns,
    ) &&
    inputs.columns.length >
      0
      ? inputs.columns
          .map(
            (column) =>
              safeSqlIdentifier(
                String(
                  column,
                ),
              ),
          )
          .join(", ")
      : "*";

  const where =
    ormWhere(
      inputs.where,
    );

  const limit =
    inputs.limit ===
    undefined
      ? ""
      : ` LIMIT ${Math.max(
          0,
          Math.floor(
            Number(
              inputs.limit,
            ),
          ),
        )}`;

  return success({
    query:
      Object.freeze({
        sql:
          `SELECT ${columns} FROM ${table}` +
          where.sql +
          limit,
        params:
          where.params,
      }),
  });
}

case "database.orm_insert": {
  const table =
    safeSqlIdentifier(
      String(
        inputs.table,
      ),
    );

  const data =
    inputs.data &&
    typeof inputs.data ===
      "object" &&
    !Array.isArray(
      inputs.data,
    )
      ? Object.entries(
          inputs.data as Record<
            string,
            unknown
          >,
        )
      : [];

  if (
    data.length === 0
  ) {
    throw new Error(
      "Insert Dataが空です。",
    );
  }

  return success({
    query:
      Object.freeze({
        sql:
          `INSERT INTO ${table} (` +
          data
            .map(
              ([key]) =>
                safeSqlIdentifier(
                  key,
                ),
            )
            .join(", ") +
          ") VALUES (" +
          data
            .map(() => "?")
            .join(", ") +
          ")",
        params:
          data.map(
            ([, value]) =>
              value,
          ),
      }),
  });
}

case "database.orm_update": {
  const table =
    safeSqlIdentifier(
      String(
        inputs.table,
      ),
    );

  const data =
    inputs.data &&
    typeof inputs.data ===
      "object" &&
    !Array.isArray(
      inputs.data,
    )
      ? Object.entries(
          inputs.data as Record<
            string,
            unknown
          >,
        )
      : [];

  if (
    data.length === 0
  ) {
    throw new Error(
      "Update Dataが空です。",
    );
  }

  const where =
    ormWhere(
      inputs.where,
    );

  if (
    where.sql === ""
  ) {
    throw new Error(
      "安全のためWHEREなしUPDATEは拒否されました。",
    );
  }

  return success({
    query:
      Object.freeze({
        sql:
          `UPDATE ${table} SET ` +
          data
            .map(
              ([key]) =>
                `${safeSqlIdentifier(
                  key,
                )} = ?`,
            )
            .join(", ") +
          where.sql,
        params: [
          ...data.map(
            ([, value]) =>
              value,
          ),
          ...where.params,
        ],
      }),
  });
}

case "database.query_sql": {
  const query =
    inputs.query;

  if (
    !query ||
    typeof query !==
      "object" ||
    Array.isArray(query)
  ) {
    throw new Error(
      "QueryにはORM Queryオブジェクトが必要です。",
    );
  }

  const value =
    query as Record<
      string,
      unknown
    >;

  return success({
    sql: String(
      value.sql ??
        "",
    ),
    params:
      Array.isArray(
        value.params,
      )
        ? value.params
        : [],
  });
}

case "crypto.sha256": {
  const serialized =
    typeof inputs.value ===
    "string"
      ? inputs.value
      : JSON.stringify(
          inputs.value,
        );

  return success({
    hash:
      bytesToHex(
        await crypto.subtle.digest(
          "SHA-256",
          textEncoder().encode(
            serialized,
          ),
        ),
      ),
  });
}

case "crypto.hmac_sha256":
  return success({
    signature:
      bytesToHex(
        (
          await hmacBytes(
            typeof inputs.value ===
              "string"
              ? inputs.value
              : JSON.stringify(
                  inputs.value,
                ),
            String(
              inputs.secret,
            ),
          )
        ).buffer,
      ),
  });

case "crypto.random_bytes": {
  const length = Math.max(
    1,
    Math.min(
      65536,
      Math.floor(
        Number(
          inputs.length,
        ),
      ),
    ),
  );

  const bytes =
    new Uint8Array(
      length,
    );

  crypto.getRandomValues(
    bytes,
  );

  return success({
    base64:
      bytesToBase64(
        bytes,
      ),
  });
}

case "crypto.aes_encrypt": {
  const key =
    await importAesKey(
      String(
        inputs.secret,
      ),
    );

  const iv =
    crypto.getRandomValues(
      new Uint8Array(12),
    );

  const encrypted =
    new Uint8Array(
      await crypto.subtle.encrypt(
        {
          name:
            "AES-GCM",
          iv,
        },
        key,
        textEncoder().encode(
          String(
            inputs.text,
          ),
        ),
      ),
    );

  const combined =
    new Uint8Array(
      iv.length +
        encrypted.length,
    );

  combined.set(
    iv,
    0,
  );

  combined.set(
    encrypted,
    iv.length,
  );

  return success({
    encrypted:
      bytesToBase64(
        combined,
      ),
  });
}

case "crypto.aes_decrypt": {
  const bytes =
    base64ToBytes(
      String(
        inputs.encrypted,
      ),
    );

  if (
    bytes.length <= 12
  ) {
    throw new Error(
      "暗号文が短すぎます。",
    );
  }

  const key =
    await importAesKey(
      String(
        inputs.secret,
      ),
    );

  const decrypted =
    await crypto.subtle.decrypt(
      {
        name:
          "AES-GCM",
        iv: bytes.slice(
          0,
          12,
        ),
      },
      key,
      bytes.slice(12),
    );

  return success({
    text:
      new TextDecoder().decode(
        decrypted,
      ),
  });
}

case "crypto.jwt_sign": {
  const header =
    base64Url(
      JSON.stringify({
        alg: "HS256",
        typ: "JWT",
      }),
    );

  const payload =
    base64Url(
      JSON.stringify(
        inputs.payload ??
          {},
      ),
    );

  const unsigned =
    `${header}.${payload}`;

  const signature =
    bytesToBase64(
      await hmacBytes(
        unsigned,
        String(
          inputs.secret,
        ),
      ),
    )
      .replaceAll(
        "+",
        "-",
      )
      .replaceAll(
        "/",
        "_",
      )
      .replaceAll(
        "=",
        "",
      );

  return success({
    token:
      `${unsigned}.${signature}`,
  });
}

case "crypto.jwt_verify": {
  const token = String(
    inputs.token,
  );

  const parts =
    token.split(".");

  if (
    parts.length !== 3
  ) {
    return success({
      valid: false,
      payload: {},
    });
  }

  const unsigned =
    `${parts[0]}.${parts[1]}`;

  const expected =
    bytesToBase64(
      await hmacBytes(
        unsigned,
        String(
          inputs.secret,
        ),
      ),
    )
      .replaceAll(
        "+",
        "-",
      )
      .replaceAll(
        "/",
        "_",
      )
      .replaceAll(
        "=",
        "",
      );

  let payload:
    Record<
      string,
      unknown
    > = {};

  try {
    payload = JSON.parse(
      decodeBase64Url(
        parts[1],
      ),
    );
  } catch {
    return success({
      valid: false,
      payload: {},
    });
  }

  return success({
    valid:
      expected ===
      parts[2],
    payload,
  });
}

case "gpu.webgpu_available":
  return success({
    available:
      Boolean(
        (
          navigator as Navigator & {
            gpu?: unknown;
          }
        ).gpu,
      ),
  });

case "gpu.vector_add": {
  const result =
    await gpuVectorAdd(
      (
        Array.isArray(
          inputs.a,
        )
          ? inputs.a
          : []
      ).map(Number),
      (
        Array.isArray(
          inputs.b,
        )
          ? inputs.b
          : []
      ).map(Number),
    );

  return success(
    result,
  );
}

case "gui.label":
  return success({
    component:
      Object.freeze({
        id:
          crypto.randomUUID(),
        kind: "label",
        text: String(
          inputs.text ??
            "",
        ),
      }),
  });

case "gui.button":
  return success({
    component:
      Object.freeze({
        id:
          crypto.randomUUID(),
        kind: "button",
        text: String(
          inputs.text ??
            "Button",
        ),
      }),
  });

case "gui.input":
  return success({
    component:
      Object.freeze({
        id:
          crypto.randomUUID(),
        kind: "input",
        text: String(
          inputs.placeholder ??
            "",
        ),
        value: String(
          inputs.value ??
            "",
        ),
      }),
  });

case "gui.row":
case "gui.column":
  return success({
    component:
      Object.freeze({
        id:
          crypto.randomUUID(),
        kind:
          type ===
          "gui.row"
            ? "row"
            : "column",
        children:
          (
            Array.isArray(
              inputs.children,
            )
              ? inputs.children
              : []
          ).filter(
            isGuiSpec,
          ),
      }),
  });

case "gui.window": {
  const content =
    inputs.content;

  const children =
    Array.isArray(content)
      ? content.filter(
          isGuiSpec,
        )
      : isGuiSpec(
          content,
        )
        ? [content]
        : [];

  return success({
    window:
      Object.freeze({
        id:
          crypto.randomUUID(),
        kind: "window",
        title: String(
          inputs.title ??
            "Flow GUI",
        ),
        width:
          inputs.width ===
          undefined
            ? 480
            : Number(
                inputs.width,
              ),
        height:
          inputs.height ===
          undefined
            ? 240
            : Number(
                inputs.height,
              ),
        children,
      }),
  });
}

case "gui.show": {
  const windowSpec =
    inputs.window;

  if (
    !isGuiSpec(
      windowSpec,
    )
  ) {
    throw new Error(
      "WindowにはGUI Window仕様が必要です。",
    );
  }

  return success({
    windowId:
      showGuiWindow(
        windowSpec,
      ),
  });
}

case "string.concat":
  return success({
    result:
      String(inputs.a ?? "") +
      String(inputs.b ?? ""),
  });

case "string.uppercase":
  return success({
    result:
      String(inputs.value ?? "")
        .toUpperCase(),
  });

case "string.trim":
  return success({
    result:
      String(inputs.value ?? "")
        .trim(),
  });

case "array.push":
  return success({
    result: [
      ...(
        Array.isArray(inputs.array)
          ? inputs.array
          : []
      ),
      inputs.value,
    ],
  });

    case "core.print":
      onLog(
        typeof inputs.input ===
          "string"
          ? inputs.input
          : JSON.stringify(
              inputs.input,
            ),
      );

      return success();

    default:
      return null;
  }
}

async function runSingleNode(
  node: EditorNode,
  inputs: Record<
    string,
    unknown
  >,
  options: ExecuteGraphOptions,
  runtime: RuntimeContext,
): Promise<NodeRunResult> {
  options.onEvent({
    nodeId: node.id,
    phase: "before",
  });

  try {
    let result =
      await executeBuiltin(
        node,
        inputs,
        runtime,
        options.onLog,
      );

    if (result === null) {
      const definition =
        findPluginNode(
          options.plugins,
          node.data
            .languageType,
        );

      if (!definition) {
        throw new Error(
          `ノード定義がありません: ${node.data.languageType}`,
        );
      }

      result = {
        outputs:
          await runPluginNode(
            definition,
            inputs,
            node.data,
            options.onLog,
          ),
        signal: "none",
      };
    }

    options.onEvent({
      nodeId: node.id,
      phase: "after",
      outputs: result.outputs,
    });

    return result;
  } catch (error) {
    options.onEvent({
      nodeId: node.id,
      phase: "error",
      error: String(error),
    });

    throw error;
  }
}

async function runRegionOnce(
  regionNodes: EditorNode[],
  regionEdges: EditorEdge[],
  options: ExecuteGraphOptions,
  runtime: RuntimeContext,
  debug: ReturnType<
    typeof createExecutionController
  >,
): Promise<LoopSignal> {
  const plan =
    topologicalLayers(
      regionNodes,
      regionEdges,
    );

  const values =
    new Map<string, unknown>();

  const inputsFor = (
    nodeId: string,
  ) => {
    const result: Record<
      string,
      unknown
    > = {};

    for (const edge of regionEdges) {
      if (
        edge.target !== nodeId
      ) {
        continue;
      }

      result[
        edge.targetHandle ?? ""
      ] = values.get(
        `${edge.source}:${
          edge.sourceHandle ?? ""
        }`,
      );
    }

    return result;
  };

  for (const layer of plan) {
    const parallel =
      layer.filter(
        (node) =>
          node.data.parallel,
      );

    const sequential =
      layer.filter(
        (node) =>
          !node.data.parallel,
      );

    for (const node of sequential) {
      if (
        options.mode !==
          "normal" &&
        !debug.isContinuing()
      ) {
        await debug.wait(
          node.id,
          options.onWaiting,
        );
      }

      const result =
        await runSingleNode(
          node,
          inputsFor(node.id),
          options,
          runtime,
        );

      for (const [
        port,
        value,
      ] of Object.entries(
        result.outputs,
      )) {
        values.set(
          `${node.id}:${port}`,
          value,
        );
      }

      if (
        result.signal !== "none"
      ) {
        return result.signal;
      }
    }

    const parallelResults =
      await Promise.all(
        parallel.map(
          async (node) => {
            const result =
              await runSingleNode(
                node,
                inputsFor(
                  node.id,
                ),
                options,
                runtime,
              );

            return {
              node,
              result,
            };
          },
        ),
      );

    for (const {
      node,
      result,
    } of parallelResults) {
      for (const [
        port,
        value,
      ] of Object.entries(
        result.outputs,
      )) {
        values.set(
          `${node.id}:${port}`,
          value,
        );
      }

      if (
        result.signal !== "none"
      ) {
        return result.signal;
      }
    }
  }

  return "none";
}

function groupMode(
  group: EditorNode,
): GroupExecutionMode {
  return String(
    group.data.executionMode ??
      "group",
  ) as GroupExecutionMode;
}

async function runExecutableGroup(
  group: EditorNode,
  allNodes: EditorNode[],
  allEdges: EditorEdge[],
  options: ExecuteGraphOptions,
  runtime: RuntimeContext,
  debug: ReturnType<
    typeof createExecutionController
  >,
): Promise<void> {
  const children =
    allNodes.filter(
      (node) =>
        node.parentId ===
        group.id,
    );

  const childIds = new Set(
    children.map(
      (node) => node.id,
    ),
  );

  const edges =
    allEdges.filter(
      (edge) =>
        childIds.has(
          edge.source,
        ) &&
        childIds.has(
          edge.target,
        ),
    );

  const mode =
    groupMode(group);

  if (mode === "try-catch") {
    try {
      await runRegionOnce(
        children,
        edges,
        options,
        runtime,
        debug,
      );
    } catch (error) {
      const name = String(
        group.data.errorVariable ??
          "lastError",
      );

      runtime.variables.set(
        name,
        String(error),
      );

      options.onLog(
        `Try/Catch: ${String(
          error,
        )}`,
      );
    }

    return;
  }

  if (mode === "for-count") {
    const count = Math.max(
      0,
      Math.floor(
        Number(
          group.data.repeatCount ??
            10,
        ),
      ),
    );

    for (
      let index = 0;
      index < count;
      index += 1
    ) {
      runtime.variables.set(
        "loopIndex",
        index,
      );

      const signal =
        await runRegionOnce(
          children,
          edges,
          options,
          runtime,
          debug,
        );

      if (signal === "break") {
        break;
      }
    }

    return;
  }

  if (
    mode === "while-variable"
  ) {
    const variableName =
      String(
        group.data.loopVariable ??
          "running",
      );

    const expected =
      Boolean(
        group.data
          .loopConditionValue ??
          true,
      );

    const max = Math.max(
      1,
      Number(
        group.data
          .maxIterations ??
          10000,
      ),
    );

    for (
      let index = 0;
      index < max;
      index += 1
    ) {
      const current =
        Boolean(
          runtime.variables.get(
            variableName,
          ),
        );

      if (
        current !== expected
      ) {
        break;
      }

      runtime.variables.set(
        "loopIndex",
        index,
      );

      const signal =
        await runRegionOnce(
          children,
          edges,
          options,
          runtime,
          debug,
        );

      if (signal === "break") {
        break;
      }
    }

    return;
  }

  if (mode === "while-key") {
    const stopKey = String(
      group.data.stopKey ??
        "Escape",
    ).toLowerCase();

    const max = Math.max(
      1,
      Number(
        group.data
          .maxIterations ??
          10000,
      ),
    );

    let stopped = false;

    const listener = (
      event: KeyboardEvent,
    ) => {
      if (
        event.key.toLowerCase() ===
        stopKey
      ) {
        stopped = true;
        event.preventDefault();
      }
    };

    window.addEventListener(
      "keydown",
      listener,
      true,
    );

    options.onLog(
      `WHILE開始: ${stopKey}キーで停止`,
    );

    try {
      for (
        let index = 0;
        index < max;
        index += 1
      ) {
        if (stopped) {
          break;
        }

        runtime.variables.set(
          "loopIndex",
          index,
        );

        const signal =
          await runRegionOnce(
            children,
            edges,
            options,
            runtime,
            debug,
          );

        if (signal === "break") {
          break;
        }

        // UIイベントとキー入力を処理する機会を作る。
        await new Promise<void>(
          (resolve) =>
            setTimeout(
              resolve,
              0,
            ),
        );
      }
    } finally {
      window.removeEventListener(
        "keydown",
        listener,
        true,
      );

      options.onLog(
        "WHILE終了",
      );
    }
  }
}

export async function executeGraph(
  options: ExecuteGraphOptions,
  debug: ReturnType<
    typeof createExecutionController
  >,
): Promise<void> {
  const runtime: RuntimeContext = {
    variables: new Map<string, unknown>(),
    functions: new Map<string, FunctionValue>(),
    cache: new Map<string, CacheEntry>(),
  };

  const executableGroups =
    options.nodes.filter(
      (node) =>
        node.type === "group" &&
        groupMode(node) !==
          "group",
    );

  const executableGroupIds =
    new Set(
      executableGroups.map(
        (group) => group.id,
      ),
    );

  const normalNodes =
    options.nodes.filter(
      (node) =>
        node.type !== "group" &&
        !(
          node.parentId &&
          executableGroupIds.has(
            node.parentId,
          )
        ),
    );

  const outerItems: EditorNode[] = [
    ...normalNodes,
    ...executableGroups,
  ];

  const outerIds = new Set(
    outerItems.map(
      (node) => node.id,
    ),
  );

  const outerEdges =
    options.edges.filter(
      (edge) =>
        outerIds.has(edge.source) &&
        outerIds.has(edge.target),
    );

  const outerPlan =
    topologicalLayers(
      outerItems,
      outerEdges,
    );

  const values =
    new Map<string, unknown>();

  let breakpointReached =
    options.mode ===
    "step-from-start";

  const inputsFor = (
    nodeId: string,
  ) => {
    const result: Record<
      string,
      unknown
    > = {};

    for (const edge of outerEdges) {
      if (
        edge.target !== nodeId
      ) {
        continue;
      }

      result[
        edge.targetHandle ?? ""
      ] = values.get(
        `${edge.source}:${
          edge.sourceHandle ?? ""
        }`,
      );
    }

    return result;
  };

  const runOuterNode =
    async (
      node: EditorNode,
    ) => {
      if (
        node.type === "group"
      ) {
        await runExecutableGroup(
          node,
          options.nodes,
          options.edges,
          options,
          runtime,
          debug,
        );

        return;
      }

      if (
        options.mode ===
          "step-from-breakpoint" &&
        !breakpointReached &&
        node.data.breakpoint
      ) {
        breakpointReached = true;
      }

      if (
        options.mode !==
          "normal" &&
        breakpointReached &&
        !debug.isContinuing()
      ) {
        await debug.wait(
          node.id,
          options.onWaiting,
        );
      }

      const result =
        await runSingleNode(
          node,
          inputsFor(node.id),
          options,
          runtime,
        );

      for (const [
        port,
        value,
      ] of Object.entries(
        result.outputs,
      )) {
        values.set(
          `${node.id}:${port}`,
          value,
        );
      }
    };

  for (const layer of outerPlan) {
    const parallel =
      layer.filter(
        (node) =>
          node.type !== "group" &&
          node.data.parallel,
      );

    const sequential =
      layer.filter(
        (node) =>
          node.type === "group" ||
          !node.data.parallel,
      );

    for (const node of sequential) {
      await runOuterNode(node);
    }

    await Promise.all(
      parallel.map(
        runOuterNode,
      ),
    );
  }
}
