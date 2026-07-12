import type { EditorNode } from "./types";

export default function DebuggerPanel({
  nodes,
  waitingNodeId,
  logs,
  onClose,
}: {
  nodes: EditorNode[];
  waitingNodeId: string | null;
  logs: string[];
  onClose(): void;
}) {
  const breakpoints = nodes.filter((node) => Boolean(node.data.breakpoint));
  const selected = nodes.filter((node) => node.selected);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="large-dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dialog-header">
          <div>
            <h2>デバッガー</h2>
            <p>
              {waitingNodeId
                ? `停止中: ${waitingNodeId}`
                : "現在は停止していません"}
            </p>
          </div>
          <button onClick={onClose}>閉じる</button>
        </header>

        <div className="debugger-grid">
          <section>
            <h3>ブレークポイント</h3>
            {breakpoints.length === 0 && <p>設定されていません。</p>}
            {breakpoints.map((node) => (
              <article className="debug-record" key={node.id}>
                <strong>{node.data.title}</strong>
                <code>{node.data.languageType}</code>
                <small>{node.id}</small>
              </article>
            ))}
          </section>

          <section>
            <h3>選択中ノード</h3>
            {selected.length === 0 && <p>選択されていません。</p>}
            {selected.map((node) => (
              <article className="debug-record" key={node.id}>
                <strong>{node.data.title}</strong>
                <code>{node.data.languageType}</code>
                <pre>{JSON.stringify(node.data, null, 2)}</pre>
              </article>
            ))}
          </section>

          <section>
            <h3>直近ログ</h3>
            <pre className="debug-log">
              {logs.slice(-50).join("\n")}
            </pre>
          </section>
        </div>
      </section>
    </div>
  );
}
