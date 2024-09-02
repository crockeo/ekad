import { useHotkeys } from "./components/HotkeyProvider";
import classNames from "classnames";
import { topologicalGenerations } from "graphology-dag";
import {
  type FormEvent,
  type ReactElement,
  useEffect,
  useRef,
  useState,
} from "react";
import { uuidv7 } from "uuidv7";

import Button from "@ekad/components/Button";
import { useRepo } from "@ekad/components/DocProvider";
import Fold from "@ekad/components/Fold";
import Modal from "@ekad/components/Modal";
import SelectedTaskPane from "@ekad/components/SelectedTaskPane";
import TaskCard, { TaskCardViewMode } from "@ekad/components/TaskCard";
import TaskGraphView from "@ekad/components/TaskGraphView";
import TextInput from "@ekad/components/TextInput";
import type { Task, UUID } from "@ekad/types";
import { buildTaskGraph, sortBy } from "@ekad/utils";

enum View {
  LIST = 0,
  GRAPH = 1,
}

export default function App() {
  const [view, setView] = useState(View.LIST);

  const hotkeys = useHotkeys();
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.code === "Tab") {
        e.preventDefault();
        setView((view) => {
          switch (view) {
            case View.LIST:
              return View.GRAPH;
            case View.GRAPH:
              return View.LIST;
          }
        });
        return true;
      }
      return false;
    };
    return hotkeys.addKeydownHandler(listener);
  }, []);

  return (
    <div
      className="
      flex
      flex-col
      h-screen
      select-none
      w-screen
      "
    >
      <div className="h-[calc(100%-3rem)] w-full">{viewFor(view)}</div>
      <div className="h-[3rem]">
        <BottomBar view={view} setView={setView} />
      </div>
    </div>
  );
}

function viewFor(view: View): ReactElement {
  switch (view) {
    case View.LIST:
      return <ListView />;
    case View.GRAPH:
      return <GraphView />;
  }
}

function ListView() {
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
        "m-auto",
        "px-1",
        "h-full",
        "pt-2",
        "space-y-1",
        "w-screen",
        "md:w-[75vw]",
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

function GraphView() {
  const [selectedTask, setSelectedTask] = useState<UUID | null>(null);
  return (
    <div className="h-full w-full">
      <TaskGraphView onSelectNode={(id) => setSelectedTask(id)} />

      <Modal onRequestClose={() => setSelectedTask(null)} open={!!selectedTask}>
        {selectedTask && (
          <SelectedTaskPane
            onSelectTask={setSelectedTask}
            task={selectedTask}
          />
        )}
      </Modal>
    </div>
  );
}

function BottomBar({
  view,
  setView,
}: {
  view: View;
  setView: (view: View) => void;
}) {
  const buttons = [
    {
      buttonView: View.LIST,
      name: "List",
    },
    {
      buttonView: View.GRAPH,
      name: "Graph",
    },
  ];

  return (
    <div
      className="
      border-gray-200
      border-t
      flex
      flex-row
      justify-center
      py-1
      space-x-2
      w-screen
      "
    >
      {buttons.map(({ buttonView, name }) => (
        <Button
          idleBorder={false}
          onClick={() => setView(buttonView)}
          type={buttonView === view ? "primary" : "secondary"}
          key={buttonView}
        >
          <div className="px-2 py-1">{name}</div>
        </Button>
      ))}
    </div>
  );
}
