import {
  Handle,
  Position,
  useReactFlow,
  type NodeProps,
} from "@xyflow/react";
import {
  useEffect,
  useMemo,
  useState,
  type CompositionEvent,
} from "react";
import type { NodeDefinition } from "./nodeDefinitions";
import type { EditorNode } from "./types";

type NodeCallbacks = {
  onExecutionOrderChange?: (
    nodeId: string,
    value: number,
  ) => void;
};

type ValueKind =
  | "string"
  | "number"
  | "boolean"
  | "null"
  | "json";

function valueKind(
  value: unknown,
): ValueKind {
  if (value === null) {
    return "null";
  }

  if (typeof value === "number") {
    return "number";
  }

  if (typeof value === "boolean") {
    return "boolean";
  }

  if (
    typeof value === "object"
  ) {
    return "json";
  }

  return "string";
}

function valueToDraft(
  value: unknown,
  kind: ValueKind,
): string {
  if (kind === "null") {
    return "";
  }

  if (kind === "json") {
    return JSON.stringify(
      value,
      null,
      2,
    );
  }

  return String(value ?? "");
}

function parseDraftValue(
  draft: string,
  kind: ValueKind,
): unknown {
  switch (kind) {
    case "number": {
      const value = Number(draft);

      if (!Number.isFinite(value)) {
        throw new Error(
          "数値を入力してください。",
        );
      }

      return value;
    }

    case "boolean":
      return draft === "true";

    case "null":
      return null;

    case "json":
      return JSON.parse(draft);

    default:
      return draft;
  }
}

function ImeTextInput({
  value,
  onCommit,
  className = "node-input nodrag nopan",
  type = "text",
  placeholder,
}: {
  value: string;
  onCommit(value: string): void;
  className?: string;
  type?: "text" | "number";
  placeholder?: string;
}) {
  const [draft, setDraft] =
    useState(value);
  const [composing, setComposing] =
    useState(false);

  useEffect(() => {
    if (!composing) {
      setDraft(value);
    }
  }, [value, composing]);

  const commit = (
    next: string,
  ) => {
    setDraft(next);
    onCommit(next);
  };

  return (
    <input
      className={className}
      type={type}
      value={draft}
      placeholder={placeholder}
      onCompositionStart={() =>
        setComposing(true)
      }
      onCompositionEnd={(
        event:
          CompositionEvent<
            HTMLInputElement
          >,
      ) => {
        setComposing(false);
        commit(
          event.currentTarget.value,
        );
      }}
      onChange={(event) => {
        const next =
          event.target.value;

        setDraft(next);

        if (
          !composing &&
          !(event.nativeEvent as InputEvent)
            .isComposing
        ) {
          onCommit(next);
        }
      }}
      onBlur={() => {
        if (!composing) {
          onCommit(draft);
        }
      }}
    />
  );
}

function ImeTextarea({
  value,
  onCommit,
  className,
  placeholder,
}: {
  value: string;
  onCommit(value: string): void;
  className: string;
  placeholder?: string;
}) {
  const [draft, setDraft] =
    useState(value);
  const [composing, setComposing] =
    useState(false);

  useEffect(() => {
    if (!composing) {
      setDraft(value);
    }
  }, [value, composing]);

  return (
    <textarea
      className={className}
      value={draft}
      placeholder={placeholder}
      onCompositionStart={() =>
        setComposing(true)
      }
      onCompositionEnd={(
        event:
          CompositionEvent<
            HTMLTextAreaElement
          >,
      ) => {
        const next =
          event.currentTarget.value;

        setComposing(false);
        setDraft(next);
        onCommit(next);
      }}
      onChange={(event) => {
        const next =
          event.target.value;

        setDraft(next);

        if (
          !composing &&
          !(event.nativeEvent as InputEvent)
            .isComposing
        ) {
          onCommit(next);
        }
      }}
      onBlur={() => {
        if (!composing) {
          onCommit(draft);
        }
      }}
    />
  );
}

function TypedValueEditor({
  value,
  onChange,
}: {
  value: unknown;
  onChange(value: unknown): void;
}) {
  const [kind, setKind] =
    useState<ValueKind>(
      valueKind(value),
    );

  const [draft, setDraft] =
    useState(
      valueToDraft(
        value,
        valueKind(value),
      ),
    );

  const [error, setError] =
    useState("");

  useEffect(() => {
    const nextKind =
      valueKind(value);

    setKind(nextKind);
    setDraft(
      valueToDraft(
        value,
        nextKind,
      ),
    );
    setError("");
  }, [value]);

  const commit = (
    nextDraft: string,
    nextKind = kind,
  ) => {
    setDraft(nextDraft);

    try {
      onChange(
        parseDraftValue(
          nextDraft,
          nextKind,
        ),
      );
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : String(cause),
      );
    }
  };

  return (
    <div className="typed-value-editor">
      <select
        className="typed-value-kind nodrag nopan"
        value={kind}
        onChange={(event) => {
          const nextKind =
            event.target
              .value as ValueKind;

          setKind(nextKind);

          const nextDraft =
            nextKind === "boolean"
              ? "false"
              : nextKind ===
                    "null"
                ? ""
                : nextKind ===
                      "json"
                  ? "{}"
                  : "";

          commit(
            nextDraft,
            nextKind,
          );
        }}
      >
        <option value="string">
          文字列
        </option>
        <option value="number">
          数値
        </option>
        <option value="boolean">
          真偽値
        </option>
        <option value="null">
          Null
        </option>
        <option value="json">
          JSON
        </option>
      </select>

      {kind === "boolean" ? (
        <select
          className="typed-value-input nodrag nopan"
          value={draft}
          onChange={(event) =>
            commit(
              event.target.value,
            )
          }
        >
          <option value="true">
            True
          </option>
          <option value="false">
            False
          </option>
        </select>
      ) : kind === "null" ? (
        <span className="typed-null">
          null
        </span>
      ) : kind === "json" ? (
        <ImeTextarea
          className="typed-json nodrag nopan"
          value={draft}
          onCommit={commit}
        />
      ) : (
        <ImeTextInput
          className="typed-value-input nodrag nopan"
          type={
            kind === "number"
              ? "number"
              : "text"
          }
          value={draft}
          onCommit={commit}
        />
      )}

      {error && (
        <span className="value-error">
          {error}
        </span>
      )}
    </div>
  );
}

function ArrayEditor({
  value,
  onChange,
}: {
  value: unknown;
  onChange(value: unknown[]): void;
}) {
  const items = Array.isArray(value)
    ? value
    : [];

  const [rawMode, setRawMode] =
    useState(false);

  const [raw, setRaw] =
    useState(
      JSON.stringify(
        items,
        null,
        2,
      ),
    );

  const [rawError, setRawError] =
    useState("");

  useEffect(() => {
    setRaw(
      JSON.stringify(
        items,
        null,
        2,
      ),
    );
  }, [value]);

  const updateAt = (
    index: number,
    nextValue: unknown,
  ) => {
    const next = [...items];
    next[index] = nextValue;
    onChange(next);
  };

  return (
    <div className="collection-editor">
      <div className="collection-toolbar">
        <strong>
          配列（{items.length}件）
        </strong>

        <div>
          <button
            type="button"
            className="nodrag nopan"
            onClick={() =>
              setRawMode(
                (current) =>
                  !current,
              )
            }
          >
            {rawMode
              ? "行編集"
              : "JSON編集"}
          </button>

          {!rawMode && (
            <button
              type="button"
              className="nodrag nopan"
              onClick={() =>
                onChange([
                  ...items,
                  "",
                ])
              }
            >
              ＋追加
            </button>
          )}
        </div>
      </div>

      {rawMode ? (
        <>
          <ImeTextarea
            className="node-textarea collection-raw nodrag nopan"
            value={raw}
            onCommit={(next) => {
              setRaw(next);

              try {
                const parsed =
                  JSON.parse(next);

                if (
                  !Array.isArray(
                    parsed,
                  )
                ) {
                  throw new Error(
                    "配列JSONを入力してください。",
                  );
                }

                onChange(parsed);
                setRawError("");
              } catch (cause) {
                setRawError(
                  cause instanceof Error
                    ? cause.message
                    : String(cause),
                );
              }
            }}
          />

          {rawError && (
            <span className="value-error">
              {rawError}
            </span>
          )}
        </>
      ) : (
        <div className="collection-rows">
          {items.length === 0 && (
            <p className="collection-empty">
              「＋追加」で要素を追加できます。
            </p>
          )}

          {items.map(
            (item, index) => (
              <div
                className="collection-row"
                key={index}
              >
                <span className="collection-index">
                  {index}
                </span>

                <TypedValueEditor
                  value={item}
                  onChange={(
                    next,
                  ) =>
                    updateAt(
                      index,
                      next,
                    )
                  }
                />

                <div className="collection-row-actions">
                  <button
                    type="button"
                    className="nodrag nopan"
                    title="上へ"
                    disabled={
                      index === 0
                    }
                    onClick={() => {
                      const next = [
                        ...items,
                      ];

                      [
                        next[index - 1],
                        next[index],
                      ] = [
                        next[index],
                        next[index - 1],
                      ];

                      onChange(next);
                    }}
                  >
                    ↑
                  </button>

                  <button
                    type="button"
                    className="nodrag nopan"
                    title="下へ"
                    disabled={
                      index ===
                      items.length - 1
                    }
                    onClick={() => {
                      const next = [
                        ...items,
                      ];

                      [
                        next[index],
                        next[index + 1],
                      ] = [
                        next[index + 1],
                        next[index],
                      ];

                      onChange(next);
                    }}
                  >
                    ↓
                  </button>

                  <button
                    type="button"
                    className="nodrag nopan danger-mini"
                    title="削除"
                    onClick={() =>
                      onChange(
                        items.filter(
                          (
                            _,
                            itemIndex,
                          ) =>
                            itemIndex !==
                            index,
                        ),
                      )
                    }
                  >
                    ×
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function ObjectEditor({
  value,
  onChange,
}: {
  value: unknown;
  onChange(
    value: Record<
      string,
      unknown
    >,
  ): void;
}) {
  const object =
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
      ? (value as Record<
          string,
          unknown
        >)
      : {};

  const entries =
    Object.entries(object);

  const [rawMode, setRawMode] =
    useState(false);

  const [raw, setRaw] =
    useState(
      JSON.stringify(
        object,
        null,
        2,
      ),
    );

  const [rawError, setRawError] =
    useState("");

  useEffect(() => {
    setRaw(
      JSON.stringify(
        object,
        null,
        2,
      ),
    );
  }, [value]);

  const replaceEntry = (
    index: number,
    nextKey: string,
    nextValue: unknown,
  ) => {
    const nextEntries =
      entries.map(
        (
          [key, entryValue],
          entryIndex,
        ) =>
          entryIndex === index
            ? [
                nextKey,
                nextValue,
              ]
            : [
                key,
                entryValue,
              ],
      );

    onChange(
      Object.fromEntries(
        nextEntries,
      ),
    );
  };

  return (
    <div className="collection-editor">
      <div className="collection-toolbar">
        <strong>
          オブジェクト（
          {entries.length}項目）
        </strong>

        <div>
          <button
            type="button"
            className="nodrag nopan"
            onClick={() =>
              setRawMode(
                (current) =>
                  !current,
              )
            }
          >
            {rawMode
              ? "項目編集"
              : "JSON編集"}
          </button>

          {!rawMode && (
            <button
              type="button"
              className="nodrag nopan"
              onClick={() => {
                let index =
                  entries.length +
                  1;

                let key =
                  `key${index}`;

                while (
                  Object.prototype
                    .hasOwnProperty.call(
                      object,
                      key,
                    )
                ) {
                  index += 1;
                  key =
                    `key${index}`;
                }

                onChange({
                  ...object,
                  [key]: "",
                });
              }}
            >
              ＋項目
            </button>
          )}
        </div>
      </div>

      {rawMode ? (
        <>
          <ImeTextarea
            className="node-textarea collection-raw nodrag nopan"
            value={raw}
            onCommit={(next) => {
              setRaw(next);

              try {
                const parsed =
                  JSON.parse(next);

                if (
                  !parsed ||
                  typeof parsed !==
                    "object" ||
                  Array.isArray(
                    parsed,
                  )
                ) {
                  throw new Error(
                    "オブジェクトJSONを入力してください。",
                  );
                }

                onChange(parsed);
                setRawError("");
              } catch (cause) {
                setRawError(
                  cause instanceof Error
                    ? cause.message
                    : String(cause),
                );
              }
            }}
          />

          {rawError && (
            <span className="value-error">
              {rawError}
            </span>
          )}
        </>
      ) : (
        <div className="collection-rows">
          {entries.length === 0 && (
            <p className="collection-empty">
              「＋項目」でキーと値を追加できます。
            </p>
          )}

          {entries.map(
            (
              [key, entryValue],
              index,
            ) => (
              <div
                className="object-row"
                key={`${key}-${index}`}
              >
                <ImeTextInput
                  className="object-key nodrag nopan"
                  value={key}
                  placeholder="キー"
                  onCommit={(
                    nextKey,
                  ) =>
                    replaceEntry(
                      index,
                      nextKey,
                      entryValue,
                    )
                  }
                />

                <TypedValueEditor
                  value={entryValue}
                  onChange={(
                    nextValue,
                  ) =>
                    replaceEntry(
                      index,
                      key,
                      nextValue,
                    )
                  }
                />

                <button
                  type="button"
                  className="nodrag nopan danger-mini"
                  title="削除"
                  onClick={() =>
                    onChange(
                      Object.fromEntries(
                        entries.filter(
                          (
                            _,
                            entryIndex,
                          ) =>
                            entryIndex !==
                            index,
                        ),
                      ),
                    )
                  }
                >
                  ×
                </button>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

export default function FlowNode({
  id,
  data,
  selected,
}: NodeProps<EditorNode>) {
  const { updateNodeData } =
    useReactFlow();

  const [
    descriptionOpen,
    setDescriptionOpen,
  ] = useState(false);

  const definition =
    data.definition as
      | NodeDefinition
      | undefined;

  const callbacks =
    data.callbacks as
      | NodeCallbacks
      | undefined;

  const runningState = String(
    data.runningState ?? "",
  );

  const languageType =
    data.languageType;

  const hiddenDescriptionTypes =
    useMemo(
      () =>
        new Set([
          "core.number",
          "core.string",
          "core.boolean",
          "core.array",
          "core.object",
          "core.input_number",
          "core.input_string",
          "core.print",
          "core.comment",
          "function.define",
          "function.subroutine",
          "function.lambda",
        ]),
      [],
    );

  if (!definition) {
    return (
      <div className="flow-node">
        定義がありません
      </div>
    );
  }

  const updateValue = (
    value: unknown,
  ) => {
    updateNodeData(id, {
      value,
    });
  };

  return (
    <div
      className={`flow-node ${
        selected
          ? "is-selected"
          : ""
      } ${
        runningState
          ? `is-${runningState}`
          : ""
      } ${
        definition.editorType ===
        "comment"
          ? "flow-node--comment"
          : ""
      }`}
    >
      <div className="flow-node__title">
        <span>
          {definition.title}
        </span>

        <div className="node-title-actions">
          {definition.editorType !==
            "comment" && (
            <>
              <label
                className="node-flag"
                title="ブレークポイント：ステップ実行時にこのノードで停止します"
              >
                <input
                  className="nodrag nopan"
                  type="checkbox"
                  checked={Boolean(
                    data.breakpoint,
                  )}
                  onChange={(
                    event,
                  ) =>
                    updateNodeData(
                      id,
                      {
                        breakpoint:
                          event
                            .target
                            .checked,
                      },
                    )
                  }
                />
                <span>BP</span>
              </label>

              <label
                className="node-flag"
                title="並列：同じ依存段階の並列ノードと同時実行します"
              >
                <input
                  className="nodrag nopan"
                  type="checkbox"
                  checked={Boolean(
                    data.parallel,
                  )}
                  onChange={(
                    event,
                  ) =>
                    updateNodeData(
                      id,
                      {
                        parallel:
                          event
                            .target
                            .checked,
                      },
                    )
                  }
                />
                <span>並列</span>
              </label>
            </>
          )}

          <button
            type="button"
            className="node-help nodrag nopan"
            title="ノードの説明"
            onClick={() =>
              setDescriptionOpen(
                (current) =>
                  !current,
              )
            }
          >
            ?
          </button>
        </div>
      </div>

      {descriptionOpen && (
        <div className="node-description">
          {definition.description}
        </div>
      )}

      <div className="flow-node__body">
        {definition.inputs.map(
          (port) => (
            <div
              className="port-row port-row--input"
              key={port.id}
            >
              <Handle
                id={port.id}
                type="target"
                position={
                  Position.Left
                }
                className={`port port--${port.dataType}`}
              />
              <span>
                {port.label}
              </span>
            </div>
          ),
        )}

        {languageType ===
          "core.number" && (
          <ImeTextInput
            type="number"
            value={String(
              data.value ?? 0,
            )}
            onCommit={(next) => {
              const parsed =
                Number(next);

              if (
                Number.isFinite(
                  parsed,
                )
              ) {
                updateValue(parsed);
              }
            }}
          />
        )}

        {languageType ===
          "core.string" && (
          <ImeTextarea
            className="string-editor nodrag nopan"
            value={String(
              data.value ?? "",
            )}
            onCommit={updateValue}
            placeholder="文字列を入力"
          />
        )}

        {languageType ===
          "core.boolean" && (
          <label className="boolean-editor nodrag nopan">
            <input
              type="checkbox"
              checked={Boolean(
                data.value,
              )}
              onChange={(
                event,
              ) =>
                updateValue(
                  event.target
                    .checked,
                )
              }
            />
            <span>
              {Boolean(data.value)
                ? "True"
                : "False"}
            </span>
          </label>
        )}

        {languageType ===
          "core.array" && (
          <ArrayEditor
            value={data.value}
            onChange={
              updateValue
            }
          />
        )}

        {languageType ===
          "core.object" && (
          <ObjectEditor
            value={data.value}
            onChange={
              updateValue
            }
          />
        )}

        {[
          "core.input_number",
          "core.input_string",
        ].includes(
          languageType,
        ) && (
          <div className="node-fields">
            <label>
              <span>Prompt</span>
              <ImeTextInput
                value={String(
                  data.prompt ?? "",
                )}
                onCommit={(
                  prompt,
                ) =>
                  updateNodeData(
                    id,
                    {
                      prompt,
                    },
                  )
                }
              />
            </label>

            <label>
              <span>Default</span>
              <ImeTextInput
                type={
                  languageType ===
                  "core.input_number"
                    ? "number"
                    : "text"
                }
                value={String(
                  data.defaultValue ??
                    "",
                )}
                onCommit={(
                  next,
                ) =>
                  updateNodeData(
                    id,
                    {
                      defaultValue:
                        languageType ===
                        "core.input_number"
                          ? Number(
                              next,
                            )
                          : next,
                    },
                  )
                }
              />
            </label>
          </div>
        )}

        {[
          "function.define",
          "function.subroutine",
          "function.lambda",
        ].includes(
          languageType,
        ) && (
          <div className="node-fields function-editor">
            {languageType !==
              "function.lambda" && (
              <label>
                <span>
                  Function Name
                </span>
                <ImeTextInput
                  value={String(
                    data.functionName ??
                      "myFunction",
                  )}
                  onCommit={(
                    functionName,
                  ) =>
                    updateNodeData(
                      id,
                      {
                        functionName,
                      },
                    )
                  }
                />
              </label>
            )}

            <label>
              <span>
                Parameters (CSV)
              </span>
              <ImeTextInput
                value={String(
                  data.parameters ??
                    "x",
                )}
                onCommit={(
                  parameters,
                ) =>
                  updateNodeData(
                    id,
                    {
                      parameters,
                    },
                  )
                }
              />
            </label>

            <label>
              <span>Body</span>
              <ImeTextarea
                className="node-textarea nodrag nopan"
                value={String(
                  data.functionBody ??
                    "x * 2",
                )}
                onCommit={(
                  functionBody,
                ) =>
                  updateNodeData(
                    id,
                    {
                      functionBody,
                    },
                  )
                }
              />
            </label>

            <label className="boolean-editor nodrag nopan">
              <input
                type="checkbox"
                checked={Boolean(
                  data.functionAsync,
                )}
                onChange={(
                  event,
                ) =>
                  updateNodeData(
                    id,
                    {
                      functionAsync:
                        event.target
                          .checked,
                    },
                  )
                }
              />
              <span>Async</span>
            </label>

            <label>
              <span>
                Recursion Limit
              </span>
              <input
                className="node-input nodrag nopan"
                type="number"
                min={1}
                max={4096}
                value={Number(
                  data.recursionLimit ??
                    128,
                )}
                onChange={(
                  event,
                ) =>
                  updateNodeData(
                    id,
                    {
                      recursionLimit:
                        Math.max(
                          1,
                          Number(
                            event
                              .target
                              .value,
                          ) ||
                            1,
                        ),
                    },
                  )
                }
              />
            </label>
          </div>
        )}

        {languageType ===
          "core.print" && (
          <label className="execution-order-field">
            <span>実行順序</span>
            <input
              className="node-input nodrag nopan"
              type="number"
              min={0}
              step={1}
              value={Math.max(
                0,
                Number(
                  data.executionOrder ??
                    0,
                ),
              )}
              onChange={(
                event,
              ) =>
                callbacks
                  ?.onExecutionOrderChange?.(
                    id,
                    Math.max(
                      0,
                      Math.floor(
                        Number(
                          event
                            .target
                            .value,
                        ) ||
                          0,
                      ),
                    ),
                  )
              }
            />
          </label>
        )}

        {languageType ===
          "core.comment" && (
          <ImeTextarea
            className="comment-editor nodrag nopan"
            value={String(
              data.comment ?? "",
            )}
            placeholder="コメント"
            onCommit={(
              comment,
            ) =>
              updateNodeData(
                id,
                {
                  comment,
                },
              )
            }
          />
        )}

        {!hiddenDescriptionTypes.has(
          languageType,
        ) && (
          <div className="operation-label">
            {definition.description}
          </div>
        )}

        {definition.outputs.map(
          (port) => (
            <div
              className="port-row port-row--output"
              key={port.id}
            >
              <span>
                {port.label}
              </span>
              <Handle
                id={port.id}
                type="source"
                position={
                  Position.Right
                }
                className={`port port--${port.dataType}`}
              />
            </div>
          ),
        )}
      </div>
    </div>
  );
}
