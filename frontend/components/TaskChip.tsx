import classNames from "classnames";

import Button from "@ekad/components/Button";
import type { Task } from "@ekad/types";

export default function TaskChip({
  onClick,
  onRemove,
  task,
}: {
  onClick: () => void;
  onRemove: () => void;
  task: Task;
}) {
  let title = task.title;
  if (title.length > 15) {
    title = title.substring(0, 15);
    title = `${title}...`;
  }
  return (
    <span
      className={classNames(
        "inline-flex",
        "flex-row",
        "items-center",
        "bg-gray-200",
        "border",
        "border-transparent",
        "cursor-pointer",
        "px-2",
        "py-1",
        "rounded-lg",
        "select-none",
        "text-gray-500",
        "text-xs",
        "transition",
        "hover:bg-gray-100",
        "active:[&:not(:focus-within)]:border-gray-400",
        {
          "line-through": task.completedAt,
        },
      )}
      key={task.id}
      onClick={() => onClick()}
    >
      {title}
      <span className="mx-2" />
      <Button
        idleBorder={false}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        type="destructive"
      >
        <div
          className="
          h-4
          text-gray-500
          transition
          w-4
          group-hover:text-red-500
          group-active:text-red-500
          "
        >
          ×
        </div>
      </Button>
    </span>
  );
}
