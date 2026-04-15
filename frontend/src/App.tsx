import { useState, useEffect } from "react";
import { TaskForm } from "./components/TaskForm";
import { TaskList } from "./components/TaskList";
import type { Task } from "./types/task";
import "./index.css"
import { fetchTasks, createTask, updateTask, deleteTask } from "./api/tasks";

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const loadTasks = async () => {
      try {
        const data = await fetchTasks();
        setTasks(data)
      } catch (error) {
        setErrorMessage("Failed to load tasks.")
      }
    };

    void loadTasks();
  }, [])

  const handleAddTask = async (title: string) => {
    try {
      const newTask = await createTask({ title });
      setTasks((prevTasks) => [...prevTasks, newTask]);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage("Failed to add task.")
    }
  }

  const handleToggleTask = async (id: number) => {
    const targetTask = tasks.find((task) => task.id == id);
    if (!targetTask) return;

    try {
      const updatedTask = await updateTask(id, {
        title: targetTask.title,
        done: !targetTask.done,
      });

      setTasks((prevTasks) =>
        prevTasks.map((task) => (task.id == id ? updatedTask : task)),
      );
      setErrorMessage("");
    } catch (error) {
      setErrorMessage("Failed to update task.")
    }
  };

  const handleDeleteTask = async (id: number) => {
    try {
      await deleteTask(id);
      setTasks((prevTasks) => prevTasks.filter((task) => task.id !== id));
      setErrorMessage("");
    } catch (error) {
      setErrorMessage("Failed to delete task.");
    }
  };

  return (
    <main>
      <h1>Task management App</h1>
      <TaskForm onAdd={handleAddTask} />
      {errorMessage ? <p>{errorMessage}</p> : null}
      <TaskList
        tasks={tasks}
        onToggle={handleToggleTask}
        onDelete={handleDeleteTask}
      />
    </main>
  )
}

export default App;
