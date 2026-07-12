import {
  useReactFlow,
  type NodeProps,
} from "@xyflow/react";
import type {
  EditorNode,
  GroupExecutionMode,
} from "./types";

export default function GroupNode({
  id,
  data,
  selected,
}: NodeProps<EditorNode>) {
  const { updateNodeData } =
    useReactFlow();

  const mode = String(
    data.executionMode ?? "group",
  ) as GroupExecutionMode;

  return (
    <div
      className={`group-node ${
        selected ? "is-selected" : ""
      } ${
        mode !== "group"
          ? "group-node--executable"
          : ""
      }`}
    >
      <div className="group-node__header">
        <input
          className="group-tag nodrag nopan"
          type="text"
          value={String(
            data.tag ?? "",
          )}
          placeholder="グループ名"
          onChange={(event) =>
            updateNodeData(id, {
              tag: event.target.value,
            })
          }
        />

        <select
          className="group-mode nodrag nopan"
          value={mode}
          onChange={(event) =>
            updateNodeData(id, {
              executionMode:
                event.target
                  .value as GroupExecutionMode,
            })
          }
          title="グループの実行方法"
        >
          <option value="group">
            通常グループ
          </option>
          <option value="while-key">
            キーまでWHILE
          </option>
          <option value="while-variable">
            変数条件WHILE
          </option>
          <option value="for-count">
            FOR回数
          </option>
          <option value="try-catch">
            TRY / CATCH
          </option>
        </select>
      </div>

      {mode !== "group" && (
        <div className="group-execution-settings nodrag nopan">
          {mode === "while-key" && (
            <>
              <label>
                <span>停止キー</span>
                <input
                  type="text"
                  maxLength={16}
                  value={String(
                    data.stopKey ??
                      "Escape",
                  )}
                  onChange={(event) =>
                    updateNodeData(id, {
                      stopKey:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label>
                <span>最大反復</span>
                <input
                  type="number"
                  min={1}
                  value={Number(
                    data.maxIterations ??
                      10000,
                  )}
                  onChange={(event) =>
                    updateNodeData(id, {
                      maxIterations:
                        Math.max(
                          1,
                          Number(
                            event.target
                              .value,
                          ) || 1,
                        ),
                    })
                  }
                />
              </label>
            </>
          )}

          {mode ===
            "while-variable" && (
            <>
              <label>
                <span>条件変数</span>
                <input
                  type="text"
                  value={String(
                    data.loopVariable ??
                      "running",
                  )}
                  onChange={(event) =>
                    updateNodeData(id, {
                      loopVariable:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label>
                <span>期待値</span>
                <select
                  value={String(
                    data.loopConditionValue ??
                      true,
                  )}
                  onChange={(event) =>
                    updateNodeData(id, {
                      loopConditionValue:
                        event.target
                          .value ===
                        "true",
                    })
                  }
                >
                  <option value="true">
                    True
                  </option>
                  <option value="false">
                    False
                  </option>
                </select>
              </label>

              <label>
                <span>最大反復</span>
                <input
                  type="number"
                  min={1}
                  value={Number(
                    data.maxIterations ??
                      10000,
                  )}
                  onChange={(event) =>
                    updateNodeData(id, {
                      maxIterations:
                        Math.max(
                          1,
                          Number(
                            event.target
                              .value,
                          ) || 1,
                        ),
                    })
                  }
                />
              </label>
            </>
          )}

          {mode === "for-count" && (
            <label>
              <span>反復回数</span>
              <input
                type="number"
                min={0}
                value={Number(
                  data.repeatCount ?? 10,
                )}
                onChange={(event) =>
                  updateNodeData(id, {
                    repeatCount:
                      Math.max(
                        0,
                        Math.floor(
                          Number(
                            event.target
                              .value,
                          ) || 0,
                        ),
                      ),
                  })
                }
              />
            </label>
          )}

          {mode === "try-catch" && (
            <label>
              <span>エラー変数</span>
              <input
                type="text"
                value={String(
                  data.errorVariable ??
                    "lastError",
                )}
                onChange={(event) =>
                  updateNodeData(id, {
                    errorVariable:
                      event.target.value,
                  })
                }
              />
            </label>
          )}

          <p>
            内側のノードをひとつの実行領域として扱います。
          </p>
        </div>
      )}
    </div>
  );
}
