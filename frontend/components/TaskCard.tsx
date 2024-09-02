// Defines the TaskCard component, which lives on the left-hand-side of the main view.
import { useHotkeys } from "./HotkeyProvider";
import classNames from "classnames";
import { useEffect, useRef, useState } from "react";

import Button from "@ekad/components/Button";
import { useRepo } from "@ekad/components/DocProvider";
import TaskChip from "@ekad/components/TaskChip";
import TaskSearcher from "@ekad/components/TaskSearcher";
import type { Task, UUID } from "@ekad/types";
import { updateTextAreaHeight } from "@ekad/utils";

export enum TaskCardViewMode {
  DEFAULT,
  SELECTED,
  EXPANDED,
}

export default function TaskCard({
  onClick,
  task,
  viewMode,
}: {
  onClick: (task: UUID) => void;
  task: Task;
  viewMode: TaskCardViewMode;
}) {
  const repo = useRepo();

  const taskCard = useRef<HTMLDivElement>(null);

  const titleArea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (titleArea.current) {
      updateTextAreaHeight(titleArea.current);
    }
  }, [viewMode, task.title]);

  useEffect(() => {
    if (titleArea.current && viewMode == TaskCardViewMode.EXPANDED) {
      titleArea.current.focus();
    }

    if (titleArea.current && viewMode != TaskCardViewMode.EXPANDED) {
      titleArea.current.blur();
    }
  }, [viewMode]);

  const hotkeys = useHotkeys();
  const [focusedElement, setFocusedElement] = useState<number | null>(0);
  useEffect(() => {
    if (viewMode != TaskCardViewMode.EXPANDED) {
      setFocusedElement(0);
      return;
    }

    const tabbable: Element[] = [];
    if (taskCard.current) {
      const children = taskCard.current.querySelectorAll(
        "textarea:not([disabled])",
      );
      children.forEach((child) => tabbable.push(child));
    }
    const listener = (e: KeyboardEvent) => {
      if (e.code == "Tab") {
        e.preventDefault();
        setFocusedElement((element) => {
          if (element == null) {
            element = 0;
          } else {
            element = element + 1;
          }
          element = element % tabbable.length;
          tabbable[element].focus();
          return element;
        });

        return true;
      }
      return false;
    };
    return hotkeys.addKeydownHandler(listener);
  }, [focusedElement, viewMode]);

  return (
    <div
      className={classNames(
        "border",
        "border-transparent",
        "cursor-pointer",
        "px-2",
        "py-1",
        "rounded",
        "active:[&:not(:focus-within)]:border-gray-400",
        {
          "hover:bg-gray-100": viewMode == TaskCardViewMode.DEFAULT,
          "bg-blue-100": viewMode != TaskCardViewMode.DEFAULT,
          "border-gray-400": viewMode != TaskCardViewMode.DEFAULT,
          "cursor-pointer": viewMode != TaskCardViewMode.EXPANDED,
        },
      )}
      key={task.id}
      onClick={(e) => {
        e.stopPropagation();
        onClick(task.id);
      }}
      ref={taskCard}
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
        <textarea
          className={classNames(
            "bg-transparent",
            "focus:outline-none",
            "resize-none",
            "w-full",
            {
              "line-through": task.completedAt,
              "cursor-pointer": viewMode != TaskCardViewMode.EXPANDED,
            },
          )}
          onChange={(e) => repo.setTitle(task.id, e.target.value)}
          onMouseDown={(e) =>
            viewMode != TaskCardViewMode.EXPANDED && e.preventDefault()
          }
          onClick={(e) => {
            if (viewMode != TaskCardViewMode.EXPANDED) {
              e.preventDefault();
              e.stopPropagation();
              onClick(task.id);
            }
          }}
          ref={titleArea}
          value={task.title}
        />
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

      {viewMode == TaskCardViewMode.EXPANDED && (
        <TaskCardBody
          expanded={viewMode == TaskCardViewMode.EXPANDED}
          onClick={onClick}
          task={task}
        />
      )}
    </div>
  );
}

function TaskCardBody({
  expanded,
  onClick,
  task,
}: {
  expanded: boolean;
  onClick: (task: UUID) => void;
  task: Task;
}) {
  const repo = useRepo();
  const descriptionArea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (descriptionArea.current) {
      updateTextAreaHeight(descriptionArea.current);
    }
  }, [task.description]);

  useEffect(() => {
    if (descriptionArea.current && !expanded) {
      descriptionArea.current.blur();
    }
  }, [expanded]);

  return (
    <div className="flex flex-col space-y-2">
      <textarea
        className="
        bg-transparent
        overflow-y-none
        p-2
        resize-none
        w-full
        focus:outline-none
        "
        onChange={(e) => repo.setDescription(task.id, e.target.value)}
        placeholder="Description"
        ref={descriptionArea}
        value={task.description}
      />

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
              onClick={() => onClick(id)}
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
              onClick={() => onClick(id)}
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
    </div>
  );
}
