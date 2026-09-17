import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import type { GitChangeStatus } from "#/api/open-hands.types";
import FileIcon from "#/icons/file.svg?react";
import FolderIcon from "#/icons/folder.svg?react";
import { FileTreeNode } from "#/utils/file-tree";
import { getGitStatusBadge } from "#/utils/git-status-badge";
import { cn } from "#/utils/utils";

interface TreeNodeProps {
  node: FileTreeNode;
  depth: number;
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  statusByPath?: ReadonlyMap<string, GitChangeStatus>;
}

export function TreeNode({
  node,
  depth,
  selectedPath,
  onSelectFile,
  statusByPath,
}: TreeNodeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const indentPx = 8 + depth * 12;

  if (node.isDirectory) {
    return (
      <li>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          data-testid={`file-tree-dir-${node.path}`}
          className={cn(
            "flex w-full items-center gap-1.5 py-1 pr-2 text-left text-sm text-white",
            "hover:bg-tertiary cursor-pointer",
          )}
          // per-row indentation computed from tree depth at runtime
          style={{ paddingLeft: `${indentPx}px` }}
        >
          <span
            aria-hidden
            className="inline-flex w-3.5 shrink-0 items-center justify-center text-[var(--oh-muted)]"
          >
            {isOpen ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </span>
          <FolderIcon className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{node.name}</span>
        </button>
        {isOpen && node.children.length > 0 && (
          <ul>
            {node.children.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelectFile={onSelectFile}
                statusByPath={statusByPath}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  const isSelected = selectedPath === node.path;
  const status = statusByPath?.get(node.path);
  const badge = status ? getGitStatusBadge(status) : null;

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelectFile(node.path)}
        data-testid={`file-tree-file-${node.path}`}
        className={cn(
          "flex w-full items-center gap-1.5 py-1 pr-2 text-left text-sm",
          "hover:bg-tertiary cursor-pointer",
          isSelected
            ? "bg-[var(--oh-interactive-hover)] text-white"
            : "text-[var(--oh-text-tertiary)]",
        )}
        // per-row indentation computed from tree depth at runtime
        style={{ paddingLeft: `${indentPx + 16}px` }}
      >
        <FileIcon className="w-3.5 h-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
        {badge ? (
          <span
            aria-hidden
            data-testid={`file-tree-git-status-${node.path}`}
            data-git-status={status}
            className={cn(
              "ml-auto shrink-0 pl-1 text-[11px] font-medium leading-none",
              badge.className,
            )}
          >
            {badge.letter}
          </span>
        ) : null}
      </button>
    </li>
  );
}
