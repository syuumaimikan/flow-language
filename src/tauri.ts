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
  const isRust = language === "rust";

  return save({
    defaultPath: isRust ? "flow_program.exe" : "flow_program.js",
    filters: [
      {
        name: isRust ? "Windows Executable" : "JavaScript",
        extensions: [isRust ? "exe" : "js"],
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
