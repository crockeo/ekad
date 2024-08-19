import { Map } from "immutable";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { uuidv7 } from "uuidv7";
import type { Task, UUID } from "./types";
import classNames from "classnames";
import TaskSearcher from "./components/TaskSearcher";
import { useDoc } from "./components/DocProvider";
import Fold from "./components/Fold";

export default function App() {
  const [doc, changeDoc] = useDoc();
  useEffect(loadTasks, [doc]);

  const [title, setTitle] = useState("");
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
          {openTasks().map((task) => (
            <TaskItem onClick={setSelectedTask} task={task} />
          ))}
          <Fold name="Completed Tasks">
            {completedTasks().map((task) => (
              <TaskItem onClick={setSelectedTask} task={task} />
            ))}
          </Fold>
        </div>
      </div>

      <div className="col-span-2 px-4 mt-4 md:mt-0">
        {doc && selectedTask ? (
          <SelectedTaskPane
            onSelectTask={setSelectedTask}
            task={selectedTask}
          />
        ) : (
          <div className="text-gray-600 text-lg italic">No task selected.</div>
        )}
      </div>
    </div>
  );

  function openTasks(): Task[] {
    return Object.values(doc?.tasks).filter(
      (task) => !task.completedAt && !task.deletedAt,
    );
  }

  function completedTasks(): Task[] {
    return Object.values(doc?.tasks).filter(
      (task) => task.completedAt && !task.deletedAt,
    );
  }

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
    changeDoc((doc) => {
      doc.tasks[newTask.id] = newTask;
    });
  }
}

function TaskItem({
  onClick,
  task,
}: {
  onClick: (task: Task) => void;
  task: Task;
}) {
  const [_, changeDoc] = useDoc();
  return (
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
      onClick={() => onClick(task)}
    >
      <div>
        <input
          className="accent-gray-200"
          checked={!!task.completedAt}
          onChange={(e) => completeTask(e, task)}
          type="checkbox"
        />
        <span className="px-2 select-none">{task.title}</span>
      </div>
      <button
        className="cursor-pointer text-red-500 text-xs"
        onClick={() => deleteTask(task)}
      >
        (delete)
      </button>
    </div>
  );

  function completeTask(e: ChangeEvent<HTMLInputElement>, task: Task) {
    const newCompletedAt = e.target.checked ? new Date() : null;
    changeDoc((doc) => {
      doc.tasks[task.id].completedAt = newCompletedAt;
    });
  }

  function deleteTask(task: Task) {
    const newDeletedAt = new Date();
    changeDoc((doc) => {
      doc.tasks[task.id].deletedAt = newDeletedAt;
    });
  }
}

function SelectedTaskPane({
  onSelectTask,
  task,
}: {
  onSelectTask: (task: Task) => void;
  task: Task;
}) {
  const [doc, changeDoc] = useDoc();
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
          {task.blocks?.map((id) => (
            <TaskChip
              key={id}
              onClick={() => onSelectTask(doc.tasks[id])}
              task={doc.tasks[id]}
            />
          ))}
          <TaskSearcher
            doc={doc}
            ignore={[task.id, ...(task.blocks || [])]}
            onChooseTask={(chosenTask) => addEdge(chosenTask.id, task.id)}
          />
        </div>

        <div className="space-x-2">
          <span className="mr-2">Blocked by:</span>
          {task.blockedBy?.map((id) => (
            <TaskChip
              key={id}
              onClick={() => onSelectTask(doc.tasks[id])}
              task={doc.tasks[id]}
            />
          ))}
          <TaskSearcher
            doc={doc}
            ignore={[task.id, ...(task.blockedBy || [])]}
            onChooseTask={(chosenTask) => addEdge(task.id, chosenTask.id)}
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

  function addEdge(from: UUID, to: UUID): void {
    changeDoc((doc) => {
      if (!doc.tasks[from].blockedBy) {
        doc.tasks[from].blockedBy = [];
      }
      if (!doc.tasks[to].blocks) {
        doc.tasks[to].blocks = [];
      }

      if (doc.tasks[from].blockedBy.findIndex((val) => val == from) == -1) {
        doc.tasks[from].blockedBy.push(to);
      }
      if (doc.tasks[to].blocks.findIndex((val) => val == to) == -1) {
        doc.tasks[to].blocks.push(from);
      }
    });
  }

  function updateTitle(title: string): void {
    // TODO: debounce
    // TODO: updateText instead of assigning
    title = title.replaceAll("\n", "");
    setTitle(title);
    changeDoc((doc) => {
      doc.tasks[task.id].title = title;
    });
  }

  function updateDescription(description: string): void {
    // TODO: debounce
    // TODO: updateText instead of assigning
    setDescription(description);
    changeDoc((doc) => {
      doc.tasks[task.id].description = description;
    });
  }

  function updateTextAreaHeight(element: HTMLTextAreaElement): void {
    element.style.height = "1px";
    element.style.height = `${element.scrollHeight}px`;
  }
}

function TaskChip({ onClick, task }: { onClick: () => void; task: Task }) {
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
