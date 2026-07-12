import type {
  CSSProperties,
  MouseEvent,
  PointerEvent,
} from "react";

export interface ContextAction {
  id: string;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  run(): void;
}

export default function ContextMenu({
  x,
  y,
  actions,
}: {
  x: number;
  y: number;
  actions: ContextAction[];
}) {
  const style: CSSProperties = {
    left: Math.min(
      x,
      window.innerWidth - 210,
    ),
    top: Math.min(
      y,
      window.innerHeight - 220,
    ),
  };

  const stop = (
    event:
      | MouseEvent<HTMLDivElement>
      | PointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div
      className="context-menu"
      style={style}
      onContextMenu={stop}
      onPointerDown={stop}
    >
      {actions.map((action) => (
        <button
          key={action.id}
          className={
            action.danger
              ? "is-danger"
              : ""
          }
          disabled={action.disabled}
          onClick={(event) => {
            event.stopPropagation();
            action.run();
          }}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
