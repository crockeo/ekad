import classNames from "classnames";
import { useEffect, useRef } from "react";

import type { Task, UUID } from "../types";
import Button from "./Button";
import { useDoc } from "./DocProvider";
import TaskSearcher from "./TaskSearcher";

export default function SelectedTaskPane({
  onSelectTask,
  task,
}: {
  onSelectTask: (task: UUID) => void;
  task: UUID;
}) {
  const [doc, changeDoc] = useDoc();

  const titleArea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (titleArea.current) {
      updateTextAreaHeight(titleArea.current);
    }
  }, [doc.tasks[task].title]);

  const descriptionArea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (descriptionArea.current) {
      updateTextAreaHeight(descriptionArea.current);
    }
  }, [doc.tasks[task].description]);

  return (
    <div>
      <textarea
        className="
        font-semibold
        resize-none
        text-xl
        w-full
        focus:outline-none
        "
        onChange={(e) => updateTitle(e.target.value)}
        placeholder="Title"
        ref={titleArea}
        value={doc.tasks[task].title}
      />

      <div className="my-2" />

      <div
        className="
        grid
        grid-cols-2
        text-sm
        "
      >
        <div className="space-x-2">
          <span>Blocks:</span>
          {doc.tasks[task].blocks?.map((id) => (
            <TaskChip
              key={id}
              onClick={() => onSelectTask(id)}
              onRemove={() => removeEdge(id, task)}
              task={doc.tasks[id]}
            />
          ))}
          <TaskSearcher
            doc={doc}
            ignore={[task, ...(doc.tasks[task].blocks || [])]}
            onChooseTask={(chosenTask) => addEdge(chosenTask, task)}
          />
        </div>

        <div className="space-x-2">
          <span className="mr-2">Blocked by:</span>
          {doc.tasks[task].blockedBy?.map((id) => (
            <TaskChip
              key={id}
              onClick={() => onSelectTask(id)}
              onRemove={() => removeEdge(task, id)}
              task={doc.tasks[id]}
            />
          ))}
          <TaskSearcher
            doc={doc}
            ignore={[task, ...(doc.tasks[task].blockedBy || [])]}
            onChooseTask={(chosenTask) => addEdge(task, chosenTask)}
          />
        </div>
      </div>

      <div className="my-2" />

      <textarea
        className="
        border
        p-2
        resize-none
        rounded
        w-full
        focus:outline-none
        "
        onChange={(e) => updateDescription(e.target.value)}
        placeholder="Description"
        ref={descriptionArea}
        value={doc.tasks[task].description}
      ></textarea>
    </div>
  );

  function addEdge(from: UUID, to: UUID): void {
    changeDoc((doc) => {
      if (!doc.tasks[from].blockedBy) {
        doc.tasks[from].blockedBy = [];
      }
      if (!doc.tasks[to].blocks) {
        doc.tasks[to].blocks = [];
      }

      if (doc.tasks[from].blockedBy.findIndex((val) => val == from) == -1) {
        doc.tasks[from].blockedBy.push(to);
      }
      if (doc.tasks[to].blocks.findIndex((val) => val == to) == -1) {
        doc.tasks[to].blocks.push(from);
      }
    });
  }

  function removeEdge(from: UUID, to: UUID): void {
    changeDoc((doc) => {
      // For some reason `.indexOf` isn't working here,
      // despite these UUIDs existing in the arrays.
      // So we're manually finding the index and splicing :/
      let blockedByIndex = -1;
      for (let i = 0; i < doc.tasks[from].blockedBy.length; i++) {
        if (doc.tasks[from].blockedBy[i] == to) {
          blockedByIndex = i;
          break;
        }
      }
      if (blockedByIndex >= 0) {
        doc.tasks[from].blockedBy.splice(blockedByIndex);
      }

      let blocksIndex = -1;
      for (let i = 0; i < doc.tasks[to].blocks.length; i++) {
        if (doc.tasks[to].blocks[i] == from) {
          blocksIndex = i;
          break;
        }
      }
      if (blocksIndex) {
        doc.tasks[to].blocks.splice(blocksIndex);
      }
    });
  }

  function updateTitle(title: string): void {
    // TODO: debounce
    // TODO: updateText instead of assigning
    title = title.replaceAll("\n", "");
    changeDoc((doc) => {
      doc.tasks[task].title = title;
    });
  }

  function updateDescription(description: string): void {
    // TODO: debounce
    // TODO: updateText instead of assigning
    changeDoc((doc) => {
      doc.tasks[task].description = description;
    });
  }

  function updateTextAreaHeight(element: HTMLTextAreaElement): void {
    element.style.height = "1px";
    element.style.height = `${element.scrollHeight}px`;
  }
}

function TaskChip({
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
