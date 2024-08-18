import { Map } from "immutable";
import { useState, type FormEvent } from "react";
import { uuidv7 } from "uuidv7";

type UUID = string;

interface Task {
  id: UUID;
  title: string;
}

export default function App() {
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
          <li>{task.title}</li>
        )}
      </ul>
    </div>
  );

  function newTask(e: FormEvent) {
    e.preventDefault();
    const id = uuidv7();
    setTasks(tasks.set(id, {
      id: id,
      title: title,
    }));
    setTitle("");
  }
}
