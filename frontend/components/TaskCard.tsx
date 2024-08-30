// Defines the TaskCard component, which lives on the left-hand-side of the main view.
import classNames from "classnames";
import { type ChangeEvent, useEffect, useRef } from "react";

import Button from "@ekad/components/Button";
import { useRepo } from "@ekad/components/DocProvider";
import TaskChip from "@ekad/components/TaskChip";
import TaskSearcher from "@ekad/components/TaskSearcher";
import type { Task, UUID } from "@ekad/types";
import { updateTextAreaHeight } from "@ekad/utils";

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

  const titleArea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (titleArea.current) {
      updateTextAreaHeight(titleArea.current);
    }
  }, [isSelected, task.title]);

  return (
    <div
      className={classNames(
        "border",
        "border-transparent",
        "cursor-pointer",
        "px-2",
        "py-1",
        "rounded",
        "transition",
        "hover:bg-gray-100",
        "active:border-gray-400",
        {
          "bg-gray-100": isSelected,
          "border-gray-400": isSelected,
        },
      )}
      onClick={() => onClick(task.id)}
      key={task.id}
    >
      <div
        className={classNames(
          "flex",
          "flex-row",
          "flex-nowrap",
          "items-center",
          "space-x-2",
          {
            "text-gray-400": task.completedAt,
          },
        )}
      >
        <input
          className="
        flex-none
        h-4
        w-4
        "
          checked={!!task.completedAt}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => repo.complete(task.id, e.target.checked)}
          type="checkbox"
        />
        <div className="w-full">
          {isSelected ? (
            <textarea
              className={classNames(
                "bg-transparent",
                "focus:outline-none",
                "resize-none",
                "w-full",
                {
                  "line-through": task.completedAt,
                  "cursor-pointer": !isSelected,
                },
              )}
              disabled={!isSelected}
              onChange={(e) => repo.setTitle(task.id, e.target.value)}
              onClick={(e) => {
                if (!isSelected) {
                  onClick(task.id);
                }
              }}
              ref={titleArea}
              value={task.title}
            />
          ) : (
            <div>{task.title}</div>
          )}
        </div>
        <Button
          onClick={(e) => {
            e.stopPropagation();
            repo.delete(task.id);
          }}
          type="destructive"
        >
          <div className="w-6 h-6">×</div>
        </Button>
      </div>

      {isSelected && <TaskCardBody task={task} />}
    </div>
  );
}

function TaskCardBody({ task }: { task: Task }) {
  const repo = useRepo();
  const descriptionArea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (descriptionArea.current) {
      updateTextAreaHeight(descriptionArea.current);
    }
  }, [task.description]);

  return (
    <div className="flex flex-col space-y-2">
      <div
        className="
        grid
        grid-cols-2
        text-sm
        "
      >
        <div className="space-x-2">
          <span>Blocks:</span>
          {Object.keys(repo.getTask(task.id).blocks).map((id) => (
            <TaskChip
              key={id}
              onClick={() => {} /* onSelectTask(id) */}
              onRemove={() => repo.removeEdge(id, task.id)}
              task={repo.getTask(id)}
            />
          ))}
          <TaskSearcher
            ignore={{ task: {}, ...repo.getTask(task.id).blocks }}
            onChooseTask={(chosenTask) => repo.addEdge(chosenTask, task.id)}
            repo={repo}
          />
        </div>

        <div className="space-x-2">
          <span className="mr-2">Blocked by:</span>
          {Object.keys(repo.getTask(task.id).blockedBy).map((id) => (
            <TaskChip
              key={id}
              onClick={() => {} /* onSelectTask(id) */}
              onRemove={() => repo.removeEdge(task.id, id)}
              task={repo.getTask(id)}
            />
          ))}
          <TaskSearcher
            ignore={{ task: {}, ...repo.getTask(task.id).blockedBy }}
            onChooseTask={(chosenTask) => repo.addEdge(task.id, chosenTask)}
            repo={repo}
          />
        </div>
      </div>

      <textarea
        className="
        border
        overflow-y-none
        p-2
        resize-none
        rounded
        w-full
        focus:outline-none
        "
        onChange={(e) => repo.setDescription(task.id, e.target.value)}
        placeholder="Description"
        ref={descriptionArea}
        value={task.description}
      />
    </div>
  );
}
