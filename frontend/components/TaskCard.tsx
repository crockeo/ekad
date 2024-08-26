// Defines the TaskCard component, which lives on the left-hand-side of the main view.
import classNames from "classnames";
import type { ChangeEvent } from "react";

import { type Task, type UUID } from "../types";
import Button from "./Button";
import { useDoc } from "./DocProvider";

export default function TaskCard({
  isSelected,
  onClick,
  task,
}: {
  isSelected: boolean;
  onClick: (task: UUID) => void;
  task: Task;
}) {
  const [_, changeDoc] = useDoc();
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
          "line-through": task.completedAt,
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
        <div className="px-2">{task.title}</div>
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
    const newCompletedAt = e.target.checked ? new Date() : null;
    changeDoc((doc) => {
      doc.tasks[task.id].completedAt = newCompletedAt;
    });
  }

  function deleteTask(task: Task) {
    const newDeletedAt = new Date();
    changeDoc((doc) => {
      doc.tasks[task.id].deletedAt = newDeletedAt;

      // TODO: test that this works? and maybe pull it out into a generic "remove edge" function?
      for (const blocks of doc.tasks[task.id].blocks || []) {
        const pos = doc.tasks[blocks].blockedBy.indexOf(task.id);
        if (pos != -1) {
          doc.tasks[blocks].blockedBy.splice(pos, 1);
        }
      }
      for (const blockedBy of doc.tasks[task.id].blockedBy || []) {
        const pos = doc.tasks[blockedBy].blocks.indexOf(task.id);
        if (pos != -1) {
          doc.tasks[blockedBy].blockedBy.splice(pos, 1);
        }
      }
    });
  }
}
