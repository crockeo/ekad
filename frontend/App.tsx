import type { AutomergeUrl, Doc } from "@automerge/automerge-repo";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import { Map } from "immutable";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { uuidv7 } from "uuidv7";
import type { Ekad, Task, UUID } from "./types";
import classNames from "classnames";
import TaskSearcher from "./components/TaskSearcher";

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
      px-4
      py-8
      md:grid-cols-3
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
                className={classNames(
                  "cursor-pointer",
                  "flex",
                  "flex-row",
                  "justify-between",
                  {
                    "line-through": task.completedAt,
                    "text-gray-400": task.completedAt,
                  },
                )}
                key={task.id}
                onClick={() => setSelectedTask(task)}
              >
                <div>
                  <input
                    className="accent-gray-200"
                    checked={!!task.completedAt}
                    onChange={(e) => completeTask(e, task)}
                    type="checkbox"
                  />
                  <span className="px-2">{task.title}</span>
                </div>
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

      <div className="col-span-2 px-4 mt-4 md:mt-0">
        {doc && selectedTask ? (
          <SelectedTaskPane
            doc={doc}
            onAddEdge={addEdge}
            onChange={(task) => setTask(task)}
            onSelectTask={setSelectedTask}
            task={selectedTask}
          />
        ) : (
          <div className="text-gray-600 text-lg italic">No task selected.</div>
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
      blocks: [],
      blockedBy: [],
    };

    setTitle("");
    setTask(newTask);
  }

  function completeTask(e: ChangeEvent<HTMLInputElement>, task: Task) {
    setTask({
      ...task,
      completedAt: e.target.checked ? new Date() : null,
    });
  }

  function deleteTask(task: Task) {
    setTask({
      ...task,
      deletedAt: new Date(),
    });
  }

  function addEdge(from: UUID, to: UUID): void {
    changeDoc((doc) => {
      if (!doc.tasks[from].blockedBy) {
        doc.tasks[from].blockedBy = [];
      }
      if (!doc.tasks[to].blocks) {
        doc.tasks[to].blocks = [];
      }

      if (doc.tasks[from].blockedBy.findIndex(val => val == from) == -1) {
        doc.tasks[from].blockedBy.push(to);
      }
      if (doc.tasks[to].blocks.findIndex(val => val == to) == -1) {
        doc.tasks[to].blocks.push(from);
      }
    })
  }

  function setTask(task: Task) {
    // TODO: instead of just reassigning stuff, make sure that we do updateText(...)
    // where appropriate, for better, more efficient text replacement
    if (task.deletedAt) {
      setTasks(tasks.delete(task.id));
    } else {
      setTasks(tasks.set(task.id, task));
    }

    console.log(task);

    changeDoc((doc) => {
      if (!doc.tasks) {
        doc.tasks = {};
      }
      doc.tasks[task.id] = task;
    });
  }
}

function SelectedTaskPane({
  doc,
  onAddEdge,
  onChange,
  onSelectTask,
  task,
}: {
  doc: Doc<Ekad>;
  onAddEdge: (from: UUID, to: UUID) => void;
  onChange: (task: Task) => void;
  onSelectTask: (task: Task) => void;
  task: Task;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || "");
  }, [task]);

  const titleArea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (titleArea.current) {
      updateTextAreaHeight(titleArea.current);
    }
  }, [title]);

  const descriptionArea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (descriptionArea.current) {
      updateTextAreaHeight(descriptionArea.current);
    }
  }, [description]);

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
        value={title}
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
          {task.blocks?.map(id =>
            <TaskChip
              key={id}
              onClick={() => onSelectTask(doc.tasks[id])}
              task={doc.tasks[id]} />
          )}
          <TaskSearcher
            doc={doc}
            ignore={[
              task.id,
              ...task.blocks || [],
            ]}
            onChooseTask={(chosenTask) => onAddEdge(chosenTask.id, task.id)}
          />
        </div>

        <div className="space-x-2">
          <span className="mr-2">Blocked by:</span>
          {task.blockedBy?.map(id =>
            <TaskChip
              key={id}
              onClick={() => onSelectTask(doc.tasks[id])}
              task={doc.tasks[id]} />
          )}
          <TaskSearcher
            doc={doc}
            ignore={[
              task.id,
              ...task.blockedBy || [],
            ]}
            onChooseTask={(chosenTask) => onAddEdge(task.id, chosenTask.id)}
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
        value={description}
      ></textarea>
    </div>
  );

  function updateTitle(title: string): void {
    // TODO: debounce
    title = title.replaceAll("\n", "");
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

  function updateTextAreaHeight(element: HTMLTextAreaElement): void {
    element.style.height = "1px";
    element.style.height = `${element.scrollHeight}px`;
  }
}

function TaskChip({ onClick, task }: { onClick: () => void; task: Task; }) {
  let title = task.title;
  if (title.length > 15) {
    title = title.substring(0, 15);
    title = `${title}...`;
  }
  return (
    <span
      className="
      bg-gray-200
      cursor-pointer
      px-2
      py-1
      rounded-lg
      text-gray-500
      "
      key={task.id}
      onClick={() => onClick()}
    >
      {title}
    </span>
  );
}
