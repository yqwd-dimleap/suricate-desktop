import React from "react";
import { Editor, Monaco } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import { useTranslation } from "react-i18next";
import { I18nKey } from "#/i18n/declaration";
import { getLanguageFromPath } from "#/utils/get-language-from-path";
import { useSaveWorkspaceTextFile } from "#/hooks/mutation/use-save-workspace-text-file";
import { useOptionalConversationId } from "#/hooks/use-conversation-id";
import { useUnifiedGetGitChanges } from "#/hooks/query/use-unified-get-git-changes";
import { useUnifiedGitDiff } from "#/hooks/query/use-unified-git-diff";
import { HunkReviewOverlay } from "./hunk-review-overlay";
import { displayErrorToast } from "#/utils/custom-toast-handlers";
import type { PendingFileReveal } from "#/stores/files-tab-store";
import {
  hasDocumentConflict,
  isDocumentDirty,
  useWorkspaceDocumentStore,
} from "#/stores/workspace-document-store";
import {
  computeGitLineGutters,
  gitGutterClassName,
} from "#/utils/git-line-gutter";
import {
  groupBlameAnnotations,
  type BlameAnnotationBlock,
} from "#/utils/git-blame-annotations";
import { useGitBlame } from "#/hooks/query/use-git-blame";
import { useFilesTabStore } from "#/stores/files-tab-store";
import { GitBlameGutter } from "./git-blame-gutter";
import type { GitChangeStatus } from "#/api/open-hands.types";

interface EditableSourceViewProps {
  path: string;
  text: string;
  reveal?: PendingFileReveal | null;
}

const EDITOR_OPTIONS: MonacoEditor.IStandaloneEditorConstructionOptions = {
  readOnly: false,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  automaticLayout: true,
  wordWrap: "on",
  renderValidationDecorations: "off",
  lineDecorationsWidth: 5,
  scrollbar: { alwaysConsumeMouseWheel: false },
};

interface GitGutterEffectProps {
  path: string;
  draft: string;
  editorRef: React.RefObject<MonacoEditor.IStandaloneCodeEditor | null>;
  monacoRef: React.RefObject<Monaco | null>;
}

/**
 * Mounted only when a conversation id is present so
 * `useUnifiedGetGitChanges` / `useUnifiedGitDiff` can call
 * `useConversationId` safely.
 */
function GitGutterEffect({
  path,
  draft,
  editorRef,
  monacoRef,
}: GitGutterEffectProps) {
  const decorationIdsRef = React.useRef<string[]>([]);
  const { data: gitChanges } = useUnifiedGetGitChanges();
  const gitStatus: GitChangeStatus | null = React.useMemo(
    () => gitChanges?.find((change) => change.path === path)?.status ?? null,
    [gitChanges, path],
  );

  const { data: gitDiff } = useUnifiedGitDiff({
    filePath: path,
    type: gitStatus ?? "M",
    enabled: !!gitStatus && gitStatus !== "D",
  });

  React.useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) {
      return undefined;
    }

    const clearDecorations = () => {
      decorationIdsRef.current = editor.deltaDecorations(
        decorationIdsRef.current,
        [],
      );
    };

    if (!gitStatus || gitStatus === "D" || !gitDiff) {
      clearDecorations();
      return clearDecorations;
    }

    // Compare HEAD/base original against the buffer the user sees (draft),
    // so unsaved edits still pick up gutter marks against the git base.
    const gutters = computeGitLineGutters(gitDiff.original ?? "", draft);
    decorationIdsRef.current = editor.deltaDecorations(
      decorationIdsRef.current,
      gutters.map((gutter) => ({
        range: new monaco.Range(gutter.lineNumber, 1, gutter.lineNumber, 1),
        options: {
          isWholeLine: false,
          linesDecorationsClassName: gitGutterClassName(gutter.kind),
        },
      })),
    );

    return clearDecorations;
  }, [draft, editorRef, gitDiff, gitStatus, monacoRef, path]);

  return null;
}

const GIT_BLAME_ANNOTATE_ENABLED_KEY = "filesGitBlameAnnotateEnabled";
const GIT_BLAME_ANNOTATE_SUPPORTED_KEY = "filesGitBlameAnnotateSupported";

/**
 * Cursor-style editor context menu: right-click → Annotate with Git Blame /
 * Close Annotations. Hidden when `/api/git/blame` is unsupported.
 */
function BlameAnnotateContextMenuEffect({
  editorRef,
}: {
  editorRef: React.RefObject<MonacoEditor.IStandaloneCodeEditor | null>;
}) {
  const { t } = useTranslation("openhands");
  const isAnnotateEnabled = useFilesTabStore((s) => s.isAnnotateEnabled);
  const isAnnotateUnsupported = useFilesTabStore(
    (s) => s.isAnnotateUnsupported,
  );
  const setAnnotateEnabled = useFilesTabStore((s) => s.setAnnotateEnabled);
  const enabledKeyRef = React.useRef<{ set: (value: boolean) => void } | null>(
    null,
  );
  const supportedKeyRef = React.useRef<{
    set: (value: boolean) => void;
  } | null>(null);

  React.useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return undefined;
    }

    const enabledKey = editor.createContextKey(
      GIT_BLAME_ANNOTATE_ENABLED_KEY,
      isAnnotateEnabled,
    );
    const supportedKey = editor.createContextKey(
      GIT_BLAME_ANNOTATE_SUPPORTED_KEY,
      !isAnnotateUnsupported,
    );
    enabledKeyRef.current = enabledKey;
    supportedKeyRef.current = supportedKey;

    const openAction = editor.addAction({
      id: "files.annotateWithGitBlame",
      label: t(I18nKey.FILES$ANNOTATE_WITH_GIT_BLAME),
      precondition: `${GIT_BLAME_ANNOTATE_SUPPORTED_KEY} && !${GIT_BLAME_ANNOTATE_ENABLED_KEY}`,
      contextMenuGroupId: "9_gitBlame",
      contextMenuOrder: 1,
      run: () => {
        setAnnotateEnabled(true);
      },
    });
    const closeAction = editor.addAction({
      id: "files.closeAnnotations",
      label: t(I18nKey.FILES$CLOSE_ANNOTATIONS),
      precondition: `${GIT_BLAME_ANNOTATE_SUPPORTED_KEY} && ${GIT_BLAME_ANNOTATE_ENABLED_KEY}`,
      contextMenuGroupId: "9_gitBlame",
      contextMenuOrder: 1,
      run: () => {
        setAnnotateEnabled(false);
      },
    });

    return () => {
      openAction.dispose();
      closeAction.dispose();
      enabledKeyRef.current = null;
      supportedKeyRef.current = null;
    };
    // Register once per editor instance; labels/state sync via context keys.
  }, [editorRef, setAnnotateEnabled, t]);

  React.useEffect(() => {
    enabledKeyRef.current?.set(isAnnotateEnabled);
  }, [isAnnotateEnabled]);

  React.useEffect(() => {
    supportedKeyRef.current?.set(!isAnnotateUnsupported);
  }, [isAnnotateUnsupported]);

  return null;
}

/**
 * Loads blame for the open file and renders a left-of-linenumbers annotate
 * column (Cursor-style). Closing annotate unmounts the column so the editor
 * returns to its normal layout.
 */
function BlameAnnotateGutter({
  path,
  editorRef,
}: {
  path: string;
  editorRef: React.RefObject<MonacoEditor.IStandaloneCodeEditor | null>;
}) {
  const { t } = useTranslation("openhands");
  const isAnnotateEnabled = useFilesTabStore((s) => s.isAnnotateEnabled);
  const setAnnotateUnsupported = useFilesTabStore(
    (s) => s.setAnnotateUnsupported,
  );
  const { lines, isUnsupported } = useGitBlame({
    filePath: path,
    enabled: isAnnotateEnabled,
  });

  React.useEffect(() => {
    if (isUnsupported) {
      setAnnotateUnsupported(true);
    }
  }, [isUnsupported, setAnnotateUnsupported]);

  const labels = React.useMemo(
    () => ({
      today: t(I18nKey.FILES$BLAME_TODAY),
      yesterday: t(I18nKey.FILES$BLAME_YESTERDAY),
    }),
    [t],
  );

  const blocks: BlameAnnotationBlock[] = React.useMemo(() => {
    if (!isAnnotateEnabled || !lines || lines.length === 0) {
      return [];
    }
    return groupBlameAnnotations(lines);
  }, [isAnnotateEnabled, lines]);

  if (!isAnnotateEnabled || blocks.length === 0) {
    return null;
  }

  return (
    <GitBlameGutter editorRef={editorRef} blocks={blocks} labels={labels} />
  );
}

/**
 * Editable Monaco view for workspace text files. Drafts live in
 * `useWorkspaceDocumentStore` so switching Files tabs / files does not
 * drop unsaved work, and agent disk updates become an explicit conflict
 * instead of silently overwriting the buffer.
 */
export function EditableSourceView({
  path,
  text,
  reveal,
}: EditableSourceViewProps) {
  const { t } = useTranslation("openhands");
  const { conversationId } = useOptionalConversationId();
  const saveMutation = useSaveWorkspaceTextFile();
  const editorRef = React.useRef<MonacoEditor.IStandaloneCodeEditor | null>(
    null,
  );
  const monacoRef = React.useRef<Monaco | null>(null);
  const saveRef = React.useRef<() => void>(() => undefined);
  const [localDraft, setLocalDraft] = React.useState(text);
  const [editorReady, setEditorReady] = React.useState(false);

  const document = useWorkspaceDocumentStore((state) =>
    conversationId ? state.byConversation[conversationId]?.[path] : undefined,
  );

  // Layout effect so the store row exists before the first keystroke —
  // `setDraft` no-ops when the path is missing, and a paint-time race
  // would drop early edits.
  React.useLayoutEffect(() => {
    if (!conversationId) {
      setLocalDraft(text);
      return;
    }
    useWorkspaceDocumentStore
      .getState()
      .applyRemote(conversationId, path, text);
  }, [conversationId, path, text]);

  const draft = conversationId ? (document?.draft ?? text) : localDraft;
  const dirty = conversationId
    ? isDocumentDirty(document)
    : localDraft !== text;
  const conflict = hasDocumentConflict(document);

  const handleSave = React.useCallback(() => {
    if (!conversationId || saveMutation.isPending) {
      return;
    }
    const current = useWorkspaceDocumentStore
      .getState()
      .getDocument(conversationId, path);
    if (!current || current.draft === current.baseline) {
      return;
    }
    if (current.incoming !== null) {
      displayErrorToast(t(I18nKey.FILES$RESOLVE_CONFLICT_FIRST));
      return;
    }
    saveMutation.mutate(
      { relativePath: path, content: current.draft },
      {
        onError: (error) => {
          displayErrorToast(
            error instanceof Error
              ? error.message
              : t(I18nKey.FILES$SAVE_ERROR),
          );
        },
      },
    );
  }, [conversationId, path, saveMutation, t]);

  saveRef.current = handleSave;

  const handleChange = React.useCallback(
    (value: string | undefined) => {
      const next = value ?? "";
      if (!conversationId) {
        setLocalDraft(next);
        return;
      }
      useWorkspaceDocumentStore.getState().setDraft(conversationId, path, next);
    },
    [conversationId, path],
  );

  React.useEffect(() => {
    const editor = editorRef.current;
    if (!editor || reveal?.path !== path) {
      return undefined;
    }
    const line = Math.max(1, reveal.startLine);
    editor.revealLineInCenter(line);
    editor.setPosition({ lineNumber: line, column: 1 });
    return undefined;
  }, [path, reveal]);

  const handleKeepMine = React.useCallback(() => {
    if (!conversationId) {
      return;
    }
    useWorkspaceDocumentStore.getState().keepMine(conversationId, path);
  }, [conversationId, path]);

  const handleUseIncoming = React.useCallback(() => {
    if (!conversationId) {
      return;
    }
    useWorkspaceDocumentStore.getState().useIncoming(conversationId, path);
  }, [conversationId, path]);

  return (
    <div
      className="flex h-full w-full flex-col"
      data-testid="editable-source-view"
    >
      {conflict && (
        <div
          className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--oh-border)] px-3 py-1.5"
          data-testid="editable-source-conflict"
        >
          <span className="text-xs text-[var(--oh-muted)]">
            {t(I18nKey.FILES$CONFLICT_BANNER)}
          </span>
          <button
            type="button"
            data-testid="editable-source-keep-mine"
            className="rounded px-2 py-0.5 text-xs text-[var(--oh-text-secondary)] hover:bg-[var(--oh-interactive-hover)] hover:text-[var(--oh-foreground)]"
            onClick={handleKeepMine}
          >
            {t(I18nKey.FILES$KEEP_MINE)}
          </button>
          <button
            type="button"
            data-testid="editable-source-use-incoming"
            className="rounded px-2 py-0.5 text-xs text-[var(--oh-text-secondary)] hover:bg-[var(--oh-interactive-hover)] hover:text-[var(--oh-foreground)]"
            onClick={handleUseIncoming}
          >
            {t(I18nKey.FILES$USE_AGENT)}
          </button>
        </div>
      )}
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--oh-border)] px-3 py-1.5">
        {dirty && (
          <span
            className="text-xs text-[var(--oh-muted)]"
            data-testid="editable-source-unsaved"
          >
            {t(I18nKey.FILES$UNSAVED)}
          </span>
        )}
        <button
          type="button"
          data-testid="editable-source-save"
          className="ml-auto rounded px-2 py-0.5 text-xs text-[var(--oh-text-secondary)] hover:bg-[var(--oh-interactive-hover)] hover:text-[var(--oh-foreground)] disabled:opacity-50"
          disabled={!dirty || conflict || saveMutation.isPending}
          onClick={handleSave}
        >
          {saveMutation.isPending
            ? t(I18nKey.FILES$SAVING)
            : t(I18nKey.FILES$SAVE)}
        </button>
      </div>
      <HunkReviewOverlay path={path} dirty={dirty || conflict} />
      {conversationId && editorReady ? (
        <GitGutterEffect
          path={path}
          draft={draft}
          editorRef={editorRef}
          monacoRef={monacoRef}
        />
      ) : null}
      {conversationId && editorReady ? (
        <BlameAnnotateContextMenuEffect editorRef={editorRef} />
      ) : null}
      <div className="flex min-h-0 flex-1">
        {conversationId && editorReady ? (
          <BlameAnnotateGutter path={path} editorRef={editorRef} />
        ) : null}
        <div className="min-h-0 min-w-0 flex-1">
          <Editor
            path={path}
            language={getLanguageFromPath(path)}
            theme="vs-dark"
            value={draft}
            options={EDITOR_OPTIONS}
            onMount={(editor, monaco: Monaco) => {
              editorRef.current = editor;
              monacoRef.current = monaco;
              setEditorReady(true);
              editor.addCommand(
                monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
                () => {
                  saveRef.current();
                },
              );
            }}
            onChange={handleChange}
          />
        </div>
      </div>
    </div>
  );
}
