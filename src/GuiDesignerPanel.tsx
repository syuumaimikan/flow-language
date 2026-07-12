import { useMemo, useState } from "react";
import type { EditorNode } from "./types";

export default function GuiDesignerPanel({
  nodes,
  onClose,
}: {
  nodes: EditorNode[];
  onClose(): void;
}) {
  const [title, setTitle] = useState("Flow GUI Preview");
  const [label, setLabel] = useState("Hello from Flow Language");
  const [button, setButton] = useState("Click");
  const [input, setInput] = useState("");

  const guiNodeCount = useMemo(
    () => nodes.filter((node) => node.data.languageType.startsWith("gui.")).length,
    [nodes],
  );

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="large-dialog gui-designer-dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dialog-header">
          <div>
            <h2>GUI Designer</h2>
            <p>現在のキャンバスにGUIノードが{guiNodeCount}個あります。</p>
          </div>
          <button onClick={onClose}>閉じる</button>
        </header>

        <div className="gui-designer-layout">
          <aside className="gui-property-panel">
            <label>
              <span>ウィンドウ名</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label>
              <span>ラベル</span>
              <input value={label} onChange={(event) => setLabel(event.target.value)} />
            </label>
            <label>
              <span>ボタン</span>
              <input value={button} onChange={(event) => setButton(event.target.value)} />
            </label>
            <label>
              <span>入力初期値</span>
              <input value={input} onChange={(event) => setInput(event.target.value)} />
            </label>

            <p>
              この画面はレイアウト確認用です。実行可能GUIは
              GUI Label / Button / Input / Row / Column / Window / Show GUI
              ノードで構築します。
            </p>
          </aside>

          <div className="gui-preview-canvas">
            <section className="gui-preview-window">
              <header>{title}</header>
              <main>
                <span>{label}</span>
                <input value={input} onChange={(event) => setInput(event.target.value)} />
                <button>{button}</button>
              </main>
            </section>
          </div>
        </div>
      </section>
    </div>
  );
}
