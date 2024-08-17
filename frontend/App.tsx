import { useState, type FormEvent } from "react";
import GraphView, { type GraphData, type NodeObject } from "./components/GraphView";
import Button from "./components/Button";
import TextInput from "./components/TextInput";
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
        <TaskForm onSubmit={newTask}>
          <TextInput
            onChange={(newValue) => setTitle(newValue)}
            placeholder="Title"
            value={title}
          />
          <Button disabled={!title} type="constructive">Add</Button>
        </TaskForm>

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
  border-right: 1px solid;
  padding: 1rem;
  display: flex;
  flex-direction: column;
`;

const TaskForm = styled.form`
  display: flex;
  flex-direction: row;
  gap: 1rem;
`;
