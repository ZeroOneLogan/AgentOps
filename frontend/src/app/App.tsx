import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./AppLayout";
import Dashboard from "../pages/Dashboard";
import Agents from "../pages/Agents";
import Tasks from "../pages/Tasks";
import TaskDetail from "../pages/TaskDetail";
import Metrics from "../pages/Metrics";

export default function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/tasks/:id" element={<TaskDetail />} />
        <Route path="/metrics" element={<Metrics />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}
