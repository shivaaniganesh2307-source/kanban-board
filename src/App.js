import React, { useEffect, useState } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { createClient } from "@supabase/supabase-js";
import "./App.css";

// Initialize Supabase
const supabaseUrl = "https://sgwutvpmohhyhhowewpn.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnd3V0dnBtb2hoeWhob3dld3BuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDgyNzUsImV4cCI6MjA5MDYyNDI3NX0.KsMf9u-VRX9_b4DaAgbXsc8eBam1sEG3DP0Zn-DODRQ";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

function App() {
  const [user, setUser] = useState(null);
  const [columns, setColumns] = useState([]);
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("All");
  const [taskDialog, setTaskDialog] = useState({ open: false, task: null });
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Initialize user
  const initUser = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) setUser(currentUser);
    else setUser({ id: "guest-1" });
  };

  // Load team members for assignee dropdown
  const loadTeamMembers = async () => {
    const { data } = await supabase.from("users").select("id, email");
    setTeamMembers(data || []);
  };

  // Load board
  const loadBoard = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let data = [];
      if (user.id === "guest-1") {
        data = columns.flatMap(c => c.tasks || []);
      } else {
        const { data: dbData, error } = await supabase
          .from("tasks")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });
        if (error) console.error(error);
        data = dbData || [];
      }

      const statuses = ["todo", "in_progress", "in_review", "done"];
      const cols = statuses.map(status => ({
        id: status,
        name: status.replace("_", " ").toUpperCase(),
        tasks: data.filter(t => t.status === status),
      }));
      setColumns(cols);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initUser();
    loadTeamMembers();
  }, []);

  useEffect(() => {
    if (user) loadBoard();
  }, [user]);

  // Filter tasks
  const filteredTasks = tasks =>
    tasks.filter(task => {
      const haystack = [task.title, task.description].join(" ").toLowerCase();
      const searchMatch = haystack.includes(search.toLowerCase());
      const priorityMatch = priority === "All" || task.priority === priority;
      return searchMatch && priorityMatch;
    });

  // Drag & Drop
  const onDragEnd = async result => {
    const { destination, source, draggableId } = result;
    if (!destination) return;

    const sourceCol = columns.find(c => c.id === source.droppableId);
    const destCol = columns.find(c => c.id === destination.droppableId);
    const task = sourceCol.tasks.find(t => t.id === draggableId);
    if (!task) return;

    sourceCol.tasks = sourceCol.tasks.filter(t => t.id !== draggableId);
    destCol.tasks.splice(destination.index, 0, task);
    setColumns([...columns]);

    if (user.id !== "guest-1") {
      const { error } = await supabase
        .from("tasks")
        .update({ status: destCol.id })
        .eq("id", draggableId)
        .eq("user_id", user.id);
      if (error) console.error(error);
    }
  };

  // Create or update task
  const createTask = async task => {
    if (!task.title) return alert("Title is required");

    const newTask = {
      ...task,
      user_id: user.id,
      status: task.status || "todo",
    };

    if (task.id) {
      // Update
      if (user.id !== "guest-1") {
        await supabase.from("tasks")
          .update({
            title: task.title,
            description: task.description,
            priority: task.priority,
            due_date: task.due_date || null,
            assignee_id: task.assignee_id || null,
            status: task.status,
          })
          .eq("id", task.id)
          .eq("user_id", user.id);
      } else {
        const colsCopy = [...columns];
        colsCopy.forEach(c => {
          c.tasks = c.tasks.map(t => t.id === task.id ? task : t);
        });
        setColumns(colsCopy);
      }
    } else {
      // Create
      if (user.id !== "guest-1") {
        await supabase.from("tasks").insert([{
          ...newTask,
          due_date: task.due_date || null,
          assignee_id: task.assignee_id || null
        }]);
      } else {
        newTask.id = `guest-${Date.now()}`;
        const colsCopy = [...columns];
        const col = colsCopy.find(c => c.id === newTask.status);
        col.tasks.push(newTask);
        setColumns(colsCopy);
      }
    }

    setTaskDialog({ open: false, task: null });
    loadBoard();
  };

  const deleteTask = async taskId => {
    if (user.id !== "guest-1") {
      await supabase.from("tasks").delete().eq("id", taskId).eq("user_id", user.id);
      loadBoard();
    } else {
      const colsCopy = [...columns];
      colsCopy.forEach(c => { c.tasks = c.tasks.filter(t => t.id !== taskId); });
      setColumns(colsCopy);
    }
  };

  if (loading) return <div>Loading board...</div>;

  return (
    <div className="App">
      <h1>Kanban Board</h1>

      <div className="filters">
        <input
          placeholder="Search tasks..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select value={priority} onChange={e => setPriority(e.target.value)}>
          <option>All</option>
          <option>Low</option>
          <option>Medium</option>
          <option>High</option>
        </select>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="board">
          {columns.map(col => (
            <Droppable droppableId={col.id} key={col.id}>
              {provided => (
                <div className="column" ref={provided.innerRef} {...provided.droppableProps}>
                  <h2>{col.name}</h2>
                  {filteredTasks(col.tasks).map((task, index) => (
                    <Draggable key={task.id} draggableId={task.id} index={index}>
                      {provided => (
                        <div
                          className={`task priority-${task.priority?.toLowerCase()}`}
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                        >
                          <h3>{task.title}</h3>
                          <p>{task.description}</p>
                          <p>Due: {task.due_date || "None"}</p>
                          <p>Assignee: {teamMembers.find(m => m.id === task.assignee_id)?.email || "Unassigned"}</p>
                          <div className="task-buttons">
                            <button onClick={() => setTaskDialog({ open: true, task })}>Edit</button>
                            <button onClick={() => deleteTask(task.id)}>Delete</button>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                  <button className="add-task-btn" onClick={() => setTaskDialog({ open: true, task: { status: col.id } })}>
                    + Add Task
                  </button>
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>

      {taskDialog.open && (
        <div className="modal">
          <h2>{taskDialog.task.id ? "Edit Task" : "Create Task"}</h2>
          <input
            placeholder="Title"
            value={taskDialog.task.title || ""}
            onChange={e => setTaskDialog({ open: true, task: { ...taskDialog.task, title: e.target.value } })}
          />
          <textarea
            placeholder="Description"
            value={taskDialog.task.description || ""}
            onChange={e => setTaskDialog({ open: true, task: { ...taskDialog.task, description: e.target.value } })}
          />
          <select
            value={taskDialog.task.priority || "Medium"}
            onChange={e => setTaskDialog({ open: true, task: { ...taskDialog.task, priority: e.target.value } })}
          >
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
          <input
            type="date"
            value={taskDialog.task.due_date || ""}
            onChange={e => setTaskDialog({ open: true, task: { ...taskDialog.task, due_date: e.target.value } })}
          />
          <select
            value={taskDialog.task.assignee_id || ""}
            onChange={e => setTaskDialog({ open: true, task: { ...taskDialog.task, assignee_id: e.target.value } })}
          >
            <option value="">Unassigned</option>
            {teamMembers.map(m => <option key={m.id} value={m.id}>{m.email}</option>)}
          </select>
          <div className="modal-buttons">
            <button onClick={() => createTask(taskDialog.task)}>Save</button>
            <button onClick={() => setTaskDialog({ open: false, task: null })}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;