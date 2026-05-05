import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

/**
 * Builds a folder tree from patterns:
 * All Patterns
 *   └─ Discipline (e.g., Reining)
 *       └─ Division (e.g., Senior)
 *           └─ Level (e.g., L1)
 */
function buildFolderTree(patterns) {
  const tree = { id: 'all', label: 'All Patterns', count: patterns.length, children: {} };

  for (const pattern of patterns) {
    const discipline = pattern.discipline || 'Uncategorized';
    const division = pattern.division || 'General';
    const level = pattern.level || '';

    if (!tree.children[discipline]) {
      tree.children[discipline] = { id: `d-${discipline}`, label: discipline, count: 0, children: {} };
    }
    tree.children[discipline].count++;

    if (!tree.children[discipline].children[division]) {
      tree.children[discipline].children[division] = { id: `d-${discipline}-${division}`, label: division, count: 0, children: {} };
    }
    tree.children[discipline].children[division].count++;

    if (level) {
      const levelKey = `${division}-${level}`;
      if (!tree.children[discipline].children[division].children[levelKey]) {
        tree.children[discipline].children[division].children[levelKey] = { id: `d-${discipline}-${division}-${level}`, label: level, count: 0, children: {} };
      }
      tree.children[discipline].children[division].children[levelKey].count++;
    }
  }

  return tree;
}

const TreeNode = ({ node, depth = 0, selectedId, onSelect }) => {
  const [isExpanded, setIsExpanded] = useState(depth === 0);
  const hasChildren = Object.keys(node.children).length > 0;
  const isSelected = selectedId === node.id;

  return (
    <div>
      <button
        onClick={() => {
          onSelect(node.id, node.label);
          if (hasChildren) setIsExpanded(!isExpanded);
        }}
        className={cn(
          'w-full flex items-center gap-1.5 py-1.5 px-2 rounded-md text-sm hover:bg-muted/80 transition-colors text-left',
          isSelected && 'bg-primary/10 text-primary font-medium',
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          isExpanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        {hasChildren ? (
          isExpanded ? <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-500" /> : <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        ) : null}
        <span className="truncate flex-1">{node.label}</span>
        <Badge variant="secondary" className="h-5 px-1.5 text-[10px] shrink-0">
          {node.count}
        </Badge>
      </button>
      {isExpanded && hasChildren && (
        <div>
          {Object.values(node.children)
            .sort((a, b) => a.label.localeCompare(b.label))
            .map(child => (
              <TreeNode
                key={child.id}
                node={child}
                depth={depth + 1}
                selectedId={selectedId}
                onSelect={onSelect}
              />
            ))}
        </div>
      )}
    </div>
  );
};

export default function PatternFolderTree({ patterns, selectedFolder, onSelectFolder }) {
  const tree = useMemo(() => buildFolderTree(patterns), [patterns]);

  return (
    <ScrollArea className="h-full">
      <div className="p-2">
        <p className="text-xs font-semibold text-muted-foreground px-2 mb-2 uppercase tracking-wider">Folders</p>
        <TreeNode
          node={tree}
          depth={0}
          selectedId={selectedFolder}
          onSelect={onSelectFolder}
        />
      </div>
    </ScrollArea>
  );
}

export { buildFolderTree };
