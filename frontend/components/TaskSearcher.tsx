import { useState } from "react";

import type { Task, UUID } from "../types";
import Button from "./Button";
import type { Repo } from "./DocProvider";

export default function TaskSearcher({
  ignore,
  onChooseTask,
  repo,
}: {
  ignore: UUID[];
  onChooseTask: (task: UUID) => void;
  repo: Repo;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  return (
    <>
      <Button onClick={() => setDialogOpen(true)} type="secondary">
        <div className="px-2 py-1 text-xs">Add +</div>
      </Button>

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
    for (const taskID of repo.tasks()) {
      const task = repo.getTask(taskID);
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
    onChooseTask(task.id);
  }
}
