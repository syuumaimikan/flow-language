import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import type { PluginPackageInfo } from "./types";

export default function PluginManagerPanel({
  onChanged,
  onClose,
}: {
  onChanged(): void;
  onClose(): void;
}) {
  const [packages, setPackages] = useState<PluginPackageInfo[]>([]);
  const [message, setMessage] = useState("");

  const refresh = async () => {
    try {
      setPackages(await invoke<PluginPackageInfo[]>("list_plugin_packages"));
    } catch (error) {
      setMessage(String(error));
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const install = async () => {
    const path = await open({
      multiple: false,
      directory: false,
      filters: [
        {
          name: "Flow Plugin Package",
          extensions: ["json", "flpkg"],
        },
      ],
    });

    if (!path || Array.isArray(path)) {
      return;
    }

    try {
      const installed = await invoke<string>("install_plugin_package", { path });
      setMessage(`インストール完了: ${installed}`);
      await refresh();
      onChanged();
    } catch (error) {
      setMessage(`インストール失敗: ${String(error)}`);
    }
  };

  const uninstall = async (id: string) => {
    try {
      await invoke("uninstall_plugin_package", { pluginId: id });
      setMessage(`アンインストール完了: ${id}`);
      await refresh();
      onChanged();
    } catch (error) {
      setMessage(`アンインストール失敗: ${String(error)}`);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="large-dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dialog-header">
          <div>
            <h2>プラグインパッケージ管理</h2>
            <p>ローカルのJSONまたは.flpkg manifestを管理します。</p>
          </div>

          <div className="dialog-actions">
            <button onClick={install}>パッケージを追加</button>
            <button onClick={onClose}>閉じる</button>
          </div>
        </header>

        {message && <p className="manager-message">{message}</p>}

        <div className="package-list">
          {packages.length === 0 && <p>インストール済みパッケージはありません。</p>}

          {packages.map((pkg) => (
            <article className="package-card" key={pkg.id}>
              <div>
                <h3>{pkg.name}</h3>
                <code>{pkg.id}@{pkg.version}</code>
                <p>{pkg.description ?? "説明なし"}</p>
                <small>{pkg.path}</small>
              </div>

              <button className="danger-button" onClick={() => void uninstall(pkg.id)}>
                削除
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
