import { useEffect, useRef } from "react";

import { useRepo } from "@ekad/components/DocProvider";
import TaskChip from "@ekad/components/TaskChip";
import TaskSearcher from "@ekad/components/TaskSearcher";
import type { UUID } from "@ekad/types";

export default function SelectedTaskPane({
  onSelectTask,
  task,
}: {
  onSelectTask: (task: UUID) => void;
  task: UUID;
}) {
  const repo = useRepo();
  const taskInstance = repo.getTask(task);

  const titleArea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (titleArea.current) {
      updateTextAreaHeight(titleArea.current);
    }
  }, [taskInstance.title]);

  const descriptionArea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (descriptionArea.current) {
      updateTextAreaHeight(descriptionArea.current);
    }
  }, [taskInstance.description]);

  return (
    <div
      className="
      p-4
      w-[80vw]
      md:w-[50vw]
      "
    >
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
        value={repo.getTask(task).title}
      />

      <div className="my-2" />

      <div
        className="
        grid
        grid-cols-2
        "
      >
        <div className="space-x-2">
          <span>Blocks:</span>
          {Object.keys(repo.getTask(task).blocks).map((id) => (
            <TaskChip
              key={id}
              onClick={() => onSelectTask(id)}
              onRemove={() => repo.removeEdge(id, task)}
              task={repo.getTask(id)}
            />
          ))}
          <TaskSearcher
            ignore={{ task: {}, ...repo.getTask(task).blocks }}
            onChooseTask={(chosenTask) => repo.addEdge(chosenTask, task)}
            repo={repo}
          />
        </div>

        <div className="space-x-2">
          <span className="mr-2">Blocked by:</span>
          {Object.keys(repo.getTask(task).blockedBy).map((id) => (
            <TaskChip
              key={id}
              onClick={() => onSelectTask(id)}
              onRemove={() => repo.removeEdge(task, id)}
              task={repo.getTask(id)}
            />
          ))}
          <TaskSearcher
            ignore={{ task: {}, ...repo.getTask(task).blockedBy }}
            onChooseTask={(chosenTask) => repo.addEdge(task, chosenTask)}
            repo={repo}
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
        value={repo.getTask(task).description}
      />
    </div>
  );

  function updateTitle(title: string): void {
    // TODO: debounce
    // TODO: updateText instead of assigning
    title = title.replaceAll("\n", "");
    repo.setTitle(task, title);
  }

  function updateDescription(description: string): void {
    // TODO: debounce
    // TODO: updateText instead of assigning
    repo.setDescription(task, description);
  }

  function updateTextAreaHeight(element: HTMLTextAreaElement): void {
    element.style.height = "1px";
    element.style.height = `${element.scrollHeight}px`;
  }
}
