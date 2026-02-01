import type { ApiError } from "../types";

const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const apiBase = `${baseUrl}/api`;

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown };

export class ApiRequestError extends Error {
  status: number;
  payload?: ApiError;

  constructor(message: string, status: number, payload?: ApiError) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : undefined;

  if (!response.ok) {
    const message = payload?.error?.message || `Request failed with ${response.status}`;
    throw new ApiRequestError(message, response.status, payload);
  }

  return payload as T;
}

export function get<T>(path: string) {
  return request<T>(path);
}

export function post<T>(path: string, body?: unknown) {
  return request<T>(path, { method: "POST", body });
}

export function patch<T>(path: string, body?: unknown) {
  return request<T>(path, { method: "PATCH", body });
}

export function destroy<T>(path: string) {
  return request<T>(path, { method: "DELETE" });
}
