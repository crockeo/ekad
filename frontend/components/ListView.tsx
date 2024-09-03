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
import { buildTaskGraph, buildTaskSubgraph, sortBy } from "@ekad/utils";

enum TaskListViewType {
  INBOX,
  TODO,
  COMPLETED,
  TRASH,
  TASK,
}

interface TaskListView {
  type: TaskListViewType;
  task?: UUID;
}

export default function ListView() {
  const [taskListView, setTaskListView] = useState({
    type: TaskListViewType.TODO,
  });

  return (
    <div className={classNames("flex", "flex-row", "h-full")}>
      <SideBar setTaskListView={setTaskListView} taskListView={taskListView} />
      <TaskList taskListView={taskListView} />
    </div>
  );
}

function TaskList({ taskListView }: { taskListView: TaskListView }) {
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
        onFocus={() => {
          setSelectedTask(null);
          setExpandTask(false);
        }}
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
        {tasksForView().map((task) => (
          <TaskCard
            key={task.id}
            onClick={clickTask}
            task={task}
            viewMode={taskCardViewMode(task.id)}
          />
        ))}
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

  function tasksForView(): Task[] {
    switch (taskListView.type) {
      case TaskListViewType.INBOX:
        return repo
          .tasks()
          .map((taskID) => repo.getTask(taskID))
          .filter(
            (task) =>
              !task.completedAt &&
              !task.deletedAt &&
              Object.keys(task.blocks).length == 0 &&
              Object.keys(task.blockedBy).length == 0,
          );

      case TaskListViewType.TODO:
        const graph = buildTaskGraph(repo);
        const order = [];
        for (const generation of topologicalGenerations(graph).toReversed()) {
          sortBy(generation, (id) => repo.getTask(id).title);
          order.push(...generation);
        }
        return order.map((taskID) => repo.getTask(taskID));

      case TaskListViewType.COMPLETED:
        return repo
          .tasks()
          .map((taskID) => repo.getTask(taskID))
          .filter((task) => task.completedAt && !task.deletedAt);

      case TaskListViewType.TRASH:
        return repo
          .tasks()
          .map((taskID) => repo.getTask(taskID))
          .filter((task) => task.deletedAt);

      case TaskListViewType.TASK:
        if (!taskListView.task) {
          throw new Error(
            "Cannot have `TaskListViewType.TASK` without associated task ID.",
          );
        }
        const subGraph = buildTaskSubgraph(repo, taskListView.task);
        const subOrder = [];
        for (const generation of topologicalGenerations(
          subGraph,
        ).toReversed()) {
          sortBy(generation, (id) => repo.getTask(id).title);
          subOrder.push(...generation);
        }
        return subOrder.map((taskID) => repo.getTask(taskID));
    }
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
    if (input.current) {
      input.current.blur();
    }
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

    const tasks = tasksForView();
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

    const tasks = tasksForView();
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

function SideBar({
  setTaskListView,
  taskListView,
}: {
  setTaskListView: (taskListView: TaskListView) => void;
  taskListView: TaskListView;
}) {
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
      <SideBarCategory
        isSelected={taskListView.type == TaskListViewType.INBOX}
        onClick={() => setTaskListView({ type: TaskListViewType.INBOX })}
      >
        Inbox {numInbox > 0 && numInbox}
      </SideBarCategory>

      <hr />

      <div>
        <SideBarCategory
          isSelected={taskListView.type == TaskListViewType.TODO}
          onClick={() => setTaskListView({ type: TaskListViewType.TODO })}
        >
          To Do
        </SideBarCategory>

        <SideBarCategory
          isSelected={taskListView.type == TaskListViewType.COMPLETED}
          onClick={() => setTaskListView({ type: TaskListViewType.COMPLETED })}
        >
          Completed
        </SideBarCategory>

        <SideBarCategory
          isSelected={taskListView.type == TaskListViewType.TRASH}
          onClick={() => setTaskListView({ type: TaskListViewType.TRASH })}
        >
          Trash
        </SideBarCategory>
      </div>

      <hr />

      <div>
        {areas.map((task) => (
          <SideBarCategory
            isSelected={
              taskListView.type == TaskListViewType.TASK &&
              taskListView.task == task.id
            }
            key={task.id}
            onClick={() =>
              setTaskListView({ type: TaskListViewType.TASK, task: task.id })
            }
          >
            {task.title}
          </SideBarCategory>
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

function SideBarCategory({
  children,
  isSelected,
  onClick,
}: PropsWithChildren<{ isSelected: boolean; onClick: () => void }>) {
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
        "active:bg-blue-100",
        "active:border-blue-400",
        {
          "hover:bg-gray-100": !isSelected,
          "bg-blue-100": isSelected,
          "border-blue-400": isSelected,
        },
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
