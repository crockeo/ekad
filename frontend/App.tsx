import { useState, type FormEvent } from "react";
import GraphView, { GraphData, type NodeObject } from "./components/GraphView";
import styled from "styled-components";

interface Task {
  title: string;
  completedAt: Date | null;
}

export default function App() {
  const [title, setTitle] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });

  return (
    <AppContainer>
      <TaskBar>
        <form onSubmit={newTask}>
          <input
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            type="text"
            value={title}
          />
          <button disabled={!title}>Add</button>
        </form>

        <ul>
          {tasks.map(task =>
            <li>{task.title}</li>)
          }
        </ul>
      </TaskBar>

      <GraphView data={graphData} />
    </AppContainer>
  );

  function nodeFromTask(task: Task): NodeObject {
    return {
      id: task.title,
    };
  }

  function newTask(e: FormEvent) {
    e.preventDefault();

    const newTasks = [
      ...tasks,
      {
        title: title,
        completedAt: null,
      },
    ];
    
    setTasks(newTasks);
    setTitle("");
    setGraphData({
      nodes: newTasks.map(nodeFromTask),
      links: [],
    });
  }
}

const AppContainer = styled.div`
  display: flex;
  flex-direction: row;
`;

const TaskBar = styled.div`
  display: flex;
  flex-direction: column;
`;

const GraphContainer = styled.div`
`;
