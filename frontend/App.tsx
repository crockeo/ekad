import type { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import { Map } from "immutable";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { uuidv7 } from "uuidv7";
import type { Ekad, Task, UUID } from "./types";
import classNames from "classnames";

export default function App({ docUrl }: { docUrl: AutomergeUrl }) {
  const [doc, changeDoc] = useDocument<Ekad>(docUrl);
  useEffect(loadTasks, [doc]);

  const [title, setTitle] = useState("");
  const [tasks, setTasks] = useState<Map<UUID, Task>>(Map());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  return (
    <div
      className="
      grid
      grid-cols-3
      px-4
      py-8
      "
    >
      <div className="col-span-1 px-4">
        <form className="flex flex-row" onSubmit={newTask}>
          <input
            className="
            border
            grow
            rounded
            p-2
            text-md
            focus:outline-none
            "
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            type="text"
            value={title}
          />

          <div className="mx-2" />

          <button
            className={classNames(
              "bg-emerald-500",
              "px-4",
              "py-2",
              "rounded",
              "text-white",
              {
                "bg-gray-300": !title,
                "cursor-pointer": !!title,
                "hover:bg-emerald-600": !!title,
                "active:bg-emerald-700": !!title,
              },
            )}
            disabled={!title}
          >
            Submit
          </button>
        </form>

        <div className="my-4" />

        <div className="space-y-1">
          {tasks
            .valueSeq()
            .sortBy((task) => [!!task.completedAt, task.title])
            .map((task) => (
              <div
                className={classNames("flex", "flex-row", "cursor-pointer", {
                  "line-through": task.completedAt,
                  "text-gray-400": task.completedAt,
                })}
                key={task.id}
                onClick={() => setSelectedTask(task)}
              >
                <input
                  className="accent-gray-200"
                  checked={!!task.completedAt}
                  onChange={(e) => completeTask(e, task)}
                  type="checkbox"
                />
                <span className="px-2">{task.title}</span>
                <button
                  className="cursor-pointer text-red-500 text-xs"
                  onClick={() => deleteTask(task)}
                >
                  (delete)
                </button>
              </div>
            ))}
        </div>
      </div>

      <div className="col-span-2 px-4">
        {selectedTask ? (
          <SelectedTaskPane
            onChange={(task) => setTask(task)}
            task={selectedTask}
          />
        ) : (
          <div>No task selected.</div>
        )}
      </div>
    </div>
  );

  function loadTasks() {
    if (!doc?.tasks) {
      return;
    }
    let tasks = Map<UUID, Task>();
    for (const task of Object.values(doc.tasks)) {
      if (!task.deletedAt) {
        tasks = tasks.set(task.id, task);
      }
    }
    setTasks(tasks);
  }

  function newTask(e: FormEvent) {
    e.preventDefault();
    if (!doc) {
      throw new Error("Cannot add task; DB is unavailable?");
    }

    const id = uuidv7();
    const newTask = {
      id: id,
      title: title,
      description: "",
      completedAt: null,
      deletedAt: null,
    };

    setTitle("");
    setTask(newTask);
  }

  function completeTask(e: ChangeEvent<HTMLInputElement>, task: Task) {
    const newCompletedAt = e.target.checked ? new Date() : null;

    const newTask = {
      ...task,
      completedAt: newCompletedAt,
    };

    setTask(newTask);
  }

  function deleteTask(task: Task) {
    setTask({
      ...task,
      deletedAt: new Date(),
    });
  }

  function setTask(task: Task) {
    // TODO: instead of just reassigning stuff, make sure that we do updateText(...)
    // where appropriate, for better, more efficient text replacement
    if (task.deletedAt) {
      setTasks(tasks.delete(task.id));
    } else {
      setTasks(tasks.set(task.id, task));
    }

    changeDoc((doc) => {
      if (!doc.tasks) {
        doc.tasks = {};
      }
      doc.tasks[task.id] = task;
    });
  }
}

function SelectedTaskPane({
  onChange,
  task,
}: {
  onChange: (task: Task) => void;
  task: Task;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || "");
  }, [task]);

  return (
    <div>
      <input
        className="
        focus:outline-none
        font-semibold
        text-xl
        w-full
        "
        onChange={(e) => updateTitle(e.target.value)}
        placeholder="Title"
        type="text"
        value={title}
      />

      <textarea
        className="
        border
        p-2
        resize-none
        rounded
        w-full
        "
        onChange={(e) => updateDescription(e.target.value)}
        value={description}
      ></textarea>
    </div>
  );

  function updateTitle(title: string): void {
    // TODO: debounce
    setTitle(title);
    onChange({
      ...task,
      title: title,
    });
  }

  function updateDescription(description: string): void {
    setDescription(description);
    onChange({
      ...task,
      description: description,
    });
  }
}
