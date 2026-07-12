import type {
  PluginManifest,
  PluginModuleDefinition,
} from "./types";

type LoadedModule = {
  definition: PluginModuleDefinition;
  value: unknown;
};

const loadedModules = new Map<string, LoadedModule>();

function moduleKey(module: PluginModuleDefinition): string {
  return module.id;
}

export async function loadPluginModules(
  manifest: PluginManifest,
): Promise<string[]> {
  const loadedNow: string[] = [];

  for (const module of manifest.modules ?? []) {
    const key = moduleKey(module);
    const existing = loadedModules.get(key);

    if (existing) {
      if (
        existing.definition.version &&
        module.version &&
        existing.definition.version !== module.version
      ) {
        throw new Error(
          `モジュール ${module.id} のバージョンが競合しています: ` +
            `${existing.definition.version} / ${module.version}`,
        );
      }

      continue;
    }

    let value: unknown = null;

    switch (module.kind) {
      case "builtin":
        value = { id: module.id };
        break;

      case "webaudio": {
        const AudioContextClass =
          window.AudioContext ??
          (
            window as typeof window & {
              webkitAudioContext?: typeof AudioContext;
            }
          ).webkitAudioContext;

        if (!AudioContextClass) {
          throw new Error("この環境ではWeb Audio APIを利用できません。");
        }

        value = new AudioContextClass();
        break;
      }

      case "javascript":
        if (!module.source) {
          throw new Error(
            `JavaScriptモジュール ${module.id} にsourceがありません。`,
          );
        }

        value = await import(
          /* @vite-ignore */
          module.source
        );
        break;

      default:
        throw new Error(
          `未対応のモジュール形式です: ${String(module.kind)}`,
        );
    }

    loadedModules.set(key, {
      definition: module,
      value,
    });
    loadedNow.push(module.id);
  }

  for (const node of manifest.nodes) {
    for (const required of node.requiredModules ?? []) {
      if (!loadedModules.has(required)) {
        throw new Error(
          `${node.languageType} が要求するモジュール ${required} が読み込まれていません。`,
        );
      }
    }
  }

  return loadedNow;
}

export function getLoadedModuleIds(): string[] {
  return [...loadedModules.keys()];
}
