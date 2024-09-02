import classNames from "classnames";
import { topologicalGenerations } from "graphology-dag";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type PropsWithChildren,
} from "react";
import { uuidv7 } from "uuidv7";

import Button from "@ekad/components/Button";
import { useRepo } from "@ekad/components/DocProvider";
import Fold from "@ekad/components/Fold";
import { useHotkeys } from "@ekad/components/HotkeyProvider";
import TaskCard, { TaskCardViewMode } from "@ekad/components/TaskCard";
import TextInput from "@ekad/components/TextInput";
import type { Task, UUID } from "@ekad/types";
import { buildTaskGraph, sortBy } from "@ekad/utils";

export default function ListView() {
  return (
    <div className={classNames("flex", "flex-row", "h-full")}>
      <SideBar />
      <TaskList />
    </div>
  );
}

function TaskList() {
  const repo = useRepo();

  const input = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [selectedTask, setSelectedTask] = useState<UUID | null>(null);
  const [expandTask, setExpandTask] = useState<boolean>(false);

  const hotkeys = useHotkeys();
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      switch (e.code) {
        case "ArrowDown":
          selectNextTask(e);
          return true;
        case "ArrowUp":
          selectPreviousTask(e);
          return true;
        case "Enter":
          expandSelectedTask();
          return true;
        case "Escape":
          condenseSelectedTask();
          return true;
        case "KeyK":
          if (e.metaKey && selectedTask) {
            repo.complete(
              selectedTask,
              !repo.getTask(selectedTask).completedAt,
            );
            return true;
          }
      }
      return false;
    };
    return hotkeys.addKeydownHandler(listener);
  }, [selectedTask, expandTask]);

  return (
    <div
      className={classNames(
        "flex",
        "flex-col",
        "grow",
        "m-auto",
        "px-1",
        "h-full",
        "pt-2",
        "space-y-1",
        "w-screen",
      )}
      onClick={() => setExpandTask(false)}
    >
      <form
        className="
        flex
        flex-row
        flex-shrink-0
        px-2
        space-x-1
        "
        onSubmit={newTask}
      >
        <TextInput
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          $ref={input}
          value={title}
        />

        <Button disabled={!title} type="constructive">
          <div className="h-6 w-6">+</div>
        </Button>
      </form>

      <div className="flex-grow space-y-1 overflow-y-auto">
        {openTasks().map((task) => (
          <TaskCard
            key={task.id}
            onClick={clickTask}
            task={task}
            viewMode={taskCardViewMode(task.id)}
          />
        ))}
        <Fold name="Completed Tasks">
          {completedTasks().map((task) => (
            <TaskCard
              key={task.id}
              onClick={clickTask}
              task={task}
              viewMode={taskCardViewMode(task.id)}
            />
          ))}
        </Fold>
      </div>
    </div>
  );

  function newTask(e: FormEvent) {
    e.preventDefault();

    const id = uuidv7();
    const newTask = {
      id: id,
      title: title,
      description: "",
      completedAt: null,
      deletedAt: null,
      blocks: {},
      blockedBy: {},
    };

    setTitle("");
    repo.createTask(newTask);
    setSelectedTask(newTask.id);
  }

  function openTasks(): Task[] {
    const graph = buildTaskGraph(repo);
    const order = [];
    for (const generation of topologicalGenerations(graph).toReversed()) {
      sortBy(generation, (id) => repo.getTask(id).title);
      order.push(...generation);
    }
    return order.map((taskID) => repo.getTask(taskID));
  }

  function completedTasks(): Task[] {
    return repo
      .tasks()
      .map((task) => repo.getTask(task))
      .filter((task) => task.completedAt && !task.deletedAt);
  }

  function taskCardViewMode(taskID: UUID): TaskCardViewMode {
    if (selectedTask != taskID) {
      return TaskCardViewMode.DEFAULT;
    }
    if (expandTask) {
      return TaskCardViewMode.EXPANDED;
    }
    return TaskCardViewMode.SELECTED;
  }

  function clickTask(taskID: UUID) {
    if (selectedTask == taskID) {
      setExpandTask(true);
    } else {
      setSelectedTask(taskID);
      setExpandTask(false);
      return;
    }
  }

  function selectNextTask(e: KeyboardEvent) {
    if (expandTask) {
      return;
    }

    e.stopPropagation();
    e.preventDefault();

    const tasks = openTasks();
    if (tasks.length === 0) {
      return;
    }

    if (!selectedTask) {
      setSelectedTask(tasks[0].id);
      return;
    }

    for (let i = 0; i < tasks.length; i++) {
      if (tasks[i].id != selectedTask) {
        continue;
      }
      if (i >= tasks.length - 1) {
        // We're at the end of the list, nothing we can do :/
        return;
      }
      setSelectedTask(tasks[i + 1].id);
    }
  }

  function selectPreviousTask(e: KeyboardEvent) {
    if (expandTask) {
      return;
    }

    e.stopPropagation();
    e.preventDefault();

    const tasks = openTasks();
    if (tasks.length === 0) {
      return;
    }

    if (!selectedTask) {
      setSelectedTask(tasks[tasks.length - 1].id);
      return;
    }

    for (let i = 0; i < tasks.length; i++) {
      if (tasks[i].id != selectedTask) {
        continue;
      }
      if (i == 0) {
        // We're at the beginning of the list, nothing we can do :/
        return;
      }
      setSelectedTask(tasks[i - 1].id);
    }
  }

  function expandSelectedTask() {
    if (selectedTask) {
      setExpandTask(true);
    }
  }

  function condenseSelectedTask() {
    if (expandTask) {
      setExpandTask(false);
    } else if (selectedTask) {
      setSelectedTask(null);
    }
  }
}

function SideBar() {
  const repo = useRepo();
  const { numInbox, areas } = getTaskGroups();
  return (
    <div
      className={classNames(
        "border-r",
        "pl-2",
        "pr-4",
        "py-1",
        "space-y-2",
        "w-[25vw]",
      )}
    >
      <SideBarCategory>Inbox {numInbox > 0 && numInbox}</SideBarCategory>

      <div>
        <SideBarCategory>Completed</SideBarCategory>
        <SideBarCategory>Trash</SideBarCategory>
      </div>

      <div>
        {areas.map((task) => (
          <SideBarCategory key={task.id}>{task.title}</SideBarCategory>
        ))}
      </div>
    </div>
  );

  function getTaskGroups() {
    let numInbox = 0;
    let areas = [];
    for (const taskID of repo.tasks()) {
      const task = repo.getTask(taskID);
      if (task.completedAt || task.deletedAt) {
        continue;
      }

      const blocks = Object.keys(task.blocks).length > 0;
      const isBlocked = Object.keys(task.blockedBy).length > 0;
      if (!blocks && !isBlocked) {
        numInbox += 1;
      }
      if (!blocks && isBlocked) {
        areas.push(task);
      }
    }

    return {
      numInbox,
      areas,
    };
  }
}

function SideBarCategory({ children }: PropsWithChildren) {
  return (
    <div
      className={classNames(
        "cursor-pointer",
        "transition",
        "px-2",
        "py-1",
        "rounded",
        "hover:bg-blue-100",
        "active:bg-blue-200",
      )}
    >
      {children}
    </div>
  );
}
