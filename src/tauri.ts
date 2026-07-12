import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type {
  BuildResult,
  BuildSettings,
  FlowProgram,
} from "./types";

export const buildProgram = (
  program: FlowProgram,
  settings: BuildSettings,
) =>
  invoke<BuildResult>("build_program", {
    program,
    settings,
  });

export const loadInstalledPlugins = () =>
  invoke<string[]>("load_installed_plugins");

export async function selectBuildOutput(
  language: BuildSettings["language"],
): Promise<string | null> {
  const isExecutable =
    language === "rust" ||
    language === "tauri-gui";

  const defaultPath =
    language === "tauri-gui"
      ? "flow_gui_program.exe"
      : language === "rust"
        ? "flow_program.exe"
        : "flow_program.js";

  return save({
    defaultPath,
    filters: [
      {
        name: isExecutable
          ? language === "tauri-gui"
            ? "Tauri GUI Executable"
            : "Windows Console Executable"
          : "JavaScript",
        extensions: [
          isExecutable
            ? "exe"
            : "js",
        ],
      },
    ],
  });
}

export async function saveProjectFile(
  suggestedName: string,
  projectJson: string,
): Promise<string | null> {
  const path = await save({
    defaultPath: suggestedName.endsWith(".flsc")
      ? suggestedName
      : `${suggestedName}.flsc`,
    filters: [
      {
        name: "Flow Language Project",
        extensions: ["flsc"],
      },
    ],
  });

  if (!path) {
    return null;
  }

  await invoke("save_project_file", { path, projectJson });
  return path;
}

export async function openProjectFile(): Promise<{
  path: string;
  projectJson: string;
} | null> {
  const path = await open({
    multiple: false,
    directory: false,
    filters: [
      {
        name: "Flow Language Project",
        extensions: ["flsc"],
      },
    ],
  });

  if (!path || Array.isArray(path)) {
    return null;
  }

  return {
    path,
    projectJson: await invoke<string>("load_project_file", { path }),
  };
}
