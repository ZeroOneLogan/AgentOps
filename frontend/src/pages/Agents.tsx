import { useEffect, useMemo, useState } from "react";
import Button from "../components/Button";
import Input from "../components/Input";
import Textarea from "../components/Textarea";
import Modal from "../components/Modal";
import { EmptyState, ErrorState, LoadingState } from "../components/Status";
import { createAgent, deleteAgent, listAgents, updateAgent } from "../lib/api/agents";
import type { Agent } from "../lib/types";
import { formatDate } from "../lib/ui/format";

type FormState = {
  name: string;
  role: string;
  systemPrompt: string;
  modelProvider: string;
  modelName: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const emptyForm: FormState = {
  name: "",
  role: "",
  systemPrompt: "",
  modelProvider: "",
  modelName: ""
};

export default function Agents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formState, setFormState] = useState<FormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [activeAgent, setActiveAgent] = useState<Agent | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);

  const loadAgents = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await listAgents(100, 0);
      setAgents(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const openCreate = () => {
    setActiveAgent(null);
    setFormState(emptyForm);
    setFormErrors({});
    setFormOpen(true);
  };

  const openEdit = (agent: Agent) => {
    setActiveAgent(agent);
    setFormState({
      name: agent.name,
      role: agent.role,
      systemPrompt: agent.systemPrompt,
      modelProvider: agent.modelProvider || "",
      modelName: agent.modelName || ""
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const validate = () => {
    const errors: FormErrors = {};
    if (!formState.name.trim()) errors.name = "Name is required";
    if (!formState.role.trim()) errors.role = "Role is required";
    if (!formState.systemPrompt.trim()) errors.systemPrompt = "System prompt is required";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    try {
      setSaving(true);
      const payload = {
        name: formState.name.trim(),
        role: formState.role.trim(),
        systemPrompt: formState.systemPrompt.trim(),
        modelProvider: formState.modelProvider.trim() || undefined,
        modelName: formState.modelName.trim() || undefined
      };

      if (activeAgent) {
        await updateAgent(activeAgent.id, payload);
      } else {
        await createAgent(payload);
      }

      setFormOpen(false);
      await loadAgents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save agent");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAgent(deleteTarget.id);
      setDeleteTarget(null);
      await loadAgents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete agent");
    }
  };

  const headerMeta = useMemo(() => `${agents.length} total`, [agents.length]);

  if (loading) {
    return <LoadingState title="Loading agents" />;
  }

  if (error) {
    return <ErrorState title="Agents failed" message={error} actionLabel="Retry" onAction={loadAgents} />;
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Agents</p>
          <h1>Agent registry</h1>
          <p className="page-subtitle">{headerMeta}. Configure roles, prompts, and model metadata.</p>
        </div>
        <div className="page-actions">
          <Button variant="primary" onClick={openCreate}>
            New Agent
          </Button>
        </div>
      </div>

      {agents.length === 0 ? (
        <EmptyState
          title="No agents yet"
          message="Create your first agent to start capturing runs and logs."
          actionLabel="Create agent"
          onAction={openCreate}
        />
      ) : (
        <div className="table">
          <div className="table__row table__row--head">
            <div>Name</div>
            <div>Role</div>
            <div>Updated</div>
            <div className="table__actions">Actions</div>
          </div>
          {agents.map((agent) => (
            <div key={agent.id} className="table__row">
              <div>
                <p className="table__title">{agent.name}</p>
                <p className="table__meta">{agent.id}</p>
              </div>
              <div>{agent.role}</div>
              <div>{formatDate(agent.updatedAt)}</div>
              <div className="table__actions">
                <Button variant="ghost" onClick={() => openEdit(agent)}>
                  Edit
                </Button>
                <Button variant="danger" onClick={() => setDeleteTarget(agent)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        title={activeAgent ? "Edit agent" : "Create agent"}
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
      >
        <div className="form-grid">
          <Input
            label="Name"
            value={formState.name}
            onChange={(event) => setFormState({ ...formState, name: event.target.value })}
            error={formErrors.name}
          />
          <Input
            label="Role"
            value={formState.role}
            onChange={(event) => setFormState({ ...formState, role: event.target.value })}
            error={formErrors.role}
          />
          <Textarea
            label="System prompt"
            value={formState.systemPrompt}
            onChange={(event) => setFormState({ ...formState, systemPrompt: event.target.value })}
            error={formErrors.systemPrompt}
            rows={4}
          />
          <Input
            label="Model provider (optional)"
            value={formState.modelProvider}
            onChange={(event) => setFormState({ ...formState, modelProvider: event.target.value })}
          />
          <Input
            label="Model name (optional)"
            value={formState.modelName}
            onChange={(event) => setFormState({ ...formState, modelName: event.target.value })}
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
        title="Delete agent"
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
      >
        <p>
          Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
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
