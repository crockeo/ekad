import { useState } from "react";
import { type Doc } from "@automerge/automerge-repo";
import type { Ekad, Task, UUID } from "../types";

export default function TaskSearcher({
  doc,
  ignore,
  onChooseTask,
}: {
  doc: Doc<Ekad>;
  ignore: UUID[];
  onChooseTask: (task: Task) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  return (
    <>
      <button
        className="
        bg-gray-200
        px-2
        py-1
        rounded-lg
        text-gray-500
        "
        onClick={() => setDialogOpen(true)}
      >
        Add +
      </button>

      {dialogOpen && (
        <>
          <div
            className="
            bg-black/25
            fixed
            h-screen
            left-0
            top-0
            w-screen
            z-10
            "
            onClick={() => close()}
          />

          <div
            className="
            bg-white
            border
            drop-shadow
            fixed
            p-2
            rounded
            z-50
            "
            onClick={(e) => e.preventDefault()}
          >
            <input
              className="block w-full focus:outline-none"
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task Title"
              type="text"
              value={title}
            />

            <hr className="my-2" />

            <div className="space-y-1">
              {getMatchingTasks().map((task) => (
                <div
                  className="
                cursor-pointer
                "
                  key={task.id}
                  onClick={() => chooseTask(task)}
                >
                  {task.title}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );

  function getMatchingTasks(): Task[] {
    const matchingTasks = [];
    for (const task of Object.values(doc.tasks)) {
      if (task.completedAt || task.deletedAt) {
        continue;
      }
      if (ignore.findIndex((id) => id == task.id) != -1) {
        continue;
      }
      if (task.title.toLowerCase().includes(title.toLowerCase())) {
        matchingTasks.push(task);
      }
    }
    return matchingTasks;
  }

  function close(): void {
    setDialogOpen(false);
    setTitle("");
  }

  function chooseTask(task: Task): void {
    close();
    onChooseTask(task);
  }
}
