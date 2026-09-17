import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useWorkspaceFileContent } from "#/hooks/query/use-workspace-file-content";
import { useWorkspaceMutationCounter } from "#/stores/use-workspace-mutation-counter";

const useWorkspaceSessionMock = vi.fn();
vi.mock("#/hooks/query/use-workspace-session", async (importOriginal) => {
  const real =
    await importOriginal<
      typeof import("#/hooks/query/use-workspace-session")
    >();
  return {
    ...real,
    // Keep the real joinWorkspaceUrl so we assert against URLs assembled
    // by the hook the same way the production code assembles them.
    useWorkspaceSession: () => useWorkspaceSessionMock(),
  };
});

const useActiveConversationMock = vi.fn();
vi.mock("#/hooks/query/use-active-conversation", () => ({
  useActiveConversation: () => useActiveConversationMock(),
}));

const useRuntimeIsReadyMock = vi.fn();
vi.mock("#/hooks/use-runtime-is-ready", () => ({
  useRuntimeIsReady: () => useRuntimeIsReadyMock(),
}));

const getActiveBackendMock = vi.fn();
vi.mock("#/api/backend-registry/active-store", () => ({
  getActiveBackend: () => getActiveBackendMock(),
}));

const downloadFileMock = vi.fn();
vi.mock("#/api/runtime-service/agent-server-runtime-service", () => ({
  default: {
    downloadFile: (...args: unknown[]) => downloadFileMock(...args),
  },
}));

const readCloudConversationFileMock = vi.fn();
vi.mock("#/api/cloud/conversation-service.api", () => ({
  readCloudConversationFile: (...args: unknown[]) =>
    readCloudConversationFileMock(...args),
}));

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = function WorkspaceFileContentTestWrapper({
    children,
  }: {
    children: React.ReactNode;
  }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
  return Wrapper;
}

const BASE_URL =
  "https://agent.example.com/api/conversations/conv-1/workspace/";

describe("useWorkspaceFileContent", () => {
  beforeEach(() => {
    useWorkspaceSessionMock.mockReset();
    useActiveConversationMock.mockReset();
    useRuntimeIsReadyMock.mockReset();
    getActiveBackendMock.mockReset();
    downloadFileMock.mockReset();
    readCloudConversationFileMock.mockReset();
    useRuntimeIsReadyMock.mockReturnValue(true);
    useActiveConversationMock.mockReturnValue({
      data: {
        id: "conv-1",
        conversation_url: "https://agent.example.com/api/conversations/conv-1",
        session_api_key: "session-key",
        workspace: { working_dir: "/workspace/project" },
      },
    });
    useWorkspaceSessionMock.mockReturnValue({
      data: { baseUrl: BASE_URL },
      isLoading: false,
      isError: false,
      error: null,
    });
    getActiveBackendMock.mockReturnValue({
      backend: { id: "local-1", kind: "local", host: "http://localhost:8000" },
      orgId: null,
    });
    useWorkspaceMutationCounter.setState({ count: 0 });
  });

  function arrayBufferFromString(value: string): ArrayBuffer {
    return new TextEncoder().encode(value).buffer as ArrayBuffer;
  }

  it("downloads text via FileClient header auth and keeps the fileserver staticUrl", async () => {
    downloadFileMock.mockResolvedValue(arrayBufferFromString("# Hello"));

    const { result } = renderHook(
      () => useWorkspaceFileContent("docs/readme.md"),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(downloadFileMock).toHaveBeenCalledWith(
      "https://agent.example.com/api/conversations/conv-1",
      "session-key",
      "/workspace/project/docs/readme.md",
    );
    expect(result.current.data).toEqual({
      path: "docs/readme.md",
      kind: "text",
      text: "# Hello",
      staticUrl: `${BASE_URL}docs/readme.md`,
      mimeType: "text/markdown",
    });
  });

  it("still loads text when the workspace session cookie is unavailable", async () => {
    useWorkspaceSessionMock.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: new Error("cookie mint failed"),
    });
    downloadFileMock.mockResolvedValue(arrayBufferFromString("plain"));

    const { result } = renderHook(
      () => useWorkspaceFileContent("docs/readme.md"),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      path: "docs/readme.md",
      kind: "text",
      text: "plain",
      staticUrl: `data:text/markdown;charset=utf-8;base64,${btoa("plain")}`,
      mimeType: "text/markdown",
    });
  });

  it("does not download image bytes when a workspace session URL exists", async () => {
    const { result } = renderHook(
      () => useWorkspaceFileContent("assets/logo.png"),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(downloadFileMock).not.toHaveBeenCalled();
    expect(result.current.data).toEqual({
      path: "assets/logo.png",
      kind: "image",
      text: null,
      staticUrl: `${BASE_URL}assets/logo.png`,
      mimeType: "image/png",
    });
  });

  it("does not download PDF bytes when a workspace session URL exists", async () => {
    const { result } = renderHook(() => useWorkspaceFileContent("report.pdf"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(downloadFileMock).not.toHaveBeenCalled();
    expect(result.current.data).toEqual({
      path: "report.pdf",
      kind: "pdf",
      text: null,
      staticUrl: `${BASE_URL}report.pdf`,
      mimeType: "application/pdf",
    });
  });

  it("falls back to a data URI for images when the workspace session is missing", async () => {
    useWorkspaceSessionMock.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      error: null,
    });
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer;
    downloadFileMock.mockResolvedValue(png);

    const { result } = renderHook(
      () => useWorkspaceFileContent("assets/logo.png"),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(downloadFileMock).toHaveBeenCalled();
    expect(result.current.data?.kind).toBe("image");
    expect(result.current.data?.staticUrl.startsWith("data:image/png;base64,")).toBe(
      true,
    );
  });

  it("flips text → binary when the downloaded bytes contain a NUL", async () => {
    const binary = new Uint8Array([0x01, 0x00, 0x02]).buffer;
    downloadFileMock.mockResolvedValue(binary);

    const { result } = renderHook(
      () => useWorkspaceFileContent("data/blob.bin"),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toMatchObject({
      kind: "binary",
      text: null,
      mimeType: "application/octet-stream",
      staticUrl: `${BASE_URL}data/blob.bin`,
    });
  });

  it("refetches text content after a workspace mutation tick", async () => {
    downloadFileMock
      .mockResolvedValueOnce(arrayBufferFromString("first"))
      .mockResolvedValueOnce(arrayBufferFromString("second"));

    const { result } = renderHook(
      () => useWorkspaceFileContent("docs/readme.md"),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.data?.text).toBe("first"));

    act(() => {
      useWorkspaceMutationCounter.getState().bump();
    });

    await waitFor(() => expect(result.current.data?.text).toBe("second"));
    expect(downloadFileMock).toHaveBeenCalledTimes(2);
  });

  it("does not start a file request before a path is selected", async () => {
    renderHook(() => useWorkspaceFileContent(null), { wrapper: makeWrapper() });

    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });

    expect(downloadFileMock).not.toHaveBeenCalled();
  });

  it("surfaces a download failure as an error", async () => {
    downloadFileMock.mockRejectedValue(new Error("Failed to read missing.txt: 404"));

    const { result } = renderHook(
      () => useWorkspaceFileContent("missing.txt"),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(
      expect.objectContaining({
        message: "Failed to read missing.txt: 404",
      }),
    );
  });

  it("ignores blank conversation session_api_key so the backend key is used", async () => {
    useActiveConversationMock.mockReturnValue({
      data: {
        id: "conv-1",
        conversation_url: "https://agent.example.com/api/conversations/conv-1",
        session_api_key: "   ",
        workspace: { working_dir: "/workspace/project" },
      },
    });
    downloadFileMock.mockResolvedValue(arrayBufferFromString("ok"));

    const { result } = renderHook(
      () => useWorkspaceFileContent("docs/readme.md"),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(downloadFileMock).toHaveBeenCalledWith(
      "https://agent.example.com/api/conversations/conv-1",
      null,
      "/workspace/project/docs/readme.md",
    );
  });

  describe("cloud backend", () => {
    beforeEach(() => {
      getActiveBackendMock.mockReturnValue({
        backend: {
          id: "cloud-1",
          kind: "cloud",
          host: "https://app.all-hands.dev",
        },
        orgId: "org-1",
      });
      // useWorkspaceSession self-disables on cloud — its data is null.
      useWorkspaceSessionMock.mockReturnValue({
        data: null,
        isLoading: false,
        isError: false,
        error: null,
      });
    });

    it("fetches text via the cloud file endpoint and exposes a data: URI staticUrl", async () => {
      readCloudConversationFileMock.mockResolvedValue("# Hello");

      const { result } = renderHook(
        () => useWorkspaceFileContent("docs/readme.md"),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Cloud uses the first-class cloud API endpoint, never the removed
      // cloud-proxy / downloadFile path, and passes an ABSOLUTE path (the
      // runtime's /api/file/download rejects relative paths).
      expect(readCloudConversationFileMock).toHaveBeenCalledWith(
        "conv-1",
        "/workspace/project/docs/readme.md",
      );
      expect(downloadFileMock).not.toHaveBeenCalled();
      expect(result.current.data).toEqual({
        path: "docs/readme.md",
        kind: "text",
        text: "# Hello",
        staticUrl: `data:text/markdown;charset=utf-8;base64,${btoa("# Hello")}`,
        mimeType: "text/markdown",
      });
    });

    it("anchors the file path to the conversation's working dir", async () => {
      useActiveConversationMock.mockReturnValue({
        data: {
          id: "conv-1",
          conversation_url:
            "https://agent.example.com/api/conversations/conv-1",
          session_api_key: "session-key",
          workspace: { working_dir: "/workspace/project/my-repo" },
        },
      });
      readCloudConversationFileMock.mockResolvedValue("hi");

      const { result } = renderHook(
        () => useWorkspaceFileContent("src/index.ts"),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(readCloudConversationFileMock).toHaveBeenCalledWith(
        "conv-1",
        "/workspace/project/my-repo/src/index.ts",
      );
    });

    it("renders images via base64 data URI from the cloud file endpoint", async () => {
      // The cloud endpoint returns text; use an SVG (text-based image) since
      // binary bytes can't round-trip faithfully through the string API.
      const svg = "<svg></svg>";
      readCloudConversationFileMock.mockResolvedValue(svg);

      const { result } = renderHook(
        () => useWorkspaceFileContent("assets/logo.svg"),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(downloadFileMock).not.toHaveBeenCalled();
      expect(result.current.data).toEqual({
        path: "assets/logo.svg",
        kind: "image",
        text: null,
        staticUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
        mimeType: "image/svg+xml",
      });
    });
  });
});
