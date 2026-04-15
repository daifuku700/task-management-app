import { useState } from "react";

type TaskFormProps = {
  onAdd: (title: string) => void;
}

export function TaskForm({ onAdd }: TaskFormProps) {
  const [title, setTitle] = useState("");

  const submitAction = (formData: FormData) => {
    const rawTitle = formData.get("title")
    const nextTitle = typeof rawTitle == "string" ? rawTitle.trim() : "";

    if (!nextTitle) return;

    onAdd(nextTitle);
    setTitle("");
  };

  return (
    <form action={submitAction}>
      <input
        name="title"
        type="text"
        value={title}
        onChange={(event) => setTitle((event.target.value))}
        placeholder="Enter a task"
      />
      <button type="submit">Add</button>
    </form>
  )
}
