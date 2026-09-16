import React from "react";
import { Editor } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import { useTranslation } from "react-i18next";
import { I18nKey } from "#/i18n/declaration";
import { getLanguageFromPath } from "#/utils/get-language-from-path";
import { useSaveWorkspaceTextFile } from "#/hooks/mutation/use-save-workspace-text-file";
import { HunkReviewOverlay } from "./hunk-review-overlay";
import { displayErrorToast } from "#/utils/custom-toast-handlers";
import type { PendingFileReveal } from "#/stores/files-tab-store";

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
  scrollbar: { alwaysConsumeMouseWheel: false },
};

/**
 * Editable Monaco view for workspace text files. Tracks dirty state and
 * saves via RemoteWorkspace upload (Cmd/Ctrl+S or Save button).
 */
export function EditableSourceView({
  path,
  text,
  reveal,
}: EditableSourceViewProps) {
  const { t } = useTranslation("openhands");
  const saveMutation = useSaveWorkspaceTextFile();
  const [draft, setDraft] = React.useState(text);
  const [dirty, setDirty] = React.useState(false);
  const editorRef = React.useRef<MonacoEditor.IStandaloneCodeEditor | null>(
    null,
  );

  React.useEffect(() => {
    setDraft(text);
    setDirty(false);
  }, [path, text]);

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

  const handleSave = React.useCallback(() => {
    if (!dirty || saveMutation.isPending) {
      return;
    }
    saveMutation.mutate(
      { relativePath: path, content: draft },
      {
        onSuccess: () => {
          setDirty(false);
        },
        onError: (error) => {
          displayErrorToast(
            error instanceof Error
              ? error.message
              : t(I18nKey.FILES$SAVE_ERROR),
          );
        },
      },
    );
  }, [dirty, draft, path, saveMutation, t]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave]);

  return (
    <div
      className="flex h-full w-full flex-col"
      data-testid="editable-source-view"
    >
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
          disabled={!dirty || saveMutation.isPending}
          onClick={handleSave}
        >
          {saveMutation.isPending
            ? t(I18nKey.FILES$SAVING)
            : t(I18nKey.FILES$SAVE)}
        </button>
      </div>
      <HunkReviewOverlay path={path} dirty={dirty} />
      <div className="min-h-0 flex-1">
        <Editor
          path={path}
          language={getLanguageFromPath(path)}
          theme="vs-dark"
          value={draft}
          options={EDITOR_OPTIONS}
          onMount={(editor) => {
            editorRef.current = editor;
          }}
          onChange={(value) => {
            const next = value ?? "";
            setDraft(next);
            setDirty(next !== text);
          }}
        />
      </div>
    </div>
  );
}
