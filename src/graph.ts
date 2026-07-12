import type { Connection, Viewport } from "@xyflow/react";
import type { NodeDefinition } from "./nodeDefinitions";
import type {
  AppTheme,
  EditorEdge,
  EditorNode,
  FlowProgram,
  FlowProject,
  PluginManifest,
  RuntimeDataType,
} from "./types";

function canAssign(
  sourceType: RuntimeDataType,
  targetType: RuntimeDataType,
): boolean {
  return (
    sourceType === targetType ||
    sourceType === "any" ||
    targetType === "any"
  );
}

export function isValidConnection(
  connection: Connection,
  nodes: EditorNode[],
  edges: EditorEdge[],
  definitions: Record<string, NodeDefinition>,
): boolean {
  if (
    !connection.source ||
    !connection.target ||
    !connection.sourceHandle ||
    !connection.targetHandle
  ) {
    return false;
  }

  if (connection.source === connection.target) {
    return false;
  }

  if (
    edges.some(
      (edge) =>
        edge.target === connection.target &&
        edge.targetHandle === connection.targetHandle,
    )
  ) {
    return false;
  }

  const sourceNode = nodes.find(
    (node) => node.id === connection.source,
  );
  const targetNode = nodes.find(
    (node) => node.id === connection.target,
  );

  if (!sourceNode || !targetNode) {
    return false;
  }

  const sourceDefinition =
    definitions[sourceNode.data.languageType];
  const targetDefinition =
    definitions[targetNode.data.languageType];

  if (!sourceDefinition || !targetDefinition) {
    return false;
  }

  const sourcePort = sourceDefinition.outputs.find(
    (port) => port.id === connection.sourceHandle,
  );
  const targetPort = targetDefinition.inputs.find(
    (port) => port.id === connection.targetHandle,
  );

  return (
    !!sourcePort &&
    !!targetPort &&
    canAssign(sourcePort.dataType, targetPort.dataType)
  );
}

export function serializeProgram(
  nodes: EditorNode[],
  edges: EditorEdge[],
  plugins: PluginManifest[],
  runtimeInputs: Record<string, number> = {},
): FlowProgram {
  const executableNodes = nodes.filter(
    (node) => node.type !== "group",
  );

  return {
    formatVersion: 3,
    nodes: executableNodes.map((node) => {
      const properties: Record<string, unknown> = {};

      for (const key of [
        "value",
        "prompt",
        "defaultValue",
        "executionOrder",
      ]) {
        const value = node.data[key];

        if (value !== undefined) {
          properties[key] = value;
        }
      }

      return {
        id: node.id,
        nodeType: node.data.languageType,
        position: node.position,
        properties,
      };
    }),
    connections: edges
      .filter(
        (edge) =>
          executableNodes.some(
            (node) => node.id === edge.source,
          ) &&
          executableNodes.some(
            (node) => node.id === edge.target,
          ),
      )
      .map((edge) => ({
        id: edge.id,
        sourceNode: edge.source,
        sourcePort: edge.sourceHandle ?? "",
        targetNode: edge.target,
        targetPort: edge.targetHandle ?? "",
      })),
    plugins,
    runtimeInputs,
  };
}

function cleanNode(node: EditorNode): EditorNode {
  const { definition: _definition, ...data } = node.data;

  return {
    ...node,
    selected: false,
    dragging: false,
    data,
  };
}

export function serializeProject(
  name: string,
  nodes: EditorNode[],
  edges: EditorEdge[],
  plugins: PluginManifest[],
  theme: AppTheme,
  viewport: Viewport,
): FlowProject {
  return {
    fileType: "flow-language-project",
    formatVersion: 1,
    name,
    nodes: nodes.map(cleanNode),
    edges: edges.map((edge) => ({
      ...edge,
      selected: false,
    })),
    plugins,
    theme,
    viewport,
  };
}

export function parseProject(text: string): FlowProject {
  const project = JSON.parse(text) as Partial<FlowProject>;

  if (
    project.fileType !== "flow-language-project" ||
    project.formatVersion !== 1 ||
    !Array.isArray(project.nodes) ||
    !Array.isArray(project.edges) ||
    !Array.isArray(project.plugins)
  ) {
    throw new Error(
      "有効なFlow Languageプロジェクトではありません。",
    );
  }

  return project as FlowProject;
}
