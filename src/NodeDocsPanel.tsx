import type { NodeDefinition } from "./nodeDefinitions";

export default function NodeDocsPanel({
  definitions,
  onClose,
}: {
  definitions: Record<string, NodeDefinition>;
  onClose(): void;
}) {
  const grouped = new Map<string, NodeDefinition[]>();

  for (const definition of Object.values(definitions)) {
    grouped.set(definition.category, [
      ...(grouped.get(definition.category) ?? []),
      definition,
    ]);
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="large-dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dialog-header">
          <div>
            <h2>ノードドキュメント</h2>
            <p>{Object.keys(definitions).length}種類のノード</p>
          </div>
          <button onClick={onClose}>閉じる</button>
        </header>

        <div className="docs-grid">
          {[...grouped].map(([category, items]) => (
            <section className="docs-category" key={category}>
              <h3>{category}</h3>
              {items.map((definition) => (
                <article className="docs-node" key={definition.languageType}>
                  <h4>{definition.title}</h4>
                  <code>{definition.languageType}</code>
                  <p>{definition.description}</p>

                  <div className="docs-ports">
                    <div>
                      <strong>入力</strong>
                      {definition.inputs.length === 0 && <span>なし</span>}
                      {definition.inputs.map((port) => (
                        <span key={port.id}>
                          {port.label}: {port.dataType}
                          {port.required === false ? "（任意）" : ""}
                        </span>
                      ))}
                    </div>

                    <div>
                      <strong>出力</strong>
                      {definition.outputs.length === 0 && <span>なし</span>}
                      {definition.outputs.map((port) => (
                        <span key={port.id}>
                          {port.label}: {port.dataType}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
