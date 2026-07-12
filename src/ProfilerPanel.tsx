import type { NodeProfileRecord } from "./types";

export default function ProfilerPanel({
  records,
  onClear,
  onClose,
}: {
  records: NodeProfileRecord[];
  onClear(): void;
  onClose(): void;
}) {
  const sorted = [...records].sort((a, b) => b.totalMs - a.totalMs);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="large-dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dialog-header">
          <div>
            <h2>実行プロファイラー</h2>
            <p>ノードごとの実行時間・呼び出し回数・エラー数</p>
          </div>

          <div className="dialog-actions">
            <button onClick={onClear}>消去</button>
            <button onClick={onClose}>閉じる</button>
          </div>
        </header>

        <div className="profile-summary">
          <span>ノード: {sorted.length}</span>
          <span>
            合計: {sorted.reduce((sum, item) => sum + item.totalMs, 0).toFixed(2)} ms
          </span>
          <span>
            呼び出し: {sorted.reduce((sum, item) => sum + item.calls, 0)}
          </span>
          <span>
            エラー: {sorted.reduce((sum, item) => sum + item.errors, 0)}
          </span>
        </div>

        <div className="profile-table-wrap">
          <table className="profile-table">
            <thead>
              <tr>
                <th>ノード</th>
                <th>種類</th>
                <th>回数</th>
                <th>合計 ms</th>
                <th>最終 ms</th>
                <th>最大 ms</th>
                <th>エラー</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((record) => (
                <tr key={record.nodeId}>
                  <td>{record.title}</td>
                  <td><code>{record.languageType}</code></td>
                  <td>{record.calls}</td>
                  <td>{record.totalMs.toFixed(2)}</td>
                  <td>{record.lastMs.toFixed(2)}</td>
                  <td>{record.maxMs.toFixed(2)}</td>
                  <td>{record.errors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
