import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef
} from "react";

export type Block = {
  id: string;
  type: 'card' | 'group';
  metainfo: {
    title?: string;
    content?: string;
    color?: string;
    collapsed?: boolean;
  };
  children?: Block[];
};

export type FlatItem = {
  block: Block;
  depth: number;
  numbering: string;
  parentGroupIds: string[];
};

const findBlock = (blocks: Block[], id: string): Block | null => {
  for (let b of blocks) {
    if (b.id === id) return b;
    if (b.children) { const found = findBlock(b.children, id); if (found) return found; }
  }
  return null;
};

const isDescendant = (block: Block, targetId: string): boolean => {
  if (block.id === targetId) return true;
  if (block.children) return block.children.some(c => isDescendant(c, targetId));
  return false;
};

const toggleCollapseImm = (blocks: Block[], id: string): Block[] => {
  let changed = false;
  const res = blocks.map(b => {
    if (b.id === id) { changed = true; return { ...b, metainfo: { ...b.metainfo, collapsed: !b.metainfo.collapsed } }; }
    if (b.children) {
      const newC = toggleCollapseImm(b.children, id);
      if (newC !== b.children) { changed = true; return { ...b, children: newC }; }
    }
    return b;
  });
  return changed ? res : blocks;
};

const removeMultipleBlocksImm = (blocks: Block[], idsToDelete: Set<string>): Block[] => {
  let changed = false;
  const res: Block[] = [];
  for (const b of blocks) {
    if (idsToDelete.has(b.id)) {
      changed = true;
    } else {
      if (b.children) {
        const newChildren = removeMultipleBlocksImm(b.children, idsToDelete);
        if (newChildren !== b.children) {
          changed = true;
          res.push({ ...b, children: newChildren });
        } else {
          res.push(b);
        }
      } else {
        res.push(b);
      }
    }
  }
  return changed ? res : blocks;
};

const removeBlockImm = (blocks: Block[], id: string, removedArr: Block[]): Block[] => {
  let changed = false;
  const res: Block[] = [];
  for (const b of blocks) {
    if (b.id === id) {
      removedArr.push(b);
      changed = true;
    } else {
      if (b.children) {
        const newChildren = removeBlockImm(b.children, id, removedArr);
        if (newChildren !== b.children) {
          changed = true;
          res.push({ ...b, children: newChildren });
        } else {
          res.push(b);
        }
      } else {
        res.push(b);
      }
    }
  }
  return changed ? res : blocks;
};

const insertBlocksImm = (
  blocks: Block[], 
  targetId: string, 
  blocksToInsert: Block[], 
  position: 'top'|'bottom'|'inside'|'inside-prepend'
): Block[] => {
  let changed = false;
  const res: Block[] = [];
  for (const b of blocks) {
    if (b.id === targetId) {
      changed = true;
      if (position === 'top') { res.push(...blocksToInsert, b); }
      else if (position === 'bottom') { res.push(b, ...blocksToInsert); }
      else if (position === 'inside-prepend') { res.push({ ...b, children: [...blocksToInsert, ...(b.children || [])] }); }
      else { res.push({ ...b, children: [...(b.children || []), ...blocksToInsert] }); }
    } else {
      if (b.children) {
        const newC = insertBlocksImm(b.children, targetId, blocksToInsert, position);
        if (newC !== b.children) { changed = true; res.push({ ...b, children: newC }); continue; }
      }
      res.push(b);
    }
  }
  return changed ? res : blocks;
};

export const flattenBlocks = (blocks: Block[], depth = 0, prefix = '', parentGroupIds: string[] = []): FlatItem[] => {
  let result: FlatItem[] = [];
  blocks.forEach((b, i) => {
    const num = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
    result.push({ block: b, depth, numbering: num, parentGroupIds });
    if (b.type === 'group' && !b.metainfo.collapsed && b.children) {
      result.push(...flattenBlocks(b.children, depth + 1, num, [...parentGroupIds, b.id]));
    }
  });
  return result;
};

export const useTreeSelection = (setSelExport: (ids: string[]) => void) => {
  const selRef = useRef<Set<string>>(new Set());
  const cursorRef = useRef<string | null>(null);
  const lastSelectedId = useRef<string | null>(null);

  const syncSingleDOMNode = useCallback((row: HTMLDivElement, blockId: string) => {
    const isSel = selRef.current.has(blockId);
    const isCursor = cursorRef.current === blockId;
    row.setAttribute('data-selected', String(isSel));
    row.setAttribute('data-cursor', String(isCursor));
  }, []);

  const syncDOMSelection = useCallback(() => {
    const rows = document.querySelectorAll('.tree-block-flat'); 
    rows.forEach((row: any) => {
      const blockId = row.getAttribute('data-tree-id');
      if (blockId) syncSingleDOMNode(row, blockId);
    });
    const slices = document.querySelectorAll('.group-slice');
    slices.forEach((slice: any) => {
      const groupId = slice.getAttribute('data-slice-group-id');
      if (groupId) {
        const isSel = selRef.current.has(groupId);
        slice.setAttribute('data-group-selected', String(isSel));
      }
    });
  }, [syncSingleDOMNode]);

  return { selRef, cursorRef, lastSelectedId, syncSingleDOMNode, syncDOMSelection };
};

export const useTreeActions = ({
  blocksData, setBlocksData, flatTree, 
  selRef, cursorRef, lastSelectedId, syncDOMSelection, setSelExport,
  editingNodeId, setEditingNodeId, setAltPopup,
  searchQuery, syncSingleDOMNode, scrollContainerRef
}: any) => {
  const dropTargetRef = useRef<{ id: string, pos: 'top'|'bottom'|'inside' } | null>(null);

  return useMemo(() => ({
    checkIsSelected: (id: string) => selRef.current.has(id),
    syncSingleDOMNode,
    searchQuery,
    onDoubleClickNode: (clickedId: string) => { setEditingNodeId(clickedId); },
    onToggleGroup: (groupId: string) => { setBlocksData((prev: Block[]) => toggleCollapseImm(prev, groupId)); },
    handleChangeGroupColor: (_groupId: string, _color: string) => {},
    handleRenameGroup: (_groupId: string, _title: string) => {},
    onClick: (e: React.MouseEvent, clickedId: string) => {
      if (editingNodeId && editingNodeId !== clickedId) setEditingNodeId(null);
      cursorRef.current = clickedId;
      if (e.ctrlKey || e.metaKey) {
        if (selRef.current.has(clickedId)) selRef.current.delete(clickedId);
        else selRef.current.add(clickedId);
      } else if (e.shiftKey && lastSelectedId.current) {
        const start = flatTree.findIndex((f:any) => f.block.id === lastSelectedId.current);
        const end = flatTree.findIndex((f:any) => f.block.id === clickedId);
        if (start !== -1 && end !== -1) {
          const min = Math.min(start, end); const max = Math.max(start, end);
          flatTree.slice(min, max + 1).forEach((f:any) => selRef.current.add(f.block.id));
        }
      } else {
        selRef.current.clear();
        selRef.current.add(clickedId);
      }
      lastSelectedId.current = clickedId;
      syncDOMSelection();
      startTransition(() => setSelExport(Array.from(selRef.current)));
    },
    onAltClick: (e: React.MouseEvent, itemId: string, itemType: string) => {
      const targetNodes: string[] = [];
      const targetGroups: string[] = [];
      if (itemType === 'group' || itemType === 'root') {
        if (itemType==='root') {
          const block = { id: 'root', children: blocksData, metainfo: {title: 'entire graph', color: 'white', collapsed: false}, type: "group" } as any;
          const collect = (b: Block) => { if (b.type === 'card') { targetNodes.push(b.id); } else { targetGroups.push(b.id); if (b.children) { b.children.forEach(collect); } } }
          collect(block);
        } else {
          const block = findBlock(blocksData, itemId);
          if (block) {
            const collect = (b: Block) => { if (b.type === 'card') targetNodes.push(b.id); else { targetGroups.push(b.id); if (b.children) b.children.forEach(collect); } }
            collect(block);
          }
        }
      }
      setAltPopup({ id:itemId, type:itemType, x:e.clientX, y:e.clientY, targetNodes, targetGroups });
    },
    onDragStart: (e: React.DragEvent, dragId: string, _type: string) => {
      if (!selRef.current.has(dragId)) {
        selRef.current.clear(); selRef.current.add(dragId); syncDOMSelection();
      }
      const selectedIds = Array.from(selRef.current);
      e.dataTransfer.setData('application/json', JSON.stringify(selectedIds));
      e.dataTransfer.setData('text/plain', dragId);
      e.dataTransfer.effectAllowed = 'move';
    },
    onDragOver: (e: React.DragEvent, targetId: string, type: string) => {
      e.preventDefault(); e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      const rowEl = e.currentTarget as HTMLElement;
      const rect = rowEl.getBoundingClientRect();
      const y = e.clientY - rect.top;
      let pos: 'top'|'bottom'|'inside' = 'inside';
      
      if (type === 'card') pos = y < rect.height / 2 ? 'top' : 'bottom';
      else {
        if (y < rect.height * 0.25) pos = 'top';
        else if (y > rect.height * 0.75) pos = 'bottom';
      }
      
      const indicator = document.getElementById('drop-indicator');
      const container = scrollContainerRef.current;
      if (indicator && container) {
        const containerRect = container.getBoundingClientRect();
        const scrollY = container.scrollTop;
        if (pos === 'inside') {
          indicator.style.display = 'none'; rowEl.style.backgroundColor = 'rgba(13, 153, 255, 0.2)';
        } else {
          rowEl.style.backgroundColor = ''; indicator.style.display = 'block';
          let topPos = pos === 'top' ? rect.top - containerRect.top + scrollY : rect.bottom - containerRect.top + scrollY;
          const flatItem = flatTree.find((f:any) => f.block.id === targetId);
          let finalIndent = flatItem ? flatItem.depth * 20 + 8 : 8;
          if (pos === 'bottom' && type === 'group' && flatItem && !flatItem.block.metainfo.collapsed) { finalIndent += 20; }
          indicator.style.transform = `translateY(${topPos}px)`;
          indicator.style.left = `${finalIndent}px`;
          indicator.style.width = `calc(100% - ${finalIndent}px)`;
        }
      }
      dropTargetRef.current = { id: targetId, pos };
    },
    onDrop: (e: React.DragEvent, dropzoneId: string) => {
      e.preventDefault(); e.stopPropagation();
      
      // ИСПРАВЛЕНО: Безопасное скрытие индикатора
      const indicator = document.getElementById('drop-indicator');
      if (indicator) indicator.style.display = 'none';
      
      document.querySelectorAll('.tree-block-flat').forEach((el: any) => el.style.backgroundColor = '');
      
      let dragIds: string[] = [];
      try {
        const json = e.dataTransfer.getData('application/json');
        if (json) dragIds = JSON.parse(json); else dragIds = [e.dataTransfer.getData('text/plain')];
      } catch { dragIds = [e.dataTransfer.getData('text/plain')]; }

      if (!dragIds.length || !dropTargetRef.current) return;
      if (dragIds.includes(dropzoneId)) return; 

      const targetId = dropTargetRef.current.id;
      let targetPos = dropTargetRef.current.pos as 'top'|'bottom'|'inside'|'inside-prepend';

      setBlocksData((prev: Block[]) => {
        for (let dragId of dragIds) {
          const dragBlock = findBlock(prev, dragId);
          if (dragBlock && isDescendant(dragBlock, dropzoneId)) return prev;
        }
        
        let currentTree = prev;
        const removedBlocks: Block[] = [];
        
        dragIds.forEach(dragId => {
          const tempRemoved: Block[] = [];
          currentTree = removeBlockImm(currentTree, dragId, tempRemoved);
          if (tempRemoved.length > 0) removedBlocks.push(tempRemoved[0]);
        });
        
        if (removedBlocks.length === 0) return prev;

        const targetBlock = findBlock(currentTree, targetId);
        if (targetBlock && targetBlock.type === 'group' && targetPos === 'bottom' && !targetBlock.metainfo.collapsed) {
          targetPos = 'inside-prepend';
        }
        return insertBlocksImm(currentTree, targetId, removedBlocks, targetPos);
      });
      dropTargetRef.current = null;
    }
  }), [editingNodeId, flatTree, blocksData, searchQuery, syncDOMSelection, syncSingleDOMNode]);
};

export const useTreeKeyboard = ({
  flatTree, setBlocksData, selRef, cursorRef, lastSelectedId, syncDOMSelection, 
  setSelExport, editingNodeIdRef, rowVirtualizer, setIsSearchOpen, searchRef, 
  scrollToNode, setEditingNodeId
}: any) => {

  const handleGlobalKeyDown = useCallback(async (e: React.KeyboardEvent) => {
    // ИСПРАВЛЕНО: Закрытие карточки по Escape ДО проверок на ввод
    if (e.key === 'Escape') {
      if (editingNodeIdRef.current) {
        e.preventDefault();
        setEditingNodeId(null);
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur(); // Снимаем фокус с ввода, чтобы работали шорткаты
        }
        return;
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault(); setIsSearchOpen(true); setTimeout(() => searchRef.current?.focus(), 50);
    }
    
    const target = e.target as HTMLElement;
    const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
    
    if (isTyping) return;
    if (target.isContentEditable && editingNodeIdRef.current) return;

    if (e.key === 'Enter') {
        e.preventDefault();
        const targetId = cursorRef.current || (selRef.current.size > 0 ? Array.from(selRef.current as Set<string>)[0] : null);
        
        if (targetId) {
            const item = flatTree.find((f: any) => f.block.id === targetId);
            if (item) {
                if (item.block.type === 'group') {
                    setBlocksData((prev: Block[]) => toggleCollapseImm(prev, targetId));
                } else {
                    setEditingNodeId(targetId);
                    scrollToNode(targetId);
                }
            }
        }
        return;
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (flatTree.length === 0) return;
      let nextIdx = 0;
      
      if (cursorRef.current) {
        const idx = flatTree.findIndex((f:any) => f.block.id === cursorRef.current);
        if (idx !== -1) nextIdx = e.key === 'ArrowDown' ? Math.min(idx + 1, flatTree.length - 1) : Math.max(idx - 1, 0);
      } else {
        const visibleItems = rowVirtualizer.getVirtualItems();
        if (visibleItems.length > 0) nextIdx = visibleItems[0].index;
      }

      const nextId = flatTree[nextIdx].block.id;
      cursorRef.current = nextId;
      
      if (!e.shiftKey) { selRef.current.clear(); selRef.current.add(nextId); lastSelectedId.current = nextId; } 
      else { selRef.current.add(nextId); }
      
      syncDOMSelection();
      startTransition(() => setSelExport(Array.from(selRef.current)));
      rowVirtualizer.scrollToIndex(nextIdx, { align: 'auto' });
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault(); 
      if (selRef.current.size === 0) return;
      
      const idsToDelete = new Set(selRef.current);
      let nextCursorId = null;
      const sortedSelected = Array.from(idsToDelete as Set<string>).map(id => flatTree.findIndex((f:any) => f.block.id === id)).sort((a,b)=>a-b);
      const lastDeletedIdx = sortedSelected[sortedSelected.length - 1];
      
      for (let i = lastDeletedIdx + 1; i < flatTree.length; i++) {
        if (!idsToDelete.has(flatTree[i].block.id)) { nextCursorId = flatTree[i].block.id; break; }
      }
      if (!nextCursorId) {
        for (let i = sortedSelected[0] - 1; i >= 0; i--) {
          if (!idsToDelete.has(flatTree[i].block.id)) { nextCursorId = flatTree[i].block.id; break; }
        }
      }

      const wrappers = document.querySelectorAll('.virtual-row-wrapper');
      let cumulativeShift = 0;
      wrappers.forEach((wrapper: any) => {
        const innerNode = wrapper.querySelector('.tree-block-flat');
        if (!innerNode) return;
        const id = innerNode.getAttribute('data-tree-id');
        if (idsToDelete.has(id)) {
          cumulativeShift += wrapper.offsetHeight; wrapper.style.display = 'none';
        } else if (cumulativeShift > 0) {
          const currentTransform = wrapper.style.transform;
          const match = currentTransform.match(/translateY\(([-\d.]+)px\)/);
          if (match) {
            const currentY = parseFloat(match[1]);
            wrapper.style.transform = `translateY(${currentY - cumulativeShift}px)`;
          }
        }
      });

      selRef.current.clear();
      cursorRef.current = nextCursorId;
      if (nextCursorId) selRef.current.add(nextCursorId);
      syncDOMSelection();
      setTimeout(() => {
        startTransition(() => {
          setBlocksData((prev: Block[]) => removeMultipleBlocksImm(prev, idsToDelete as Set<string>));
          setSelExport(nextCursorId ? [nextCursorId] : []);
        });
      }, 10);
      return;
    }

    if ((e.key.toLowerCase() === 'a' || e.key.toLowerCase() === 'b') && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const isAbove = e.key.toLowerCase() === 'a';
      const targetId = cursorRef.current || (selRef.current.size > 0 ? Array.from(selRef.current)[0] : null) as any;
      const newId = `id_${Date.now()}`;
      const newBlock: Block = { id: newId, type: 'card', metainfo: { content: '' } };
      
      setBlocksData((prev: Block[]) => {
        if (!targetId) return prev;
        return insertBlocksImm(prev, targetId, [newBlock], isAbove ? 'top' : 'bottom');
      });
      
      setTimeout(() => {
        cursorRef.current = newId;
        selRef.current.clear(); 
        selRef.current.add(newId);
        setEditingNodeId(newId);
        syncDOMSelection();
        scrollToNode(newId);
      }, 50);
      return;
    }
  }, [flatTree, syncDOMSelection, setBlocksData, rowVirtualizer, scrollToNode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { handleGlobalKeyDown(e as any); };
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [handleGlobalKeyDown]);

  return handleGlobalKeyDown;
};