import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import {
  addEdge,
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  reconnectEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type ReactFlowInstance,
} from "@xyflow/react";

import FlowNode from "./FlowNode";
import NodeDocsPanel from "./NodeDocsPanel";
import ProfilerPanel from "./ProfilerPanel";
import PluginManagerPanel from "./PluginManagerPanel";
import GuiDesignerPanel from "./GuiDesignerPanel";
import DebuggerPanel from "./DebuggerPanel";
import ContextMenu, { type ContextAction } from "./ContextMenu";
import GroupNode from "./GroupNode";
import { createDefinitionMap } from "./nodeDefinitions";
import {
  parseProject,
  serializeProgram,
  serializeProject,
  isValidConnection,
} from "./graph";
import {
  createExecutionController,
  executeGraph,
  type ExecutionController,
} from "./graphExecutor";
import {
  getLoadedModuleIds,
  loadPluginModules,
} from "./pluginRuntime";
import {
  buildProgram,
  loadInstalledPlugins,
  openProjectFile,
  saveProjectFile,
  selectBuildOutput,
} from "./tauri";
import type {
  AppTheme,
  BuildLanguage,
  DebugMode,
  EditorEdge,
  EditorNode,
  PluginManifest,
  NodeProfileRecord,
} from "./types";

const initialNodes: EditorNode[] = [];
const initialEdges: EditorEdge[] = [];

function validatePlugin(plugin: PluginManifest): void {
  if (!plugin.id || !plugin.name || !plugin.version || !Array.isArray(plugin.nodes)) {
    throw new Error("不正なプラグインです。");
  }

  for (const node of plugin.nodes) {
    if (
      !node.languageType ||
      !node.title ||
      !Array.isArray(node.inputs) ||
      !Array.isArray(node.outputs) ||
      (!node.expression && !node.runtime)
    ) {
      throw new Error(`${plugin.name}に不正なノードがあります。`);
    }
  }
}

function Editor() {
  const [nodes, setNodes, onNodesChange] =
    useNodesState<EditorNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] =
    useEdgesState<EditorEdge>(initialEdges);
  const [plugins, setPlugins] = useState<PluginManifest[]>([]);
  const [logs, setLogs] = useState<string[]>(["起動しました。"]);
  const [status, setStatus] = useState("待機中");
  const [query, setQuery] = useState("");
  const [projectName, setProjectName] = useState("untitled");
  const [theme, setTheme] = useState<AppTheme>("dark");
  const [debugMode, setDebugMode] = useState<DebugMode>("normal");
  const [waitingNodeId, setWaitingNodeId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showBuildSettings, setShowBuildSettings] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [showProfiler, setShowProfiler] = useState(false);
  const [showPluginManager, setShowPluginManager] = useState(false);
  const [showGuiDesigner, setShowGuiDesigner] = useState(false);
  const [showDebugger, setShowDebugger] = useState(false);
  const [profileRecords, setProfileRecords] = useState<NodeProfileRecord[]>([]);
  const [buildLanguage, setBuildLanguage] =
    useState<BuildLanguage>("rust");
  const [buildOptimize, setBuildOptimize] = useState(true);
  const [buildPauseAtEnd, setBuildPauseAtEnd] = useState(false);
  const [running, setRunning] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; kind: "pane" | "node"; nodeId?: string } | null>(null);

  const reactFlowRef =
    useRef<ReactFlowInstance<EditorNode, EditorEdge> | null>(null);
  const debugControllerRef = useRef<ExecutionController | null>(null);
  const profileStartRef = useRef<Map<string, number>>(new Map());

  const definitions = useMemo(
    () => createDefinitionMap(plugins),
    [plugins],
  );

  const nextPrintOrder = useCallback(() => {
    const used = new Set(
      nodes
        .filter((node) => node.data.languageType === "core.print")
        .map((node) => Math.max(0, Math.floor(Number(node.data.executionOrder ?? 0)))),
    );

    let value = 0;
    while (used.has(value)) value += 1;
    return value;
  }, [nodes]);

  const changePrintOrder = useCallback(
    (nodeId: string, requested: number) => {
      const used = new Set(
        nodes
          .filter(
            (node) =>
              node.id !== nodeId &&
              node.data.languageType === "core.print",
          )
          .map((node) =>
            Math.max(0, Math.floor(Number(node.data.executionOrder ?? 0))),
          ),
      );

      let value = Math.max(0, Math.floor(requested));
      while (used.has(value)) value += 1;

      setNodes((current) =>
        current.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, executionOrder: value } }
            : node,
        ),
      );

      if (value !== requested) {
        setStatus(`実行順序${requested}は使用中のため${value}へ変更しました`);
      }
    },
    [nodes, setNodes],
  );

  const decoratedNodes = useMemo(
    () =>
      nodes.map((node) =>
        node.type === "group"
          ? node
          : {
              ...node,
              data: {
                ...node.data,
                definition: definitions[node.data.languageType],
                callbacks: {
                  onExecutionOrderChange: changePrintOrder,
                },
              },
            },
      ),
    [changePrintOrder, definitions, nodes],
  );

  const nodeTypes = useMemo(
    () => ({ flowNode: FlowNode, group: GroupNode }),
    [],
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const block = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (
        key === "f12" ||
        (event.ctrlKey && event.shiftKey && ["i", "j", "c"].includes(key)) ||
        (event.ctrlKey && key === "u")
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const closeMenu = () => setContextMenu(null);

    const blockContextMenu = (
      event: MouseEvent,
    ) => {
      event.preventDefault();
    };

    window.addEventListener(
      "keydown",
      block,
      true,
    );

    window.addEventListener(
      "pointerdown",
      closeMenu,
    );

    document.addEventListener(
      "contextmenu",
      blockContextMenu,
      true,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        block,
        true,
      );

      window.removeEventListener(
        "pointerdown",
        closeMenu,
      );

      document.removeEventListener(
        "contextmenu",
        blockContextMenu,
        true,
      );
    };
  }, []);

  const installPlugin = useCallback(async (plugin: PluginManifest) => {
    validatePlugin(plugin);
    const normalized = {
      ...plugin,
      enabled: plugin.enabled !== false,
    };

    if (normalized.enabled) {
      await loadPluginModules(normalized);
    }

    setPlugins((current) => [
      ...current.filter((item) => item.id !== normalized.id),
      normalized,
    ]);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const files = await loadInstalledPlugins();

        for (const text of files) {
          await installPlugin(JSON.parse(text) as PluginManifest);
        }

        setLogs([
          `起動時プラグイン: ${files.length}個`,
          `モジュール: ${getLoadedModuleIds().join(", ") || "なし"}`,
        ]);
      } catch (error) {
        setLogs([`自動プラグイン読込エラー: ${String(error)}`]);
      }
    })();
  }, [installPlugin]);

  const addNodeAt = useCallback(
    (languageType: string, position: { x: number; y: number }) => {
      const definition = definitions[languageType];
      if (!definition) return;

      const properties = { ...definition.defaultProperties };
      if (languageType === "core.print") {
        properties.executionOrder = nextPrintOrder();
      }

      setNodes((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          type: "flowNode",
          position,
          data: {
            languageType,
            title: definition.title,
            ...properties,
          },
        },
      ]);
    },
    [definitions, nextPrintOrder, setNodes],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!isValidConnection(connection, nodes, edges, definitions)) {
        setStatus("接続できません。");
        return;
      }

      setEdges((current) =>
        addEdge(
          {
            ...connection,
            markerEnd: { type: MarkerType.ArrowClosed },
          },
          current,
        ),
      );
    },
    [definitions, edges, nodes, setEdges],
  );

  const run = useCallback(async () => {
    setRunning(true);
    setWaitingNodeId(null);
    setLogs([]);
    setStatus("実行中");

    const debug = createExecutionController();
    debugControllerRef.current = debug.controller;

    try {
      await executeGraph(
        {
          nodes,
          edges,
          definitions,
          plugins,
          mode: debugMode,
          onLog(message) {
            setLogs((current) => [...current, message]);
          },
          onWaiting(nodeId) {
            setWaitingNodeId(nodeId);
            setStatus(`停止中: ${nodeId}`);
          },
          onEvent(event) {
            const now = performance.now();

            if (event.phase === "before") {
              profileStartRef.current.set(event.nodeId, now);
            } else {
              const started = profileStartRef.current.get(event.nodeId) ?? now;
              const elapsed = Math.max(0, now - started);
              profileStartRef.current.delete(event.nodeId);

              const sourceNode = nodes.find((node) => node.id === event.nodeId);

              setProfileRecords((current) => {
                const existing = current.find((item) => item.nodeId === event.nodeId);

                if (!existing) {
                  return [
                    ...current,
                    {
                      nodeId: event.nodeId,
                      title: String(sourceNode?.data.title ?? event.nodeId),
                      languageType: String(
                        sourceNode?.data.languageType ?? "unknown",
                      ),
                      calls: 1,
                      totalMs: elapsed,
                      lastMs: elapsed,
                      maxMs: elapsed,
                      errors: event.phase === "error" ? 1 : 0,
                    },
                  ];
                }

                return current.map((item) =>
                  item.nodeId === event.nodeId
                    ? {
                        ...item,
                        calls: item.calls + 1,
                        totalMs: item.totalMs + elapsed,
                        lastMs: elapsed,
                        maxMs: Math.max(item.maxMs, elapsed),
                        errors:
                          item.errors + (event.phase === "error" ? 1 : 0),
                      }
                    : item,
                );
              });
            }

            setNodes((current) =>
              current.map((node) =>
                node.id === event.nodeId
                  ? {
                      ...node,
                      data: {
                        ...node.data,
                        runningState:
                          event.phase === "before"
                            ? "running"
                            : event.phase === "after"
                              ? "done"
                              : "error",
                      },
                    }
                  : node,
              ),
            );
          },
        },
        debug,
      );

      setStatus("実行完了");
    } catch (error) {
      setLogs((current) => [...current, `エラー: ${String(error)}`]);
      setStatus("実行停止");
    } finally {
      setRunning(false);
      setWaitingNodeId(null);
      debugControllerRef.current = null;
    }
  }, [debugMode, definitions, edges, nodes, plugins, setNodes]);

  const togglePlugin = useCallback(
    async (pluginId: string, enabled: boolean) => {
      const plugin = plugins.find((item) => item.id === pluginId);
      if (!plugin) return;

      const updated = { ...plugin, enabled };

      if (enabled) {
        await loadPluginModules(updated);
      }

      setPlugins((current) =>
        current.map((item) => (item.id === pluginId ? updated : item)),
      );
      setStatus(`${plugin.name}を${enabled ? "有効" : "無効"}にしました`);
    },
    [plugins],
  );

  const saveProject = useCallback(async () => {
    const instance = reactFlowRef.current;
    if (!instance) return;

    const project = serializeProject(
      projectName,
      nodes,
      edges,
      plugins,
      theme,
      instance.getViewport(),
    );

    const path = await saveProjectFile(
      `${projectName}.flsc`,
      JSON.stringify(project, null, 2),
    );

    if (path) setStatus("保存完了");
  }, [edges, nodes, plugins, projectName, theme]);

  const loadProject = useCallback(async () => {
    const result = await openProjectFile();
    if (!result) return;

    const project = parseProject(result.projectJson);

    for (const plugin of project.plugins) {
      await installPlugin(plugin);
    }

    setPlugins(project.plugins);
    setNodes(project.nodes);
    setEdges(project.edges);
    setTheme(project.theme);
    setProjectName(project.name);
    requestAnimationFrame(() =>
      reactFlowRef.current?.setViewport(project.viewport, { duration: 0 }),
    );
  }, [installPlugin, setEdges, setNodes]);

  const build = useCallback(async () => {
    const outputPath = await selectBuildOutput(buildLanguage);
    if (!outputPath) return;

    const result = await buildProgram(
      serializeProgram(nodes, edges, plugins),
      {
        language: buildLanguage,
        outputPath,
        optimize: buildOptimize,
        pauseAtEnd: buildPauseAtEnd,
      },
    );

    setLogs([result.success ? `生成完了: ${result.outputPath}` : `生成失敗: ${result.error}`]);
  }, [
    buildLanguage,
    buildOptimize,
    buildPauseAtEnd,
    edges,
    nodes,
    plugins,
  ]);

  const groupedDefinitions = useMemo(() => {
    const tokens = query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    const map = new Map<string, typeof definitions[string][]>();

    for (const definition of Object.values(definitions)) {
      const haystack = [
        definition.title,
        definition.category,
        definition.languageType,
        definition.description,
        ...definition.inputs.map((port) => `${port.label} ${port.dataType}`),
        ...definition.outputs.map((port) => `${port.label} ${port.dataType}`),
      ]
        .join(" ")
        .toLowerCase();

      const matches = tokens.every((token) => {
        if (token.startsWith("category:")) {
          return definition.category
            .toLowerCase()
            .includes(token.slice("category:".length));
        }

        if (token.startsWith("type:")) {
          return definition.languageType
            .toLowerCase()
            .includes(token.slice("type:".length));
        }

        if (token.startsWith("input:")) {
          return definition.inputs.some((port) =>
            `${port.label} ${port.dataType}`
              .toLowerCase()
              .includes(token.slice("input:".length)),
          );
        }

        if (token.startsWith("output:")) {
          return definition.outputs.some((port) =>
            `${port.label} ${port.dataType}`
              .toLowerCase()
              .includes(token.slice("output:".length)),
          );
        }

        return haystack.includes(token);
      });

      if (!matches) {
        continue;
      }

      map.set(definition.category, [
        ...(map.get(definition.category) ?? []),
        definition,
      ]);
    }

    return map;
  }, [definitions, query]);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const type =
        event.dataTransfer.getData("application/reactflow") ||
        event.dataTransfer.getData("text/plain");
      const instance = reactFlowRef.current;
      if (!type || !instance) return;

      addNodeAt(
        type,
        instance.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        }),
      );
    },
    [addNodeAt],
  );



  const duplicateSelected = useCallback(() => {
    const selected = nodes.filter(
      (node) => node.selected,
    );

    if (selected.length === 0) {
      setStatus("複製するノードを選択してください");
      return;
    }

    const idMap = new Map(
      selected.map((node) => [
        node.id,
        crypto.randomUUID(),
      ]),
    );

    const copies = selected.map((node) => ({
      ...node,
      id: idMap.get(node.id)!,
      selected: false,
      parentId: node.parentId
        ? idMap.get(node.parentId)
        : undefined,
      position: {
        x: node.position.x + 40,
        y: node.position.y + 40,
      },
    }));

    const copiedEdges = edges
      .filter(
        (edge) =>
          idMap.has(edge.source) &&
          idMap.has(edge.target),
      )
      .map((edge) => ({
        ...edge,
        id: crypto.randomUUID(),
        source: idMap.get(edge.source)!,
        target: idMap.get(edge.target)!,
        selected: false,
      }));

    setNodes((current) => [
      ...current,
      ...copies,
    ]);

    setEdges((current) => [
      ...current,
      ...copiedEdges,
    ]);

    setStatus(
      `${copies.length}個のノードを複製しました`,
    );
  }, [
    edges,
    nodes,
    setEdges,
    setNodes,
  ]);

  const groupSelected = useCallback(() => {
    const selected = nodes.filter(
      (node) =>
        node.selected &&
        node.type !== "group" &&
        !node.parentId,
    );

    if (selected.length < 2) {
      setStatus(
        "2個以上の未グループ化ノードを選択してください",
      );
      return;
    }

    const minX =
      Math.min(
        ...selected.map(
          (node) => node.position.x,
        ),
      ) - 40;

    const minY =
      Math.min(
        ...selected.map(
          (node) => node.position.y,
        ),
      ) - 60;

    const maxX =
      Math.max(
        ...selected.map(
          (node) =>
            node.position.x +
            (node.measured?.width ?? 190),
        ),
      ) + 40;

    const maxY =
      Math.max(
        ...selected.map(
          (node) =>
            node.position.y +
            (node.measured?.height ?? 120),
        ),
      ) + 40;

    const groupId = crypto.randomUUID();

    const group: EditorNode = {
      id: groupId,
      type: "group",
      position: {
        x: minX,
        y: minY,
      },
      style: {
        width: maxX - minX,
        height: maxY - minY,
      },
      data: {
        languageType: "ui.group",
        title: "Group",
        tag: "新しいグループ",
      },
    };

    setNodes((current) => [
      group,
      ...current.map((node) =>
        selected.some(
          (selectedNode) =>
            selectedNode.id === node.id,
        )
          ? {
              ...node,
              parentId: groupId,
              extent: "parent" as const,
              position: {
                x: node.position.x - minX,
                y: node.position.y - minY,
              },
              selected: false,
            }
          : node,
      ),
    ]);

    setStatus("グループを作成しました");
  }, [
    nodes,
    setNodes,
  ]);


  const createExecutableGroup = useCallback(
    (
      executionMode:
        | "while-key"
        | "while-variable"
        | "for-count"
        | "try-catch",
    ) => {
      const selected = nodes.filter(
        (node) =>
          node.selected &&
          node.type !== "group" &&
          !node.parentId,
      );

      if (selected.length === 0) {
        setStatus(
          "グループに入れるノードを選択してください",
        );
        return;
      }

      const minX =
        Math.min(
          ...selected.map(
            (node) =>
              node.position.x,
          ),
        ) - 40;

      const minY =
        Math.min(
          ...selected.map(
            (node) =>
              node.position.y,
          ),
        ) - 80;

      const maxX =
        Math.max(
          ...selected.map(
            (node) =>
              node.position.x +
              (node.measured?.width ??
                190),
          ),
        ) + 40;

      const maxY =
        Math.max(
          ...selected.map(
            (node) =>
              node.position.y +
              (node.measured?.height ??
                120),
          ),
        ) + 60;

      const groupId =
        crypto.randomUUID();

      const names = {
        "while-key":
          "WHILE（キー停止）",
        "while-variable":
          "WHILE（変数条件）",
        "for-count":
          "FORループ",
        "try-catch":
          "TRY / CATCH",
      };

      const group: EditorNode = {
        id: groupId,
        type: "group",
        position: {
          x: minX,
          y: minY,
        },
        style: {
          width: maxX - minX,
          height: maxY - minY,
        },
        data: {
          languageType:
            "ui.group",
          title: "Group",
          tag:
            names[executionMode],
          executionMode,
          stopKey: "Escape",
          maxIterations: 10000,
          loopVariable:
            "running",
          loopConditionValue:
            true,
          repeatCount: 10,
          errorVariable:
            "lastError",
        },
      };

      setNodes((current) => [
        group,
        ...current.map((node) =>
          selected.some(
            (selectedNode) =>
              selectedNode.id ===
              node.id,
          )
            ? {
                ...node,
                parentId: groupId,
                extent:
                  "parent" as const,
                position: {
                  x:
                    node.position.x -
                    minX,
                  y:
                    node.position.y -
                    minY,
                },
                selected: false,
              }
            : node,
        ),
      ]);

      setStatus(
        `${names[executionMode]}を作成しました`,
      );
    },
    [
      nodes,
      setNodes,
    ],
  );

  const deleteSelected = useCallback(() => {
    const selectedIds = new Set(
      nodes.filter((node) => node.selected).map((node) => node.id),
    );

    setNodes((current) => current.filter((node) => !selectedIds.has(node.id)));
    setEdges((current) =>
      current.filter(
        (edge) =>
          !selectedIds.has(edge.source) &&
          !selectedIds.has(edge.target),
      ),
    );
  }, [nodes, setEdges, setNodes]);

  const contextActions = useMemo<ContextAction[]>(() => {
    if (!contextMenu) return [];

    const close = (run: () => void) => () => {
      run();
      setContextMenu(null);
    };

    return [
      {
        id: "duplicate",
        label: "複製",
        disabled: !nodes.some((node) => node.selected),
        run: close(duplicateSelected),
      },
      {
        id: "group",
        label: "通常グループ化",
        disabled:
          nodes.filter(
            (node) =>
              node.selected,
          ).length < 2,
        run: close(groupSelected),
      },
      {
        id: "while-key",
        label:
          "WHILEグループ（キー停止）",
        disabled:
          !nodes.some(
            (node) =>
              node.selected,
          ),
        run: close(() =>
          createExecutableGroup(
            "while-key",
          ),
        ),
      },
      {
        id: "while-variable",
        label:
          "WHILEグループ（変数条件）",
        disabled:
          !nodes.some(
            (node) =>
              node.selected,
          ),
        run: close(() =>
          createExecutableGroup(
            "while-variable",
          ),
        ),
      },
      {
        id: "for-count",
        label: "FORグループ",
        disabled:
          !nodes.some(
            (node) =>
              node.selected,
          ),
        run: close(() =>
          createExecutableGroup(
            "for-count",
          ),
        ),
      },
      {
        id: "try-catch",
        label: "TRY/CATCHグループ",
        disabled:
          !nodes.some(
            (node) =>
              node.selected,
          ),
        run: close(() =>
          createExecutableGroup(
            "try-catch",
          ),
        ),
      },
      {
        id: "delete",
        label: "削除",
        danger: true,
        disabled: !nodes.some((node) => node.selected),
        run: close(deleteSelected),
      },
    ];
  }, [
    contextMenu,
    createExecutableGroup,
    deleteSelected,
    duplicateSelected,
    groupSelected,
    nodes,
  ]);

  return (
    <main className="app-shell">
      <header className="toolbar">
        <div className="toolbar__title">
          <h1>Flow Language</h1>
          <p>{projectName}.flsc — {status}</p>
        </div>

        <div className="toolbar__actions">
          <button onClick={loadProject}>開く</button>
          <button onClick={saveProject}>保存</button>
          <select
            value={debugMode}
            onChange={(event) =>
              setDebugMode(event.target.value as DebugMode)
            }
          >
            <option value="normal">通常実行</option>
            <option value="step-from-start">最初から順番</option>
            <option value="step-from-breakpoint">ブレークポイントから順番</option>
          </select>

          {waitingNodeId && (
            <>
              <button onClick={() => debugControllerRef.current?.next()}>
                次へ
              </button>
              <button onClick={() => debugControllerRef.current?.continue()}>
                続行
              </button>
              <button onClick={() => debugControllerRef.current?.stop()}>
                停止
              </button>
            </>
          )}

          <button onClick={() => setShowDocs(true)}>ノード資料</button>
          <button onClick={() => setShowDebugger(true)}>デバッガー</button>
          <button onClick={() => setShowProfiler(true)}>プロファイラー</button>
          <button onClick={() => setShowGuiDesigner(true)}>GUI Designer</button>
          <button onClick={() => setShowPluginManager(true)}>パッケージ</button>
          <button onClick={() => setShowSettings(true)}>設定</button>
          <button onClick={() => setShowBuildSettings(true)}>出力設定</button>
          <button
            className="button-primary"
            disabled={running}
            onClick={run}
          >
            実行
          </button>
        </div>
      </header>

      <section className="workspace">
        <aside className="sidebar">
          <input
            className="node-search"
            placeholder="検索… category:GUI type:async input:string"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          {[...groupedDefinitions].map(([category, items]) => (
            <section className="node-category" key={category}>
              <h2>{category}</h2>
              {items.map((definition) => (
                <div
                  draggable
                  className="node-button"
                  key={definition.languageType}
                  onDragStart={(event) => {
                    event.dataTransfer.setData(
                      "application/reactflow",
                      definition.languageType,
                    );
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                >
                  <strong>{definition.title}</strong>
                  <span>{definition.languageType}</span>
                </div>
              ))}
            </section>
          ))}
        </aside>

        <div
          className="canvas"
          onContextMenu={(event) => {
            event.preventDefault();
          }}
          onDragOver={(event) =>
            event.preventDefault()
          }
          onDrop={onDrop}
        >
          <ReactFlow<EditorNode, EditorEdge>
            nodes={decoratedNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onInit={(instance) => {
              reactFlowRef.current = instance;
            }}
            onPaneContextMenu={(event) => {
              event.preventDefault();
              setContextMenu({
                x: event.clientX,
                y: event.clientY,
                kind: "pane",
              });
            }}
            onNodeContextMenu={(
              event,
              node,
            ) => {
              event.preventDefault();
              event.stopPropagation();

              setNodes((current) => {
                const target =
                  current.find(
                    (item) =>
                      item.id ===
                      node.id,
                  );

                if (target?.selected) {
                  return current;
                }

                return current.map(
                  (item) => ({
                    ...item,
                    selected:
                      item.id ===
                      node.id,
                  }),
                );
              });

              setContextMenu({
                x: event.clientX,
                y: event.clientY,
                kind: "node",
                nodeId: node.id,
              });
            }}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onReconnect={(oldEdge: Edge, connection: Connection) =>
              setEdges((current) =>
                reconnectEdge(oldEdge, connection, current),
              )
            }
            onEdgeDoubleClick={(_event, edge) =>
              setEdges((current) =>
                current.filter((item) => item.id !== edge.id),
              )
            }
            edgesReconnectable
            selectionOnDrag
            selectionMode={SelectionMode.Partial}
            panOnDrag={[1]}
            panActivationKeyCode={null}
            deleteKeyCode={["Backspace", "Delete"]}
            fitView
          >
            <Background gap={20} size={1} />
            <MiniMap pannable zoomable />
            <Controls />
          </ReactFlow>
        </div>

        <aside className="log-panel">
          <h2>実行ログ</h2>
          <pre>{logs.join("\n")}</pre>
        </aside>
      </section>

      {showDocs && (
        <NodeDocsPanel
          definitions={definitions}
          onClose={() => setShowDocs(false)}
        />
      )}

      {showProfiler && (
        <ProfilerPanel
          records={profileRecords}
          onClear={() => setProfileRecords([])}
          onClose={() => setShowProfiler(false)}
        />
      )}

      {showPluginManager && (
        <PluginManagerPanel
          onChanged={() => window.location.reload()}
          onClose={() => setShowPluginManager(false)}
        />
      )}

      {showGuiDesigner && (
        <GuiDesignerPanel
          nodes={nodes}
          onClose={() => setShowGuiDesigner(false)}
        />
      )}

      {showDebugger && (
        <DebuggerPanel
          nodes={nodes}
          waitingNodeId={waitingNodeId}
          logs={logs}
          onClose={() => setShowDebugger(false)}
        />
      )}

      {showSettings && (
        <div className="modal-backdrop" onMouseDown={() => setShowSettings(false)}>
          <section className="settings-dialog" onMouseDown={(e) => e.stopPropagation()}>
            <h2>設定</h2>

            <label>
              <span>テーマ</span>
              <select value={theme} onChange={(e) => setTheme(e.target.value as AppTheme)}>
                <option value="dark">ダーク</option>
                <option value="light">ライト</option>
              </select>
            </label>

            <h3>プラグイン</h3>
            <div className="plugin-settings-list">
              {plugins.length === 0 && <p>プラグインはありません。</p>}
              {plugins.map((plugin) => (
                <label className="plugin-setting-row" key={plugin.id}>
                  <input
                    type="checkbox"
                    checked={plugin.enabled !== false}
                    onChange={(event) =>
                      void togglePlugin(plugin.id, event.target.checked)
                    }
                  />
                  <span>
                    <strong>{plugin.name}</strong>
                    <small>{plugin.id} / {plugin.version}</small>
                  </span>
                </label>
              ))}
            </div>

            <div className="dialog-actions">
              <button onClick={() => setShowSettings(false)}>閉じる</button>
            </div>
          </section>
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={contextActions}
        />
      )}

      {showBuildSettings && (
        <div className="modal-backdrop" onMouseDown={() => setShowBuildSettings(false)}>
          <section className="settings-dialog" onMouseDown={(e) => e.stopPropagation()}>
            <h2>出力設定</h2>
            <label>
              <span>出力言語</span>
              <select
                value={buildLanguage}
                onChange={(e) => setBuildLanguage(e.target.value as BuildLanguage)}
              >
                <option value="rust">Rust / EXE</option>
                <option value="javascript">JavaScript</option>
              </select>
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={buildOptimize}
                onChange={(e) => setBuildOptimize(e.target.checked)}
              />
              最適化
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={buildPauseAtEnd}
                onChange={(e) => setBuildPauseAtEnd(e.target.checked)}
              />
              終了待機
            </label>
            <div className="dialog-actions">
              <button onClick={() => setShowBuildSettings(false)}>キャンセル</button>
              <button className="button-primary" onClick={build}>生成</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <Editor />
    </ReactFlowProvider>
  );
}
