import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { GitChangeStatus } from "#/api/open-hands.types";
import { I18nKey } from "#/i18n/declaration";
import { buildFileTree } from "#/utils/file-tree";
import { TreeNode } from "./tree-node";

interface FileTreeViewProps {
  paths: string[];
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  /** Optional git status map keyed by the same paths shown in the tree. */
  statusByPath?: ReadonlyMap<string, GitChangeStatus>;
}

export function FileTreeView({
  paths,
  selectedPath,
  onSelectFile,
  statusByPath,
}: FileTreeViewProps) {
  const { t } = useTranslation("openhands");
  const root = useMemo(() => buildFileTree(paths), [paths]);

  if (root.children.length === 0) {
    return (
      <div className="px-3 py-4 text-sm text-[var(--oh-muted)]">
        {t(I18nKey.FILES$NO_FILES)}
      </div>
    );
  }

  return (
    <ul className="py-1 custom-scrollbar-always" data-testid="file-tree-view">
      {root.children.map((child) => (
        <TreeNode
          key={child.path}
          node={child}
          depth={0}
          selectedPath={selectedPath}
          onSelectFile={onSelectFile}
          statusByPath={statusByPath}
        />
      ))}
    </ul>
  );
}
