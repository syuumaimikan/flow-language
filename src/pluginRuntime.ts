import { invoke } from "@tauri-apps/api/core";
import type {
  PluginManifest,
  PluginModuleDefinition,
  PluginNodeDefinition,
} from "./types";

type ModuleEntry = {
  definition: PluginModuleDefinition;
  value: unknown;
};

const modules = new Map<string, ModuleEntry>();
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as
  new (...args: string[]) => (...values: unknown[]) => Promise<unknown>;

export async function loadPluginModules(
  manifest: PluginManifest,
): Promise<string[]> {
  if (manifest.enabled === false) {
    return [];
  }

  const loaded: string[] = [];

  for (const definition of manifest.modules ?? []) {
    const existing = modules.get(definition.id);

    if (existing) {
      const a = existing.definition.version;
      const b = definition.version;

      if (a && b && a !== b) {
        throw new Error(
          `モジュール ${definition.id} のバージョン競合: ${a} / ${b}`,
        );
      }

      continue;
    }

    let value: unknown;

    switch (definition.kind) {
      case "builtin":
        value = Object.freeze({ id: definition.id });
        break;

      case "webaudio": {
        const AudioContextCtor =
          window.AudioContext ??
          (
            window as typeof window & {
              webkitAudioContext?: typeof AudioContext;
            }
          ).webkitAudioContext;

        if (!AudioContextCtor) {
          throw new Error("Web Audio APIを利用できません。");
        }

        value = new AudioContextCtor();
        break;
      }

      case "javascript":
        if (!definition.source) {
          throw new Error(`${definition.id}にsourceがありません。`);
        }

        value = await import(/* @vite-ignore */ definition.source);
        break;

      case "external-process":
        value = Object.freeze({
          command: definition.command,
          args: definition.args ?? [],
        });
        break;

      default:
        throw new Error(`未対応モジュール形式: ${String(definition.kind)}`);
    }

    modules.set(definition.id, { definition, value });
    loaded.push(definition.id);
  }

  return loaded;
}

export function getLoadedModuleIds(): string[] {
  return [...modules.keys()];
}

export interface PluginApi {
  log(message: unknown): void;
  createWindow(options: {
    title: string;
    content: string;
    width?: number;
    height?: number;
  }): string;
  closeWindow(id: string): void;
}

function createPluginApi(
  logger: (message: string) => void,
): PluginApi {
  return {
    log(message) {
      logger(String(message));
    },

    createWindow(options) {
      const id = crypto.randomUUID();
      const element = document.createElement("section");
      element.dataset.pluginWindowId = id;
      element.className = "plugin-window";
      element.style.width = `${options.width ?? 420}px`;
      element.style.minHeight = `${options.height ?? 180}px`;

      const header = document.createElement("header");
      const title = document.createElement("span");
      title.textContent = options.title;

      const close = document.createElement("button");
      close.textContent = "×";
      close.onclick = () => element.remove();

      header.append(title, close);

      const body = document.createElement("div");
      body.className = "plugin-window__body";
      body.textContent = options.content;

      element.append(header, body);
      document.body.appendChild(element);
      return id;
    },

    closeWindow(id) {
      document
        .querySelector(`[data-plugin-window-id="${CSS.escape(id)}"]`)
        ?.remove();
    },
  };
}

export async function runPluginNode(
  definition: PluginNodeDefinition,
  inputs: Record<string, unknown>,
  properties: Record<string, unknown>,
  logger: (message: string) => void,
): Promise<Record<string, unknown>> {
  if (definition.runtime?.kind === "external-process") {
    const command = definition.runtime.command;

    if (!command) {
      throw new Error(`${definition.languageType}にcommandがありません。`);
    }

    return invoke<Record<string, unknown>>("execute_external_plugin", {
      command,
      args: definition.runtime.args ?? [],
      payload: {
        inputs,
        properties,
      },
    });
  }

  if (definition.runtime?.kind === "javascript") {
    const handler = new AsyncFunction(
      "inputs",
      "properties",
      "modules",
      "api",
      `"use strict";\n${definition.runtime.handler ?? ""}`,
    );

    const moduleValues = Object.fromEntries(
      (definition.requiredModules ?? []).map((id) => [
        id,
        modules.get(id)?.value,
      ]),
    );

    const result = await handler(
      inputs,
      properties,
      moduleValues,
      createPluginApi(logger),
    );

    if (result == null) {
      return {};
    }

    if (typeof result !== "object" || Array.isArray(result)) {
      return definition.outputs.length === 1
        ? { [definition.outputs[0].id]: result }
        : {};
    }

    return result as Record<string, unknown>;
  }

  if (!definition.expression) {
    throw new Error(`${definition.languageType}に実装がありません。`);
  }

  const names = Object.keys(inputs);
  const evaluator = new Function(
    ...names,
    `"use strict"; return (${definition.expression});`,
  );
  const result = evaluator(...Object.values(inputs));

  return definition.outputs.length === 1
    ? { [definition.outputs[0].id]: result }
    : {};
}
