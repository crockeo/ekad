import { useHotkeys } from "./HotkeyProvider";
import Modal from "./Modal";
import classNames from "classnames";
import { useEffect, useState } from "react";

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
  const [selectedTask, setSelectedTask] = useState<number | null>(null);

  useEffect(() => {
    const matchingTasks = getMatchingTasks();
    setSelectedTask((selectedTask) => {
      if (!matchingTasks) {
        return null;
      }
      if (selectedTask !== null && selectedTask >= matchingTasks.length) {
        return matchingTasks.length;
      }
      return selectedTask;
    });
  }, [title]);

  // TODO: these hotkeys don't work after i've entered a title + there's nothing left to match.
  const hotkeys = useHotkeys();
  useEffect(() => {
    if (!dialogOpen) {
      return;
    }

    return hotkeys.addKeydownHandler((e: KeyboardEvent) => {
      if (e.code == "ArrowDown") {
        e.preventDefault();
        setSelectedTask((selectedTask) => {
          if (selectedTask === null) {
            return 0;
          }
          if (selectedTask < getMatchingTasks().length - 1) {
            return selectedTask + 1;
          }
          return selectedTask;
        });
        return true;
      } else if (e.code == "ArrowUp") {
        e.preventDefault();
        setSelectedTask((selectedTask) => {
          if (selectedTask === null) {
            return getMatchingTasks().length - 1;
          }
          if (selectedTask > 0) {
            return selectedTask - 1;
          }
          return selectedTask;
        });
        return true;
      } else if (e.code == "Enter") {
        const matchingTasks = getMatchingTasks();
        const task =
          selectedTask === null ? undefined : getMatchingTasks()[selectedTask];
        if (task) {
          close();
          onChooseTask(task.id);
        }
        return true;
      }
      return false;
    });
  }, [dialogOpen, selectedTask, title]);

  return (
    <span>
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
            {getMatchingTasks().map((task, i) => (
              <div
                className={classNames("cursor-pointer", "p-1", "rounded", {
                  "bg-blue-100": selectedTask == i,
                })}
                key={task.id}
                onClick={() => chooseTask(task)}
              >
                {task.title}
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </span>
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
