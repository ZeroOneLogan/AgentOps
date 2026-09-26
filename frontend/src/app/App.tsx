import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./AppLayout";
import Dashboard from "../pages/Dashboard";
import Agents from "../pages/Agents";
import Tasks from "../pages/Tasks";
import TaskDetail from "../pages/TaskDetail";
import Investigations from "../pages/Investigations";
import Metrics from "../pages/Metrics";

export default function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Investigations />} />
        {import.meta.env.VITE_DEMO_MODE !== "true" ? <>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/tasks/:id" element={<TaskDetail />} />
          <Route path="/metrics" element={<Metrics />} />
        </> : null}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}
