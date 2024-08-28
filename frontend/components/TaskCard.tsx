// Defines the TaskCard component, which lives on the left-hand-side of the main view.
import classNames from "classnames";
import type { ChangeEvent } from "react";

import Button from "@ekad/components/Button";
import { useRepo } from "@ekad/components/DocProvider";
import type { Task, UUID } from "@ekad/types";

export default function TaskCard({
  isSelected,
  onClick,
  task,
}: {
  isSelected: boolean;
  onClick: (task: UUID) => void;
  task: Task;
}) {
  const repo = useRepo();
  return (
    <div
      className={classNames(
        "border",
        "border-transparent",
        "cursor-pointer",
        "flex",
        "flex-row",
        "flex-nowrap",
        "justify-between",
        "items-center",
        "px-2",
        "py-1",
        "rounded",
        "select-none",
        "transition",
        "hover:bg-gray-100",
        "active:[&:not(:focus-within)]:border-gray-400",
        {
          "bg-gray-100": isSelected,
          "border-gray-400": isSelected,
          "text-gray-400": task.completedAt,
        },
      )}
      onClick={() => onClick(task.id)}
      key={task.id}
    >
      <div className="flex flex-row items-center">
        <input
          className="
          flex-none
          h-4
          w-4
          "
          checked={!!task.completedAt}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => completeTask(e, task)}
          type="checkbox"
        />
        <div
          className={classNames("px-2", {
            "line-through": task.completedAt,
          })}
        >
          {task.title}
        </div>
      </div>
      <Button
        onClick={(e) => {
          e.stopPropagation();
          deleteTask(task);
        }}
        type="destructive"
      >
        <div className="w-6 h-6">×</div>
      </Button>
    </div>
  );

  function completeTask(e: ChangeEvent<HTMLInputElement>, task: Task) {
    repo.complete(task.id, e.target.checked);
  }

  function deleteTask(task: Task) {
    repo.delete(task.id);
  }
}
