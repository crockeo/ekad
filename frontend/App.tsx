import { useState, type FormEvent } from "react";
import GraphView, { type GraphData, type NodeObject } from "./components/GraphView";
import Button from "./components/Button";
import TextInput from "./components/TextInput";
import styled from "styled-components";
import { uuidv7 } from "uuidv7";
import Modal from "./components/Modal";
import { Map } from "immutable";

type UUID = string;

interface Task {
  id: UUID;
  title: string;
  completedAt: Date | null;
  dependsOn: UUID[];
}

export default function App() {
  const [modalTask, setModalTask] = useState<Task | null>(null);
  
  const [title, setTitle] = useState("");
  const [tasks, setTasks] = useState<Map<UUID, Task>>(Map());
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
          {tasks.valueSeq().map(task =>
            <li onClick={() => setModalTask(task)} key={task.id}>{task.title}</li>)
          }
        </ul>
      </TaskBar>

      <GraphView
        data={graphData}
        onNodeClick={(node, evt) => {
          evt.preventDefault();
          const task = tasks.get(node.id);
          if (!task) {
            // TODO: do something more interesting here to show this to the user???
            // or how would this have happened?
            throw Error(`Node click on node whose ID does not match a task: '${node.id}'`);
          }
          setModalTask(task);
        }}
      />

      <Modal
        onRequestClose={saveModalTask}
        open={!!modalTask}
      >
        {modalTask && <ModalTaskCard task={modalTask} />}
      </Modal>
    </AppContainer>
  );

  function nodeFromTask(task: Task): NodeObject {
    return {
      id: task.id,
      name: task.title,
    };
  }

  function newTask(e: FormEvent) {
    e.preventDefault();

    const id = uuidv7();
    const newTasks = tasks.set(
      id,
      {
        id: id,
        title: title,
        completedAt: null,
        dependsOn: [],
      },
    );
    setTasks(newTasks);
    setTitle("");

    const nodes = [];
    for (const task of newTasks.values()) {
      nodes.push(nodeFromTask(task));
    }
    setGraphData({
      nodes: nodes,
      links: [],
    });
  }

  function saveModalTask() {
    // TODO: update the task in our task list!
    setModalTask(null);
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

interface ModalTaskCardProps {
  task: Task,
}

function ModalTaskCard({ task }: ModalTaskCardProps) {
  return (
    <div>
      <div>{task.title}</div>
      <div>{task.id}</div>
    </div>
  );
}

