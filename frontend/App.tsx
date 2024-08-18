import { Map } from "immutable";
import { useEffect, useState, type FormEvent } from "react";
import { uuidv7 } from "uuidv7";

type UUID = string;

interface Task {
  id: UUID;
  title: string;
}

enum Store {
  Task = "task",
}

export default function App() {
  const db = useDatabase("ekad");
  useEffect(loadTasks, [db]);

  const [tasks, setTasks] = useState<Map<UUID, Task>>(Map());
  const [title, setTitle] = useState("");
  
  return (
    <div>
      <form onSubmit={newTask}>
        <input onChange={(e) => setTitle(e.target.value)} placeholder="Title" type="text" value={title} />
        <button disabled={!title}>Submit</button>
      </form>
      
      <ul>
        {tasks.valueSeq().map(task => 
          <li key={task.id}>{task.title}</li>
        )}
      </ul>
    </div>
  );

  function loadTasks() {
    if (!db) { return; }
    const tx = db.transaction(Store.Task, "readonly");
    const store = tx.objectStore("task");

    // TODO: do other state handling here?
    const req = store.getAll();
    let newTasks = tasks;
    req.onsuccess = () => {
      for (const task of req.result) {
        newTasks = newTasks.set(task.id, task);
      }
      setTasks(newTasks);
    };
  }

  function newTask(e: FormEvent) {
    e.preventDefault();
    if (!db) {
      throw new Error("Cannot add task; DB is unavailable?");
    }

    const id = uuidv7();
    const newTask = {
      id: id,
      title: title,
    };

    setTasks(tasks.set(id, {
      id: id,
      title: title,
    }));
    setTitle("");
    
    const tx = db.transaction(Store.Task, "readwrite");
    const store = tx.objectStore("task");
    store.add(newTask);
  }
}

function useDatabase(name: string): IDBDatabase | null {
  const [db, setDB] = useState<IDBDatabase | null>(null);
  useEffect(() => {
    const req = indexedDB.open(name);
    
    req.onupgradeneeded = () => {
      const db = req.result;
      setDB(db);
      if (!db.objectStoreNames.contains(Store.Task)) {
        db.createObjectStore(Store.Task, { keyPath: "id" });
      }
    };

    req.onsuccess = () => {
      setDB(req.result);
    };

    req.onerror = (e) => {
      throw new Error(`Failed to create database: ${e}`);
    };
  }, []);
  return db;
}
