import type { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import { Map } from "immutable";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { uuidv7 } from "uuidv7";
import type { Ekad, Task, UUID } from "./types";

export default function App({ docUrl }: { docUrl: AutomergeUrl }) {
  const [doc, changeDoc] = useDocument<Ekad>(docUrl);
  useEffect(loadTasks, [doc]);

  const [tasks, setTasks] = useState<Map<UUID, Task>>(Map());
  const [title, setTitle] = useState("");

  return (
    <div>
      <form onSubmit={newTask}>
        <input
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          type="text"
          value={title}
        />
        <button disabled={!title}>Submit</button>
      </form>

      <ul>
        {tasks
          .valueSeq()
          .sortBy((task) => [!!task.completedAt, task.title])
          .map((task) => (
            <div
              key={task.id}
              style={{
                display: "flex",
                flexDirection: "row",
                color: task.completedAt ? "#aaaaaa" : undefined,
                textDecoration: task.completedAt ? "line-through" : undefined,
              }}
            >
              <input
                checked={!!task.completedAt}
                onChange={(e) => completeTask(e, task)}
                type="checkbox"
                style={{
                  accentColor: "#cccccc",
                }}
              />
              <span>{task.title}</span>
              <button
                onClick={() => deleteTask(task)}
                style={{
                  backgroundColor: "rgba(0, 0, 0, 0)",
                  borderStyle: "none",
                  color: "red",
                  cursor: "pointer",
                  fontSize: "0.6rem",
                }}
              >
                (delete)
              </button>
            </div>
          ))}
      </ul>
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
