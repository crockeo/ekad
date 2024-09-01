import Modal from "./Modal";
import { useState } from "react";

import Button from "@ekad/components/Button";
import type { Repo } from "@ekad/components/DocProvider";
import type { Task, UUID } from "@ekad/types";

export default function TaskSearcher({
  ignore,
  onChooseTask,
  repo,
}: {
  ignore: { [key: UUID]: {} };
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

      <Modal onRequestClose={close} open={dialogOpen}>
        <div className="h-[90vh] w-[50vw]">
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
      </Modal>
    </>
  );

  function getMatchingTasks(): Task[] {
    const matchingTasks = [];
    for (const taskID of repo.tasks()) {
      const task = repo.getTask(taskID);
      if (task.completedAt || task.deletedAt) {
        continue;
      }
      if (taskID in ignore) {
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
