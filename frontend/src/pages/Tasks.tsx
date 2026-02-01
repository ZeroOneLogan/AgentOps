import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../components/Button";
import Input from "../components/Input";
import Textarea from "../components/Textarea";
import Select from "../components/Select";
import Modal from "../components/Modal";
import { EmptyState, ErrorState, LoadingState } from "../components/Status";
import { createTask, deleteTask, listTasks, updateTask } from "../lib/api/tasks";
import type { Task, TaskStatus } from "../lib/types";
import { formatDate } from "../lib/ui/format";

const statusOptions = [
  { value: "queued", label: "Queued" },
  { value: "running", label: "Running" },
  { value: "succeeded", label: "Succeeded" },
  { value: "failed", label: "Failed" }
];

type FormState = {
  title: string;
  description: string;
  status: TaskStatus;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const emptyForm: FormState = {
  title: "",
  description: "",
  status: "queued"
};

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formState, setFormState] = useState<FormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  const loadTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await listTasks(100, 0);
      setTasks(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const openCreate = () => {
    setActiveTask(null);
    setFormState(emptyForm);
    setFormErrors({});
    setFormOpen(true);
  };

  const openEdit = (task: Task) => {
    setActiveTask(task);
    setFormState({
      title: task.title,
      description: task.description || "",
      status: task.status
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const validate = () => {
    const errors: FormErrors = {};
    if (!formState.title.trim()) errors.title = "Title is required";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    try {
      setSaving(true);
      const payload = {
        title: formState.title.trim(),
        description: formState.description.trim() || undefined,
        status: formState.status
      };

      if (activeTask) {
        await updateTask(activeTask.id, payload);
      } else {
        await createTask(payload);
      }

      setFormOpen(false);
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save task");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteTask(deleteTarget.id);
      setDeleteTarget(null);
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete task");
    }
  };

  const headerMeta = useMemo(() => `${tasks.length} total`, [tasks.length]);

  if (loading) {
    return <LoadingState title="Loading tasks" />;
  }

  if (error) {
    return <ErrorState title="Tasks failed" message={error} actionLabel="Retry" onAction={loadTasks} />;
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Tasks</p>
          <h1>Task backlog</h1>
          <p className="page-subtitle">{headerMeta}. Track queue status and task metadata.</p>
        </div>
        <div className="page-actions">
          <Button variant="primary" onClick={openCreate}>
            New Task
          </Button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          message="Create your first task to start running agents."
          actionLabel="Create task"
          onAction={openCreate}
        />
      ) : (
        <div className="table">
          <div className="table__row table__row--head">
            <div>Title</div>
            <div>Status</div>
            <div>Updated</div>
            <div className="table__actions">Actions</div>
          </div>
          {tasks.map((task) => (
            <div key={task.id} className="table__row">
              <div>
                <Link to={`/tasks/${task.id}`} className="table__title link">
                  {task.title}
                </Link>
                <p className="table__meta">{task.id}</p>
              </div>
              <div className={`badge badge--${task.status}`}>{task.status}</div>
              <div>{formatDate(task.updatedAt)}</div>
              <div className="table__actions">
                <Button variant="ghost" onClick={() => openEdit(task)}>
                  Edit
                </Button>
                <Button variant="danger" onClick={() => setDeleteTarget(task)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        title={activeTask ? "Edit task" : "Create task"}
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
      >
        <div className="form-grid">
          <Input
            label="Title"
            value={formState.title}
            onChange={(event) => setFormState({ ...formState, title: event.target.value })}
            error={formErrors.title}
          />
          <Textarea
            label="Description"
            value={formState.description}
            onChange={(event) => setFormState({ ...formState, description: event.target.value })}
            rows={4}
          />
          <Select
            label="Status"
            options={statusOptions}
            value={formState.status}
            onChange={(event) => setFormState({ ...formState, status: event.target.value as TaskStatus })}
          />
        </div>
        <div className="modal__footer">
          <Button variant="ghost" onClick={() => setFormOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </Modal>

      <Modal
        title="Delete task"
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
      >
        <p>
          Are you sure you want to delete <strong>{deleteTarget?.title}</strong>? This cannot be undone.
        </p>
        <div className="modal__footer">
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirmDelete}>
            Delete
          </Button>
        </div>
      </Modal>
    </section>
  );
}
