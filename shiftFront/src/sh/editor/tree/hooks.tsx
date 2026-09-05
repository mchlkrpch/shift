import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
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
  titleSegments?: TitleSegment[];
};
export type TitleSegment = { text: string; isGroup: boolean };

export const getGroupWithChildrenSegments = (block: any): TitleSegment[] => {
  const segments: TitleSegment[] = [];
  
  const baseName = block.metainfo?.title || block.id;
  segments.push({ text: baseName, isGroup: true });

  const collect = (b: any) => {
    if (!b.children) return;
    b.children.forEach((child: any) => {
      if (child.type === 'group') {
        segments.push({ text: child.metainfo?.title || child.id, isGroup: true });
        collect(child);
      }
      if (child.type === 'card') {
        let cardText = child.metainfo?.content.split('@@@')[0] || child.id;
        if (typeof cardText === 'string') cardText = cardText.replace(/\n/g, ' ').trim();
        segments.push({ text: cardText, isGroup: false });
      }
    });
  };
  collect(block);
  return segments;
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

const isKey = (kk: any, key: string) => {
  const k = kk.toLowerCase();
  const map: Record<string, string[]> = {
    'f': ['f', 'а'],
    'g': ['g', 'п'],
    'a': ['a', 'ф'],
    'b': ['b', 'и'],
    's': ['s', 'ы'],
  };
  return map[key]?.includes(k) || k === key;
};


const toggleCollapseImm = (blocks: Block[], id: string): Block[] => {
  let changed = false;

  const res = blocks.map(b => {
    // Нашли нужную группу
    if (b.id === id) {
      changed = true;

      return {
        ...b,
        metainfo: {
          ...b.metainfo,
          collapsed: !b.metainfo.collapsed,
        },
      };
    }

    // Ищем группу рекурсивно внутри children
    if (b.children) {
      const newChildren = toggleCollapseImm(b.children, id);

      if (newChildren !== b.children) {
        changed = true;

        return {
          ...b,
          children: newChildren,
        };
      }
    }

    return b;
  });

  return changed ? res : blocks;
};

export const updateBlockMetainfoImm = (blocks: Block[], id: string, metainfoUpdate: Partial<Block['metainfo']>): Block[] => {
  let changed = false;
  const res = blocks.map(b => {
    if (b.id === id) {
      changed = true;
      return { ...b, metainfo: { ...b.metainfo, ...metainfoUpdate } };
    }
    if (b.children) {
      const newC = updateBlockMetainfoImm(b.children, id, metainfoUpdate);
      if (newC !== b.children) {
        changed = true;
        return { ...b, children: newC };
      }
    }
    return b;
  });
  return changed ? res : blocks;
};

export const removeMultipleBlocksImm = (blocks: Block[], idsToDelete: Set<string>): Block[] => {
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


export const updateAndInsertImm = (
  blocks: any[], 
  targetId: string, 
  newContent: string, 
  newBlocks: any[]
): any[] => {
  let changed = false;
  const res = blocks.flatMap(b => {
    if (b.id === targetId) {
      changed = true;
      const updatedBlock = { ...b, metainfo: { ...b.metainfo, content: newContent } };
      // Возвращаем обновленную карточку и сразу за ней - новые (созданные через ~~~)
      return [updatedBlock, ...newBlocks]; 
    }
    if (b.children) {
      const newChildren = updateAndInsertImm(b.children, targetId, newContent, newBlocks);
      if (newChildren !== b.children) {
        changed = true;
        return [{ ...b, children: newChildren }];
      }
    }
    return [b];
  });
  return changed ? res : blocks;
};

export const groupSelectedBlocksImm = (blocks: Block[], selectedIds: Set<string>): Block[] => {
  if (selectedIds.size === 0) return blocks;

  const selectedBlocks: Block[] = [];

  // 1. Собираем объекты блоков в том же порядке, в котором они лежат в дереве сверху вниз
  const findAndCollect = (list: Block[]) => {
    list.forEach(b => {
      if (selectedIds.has(b.id)) {
        selectedBlocks.push(b);
        // Если мы уже берем родителя целиком, нам не нужно отдельно пушить его детей,
        // даже если они тоже выделены. Они перенесутся внутрь родителя.
      } else if (b.children) {
        findAndCollect(b.children);
      }
    });
  };
  findAndCollect(blocks);

  if (selectedBlocks.length === 0) return blocks;

  const newGroup: Block = {
    id: `group_${Date.now()}`,
    type: 'group',
    metainfo: { title: 'New Group', collapsed: false, color: '#555555' },
    children: selectedBlocks
  };

  // 2. Идем по дереву, удаляем выбранные элементы, 
  // а на место САМОГО ПЕРВОГО встреченного вставляем нашу новую группу.
  let isGroupInserted = false;

  const insertAndRemove = (list: Block[]): Block[] => {
    let changed = false;
    const res: Block[] = [];

    for (const b of list) {
      if (selectedIds.has(b.id)) {
        changed = true;
        // Если это первый выделенный элемент, который мы встретили - ставим группу вместо него
        if (!isGroupInserted) {
          res.push(newGroup);
          isGroupInserted = true;
        }
        // В противном случае мы просто ничего не пушим в `res` (удаляем элемент)
      } else {
        if (b.children) {
          const newChildren = insertAndRemove(b.children);
          if (newChildren !== b.children) {
            changed = true;
            res.push({ ...b, children: newChildren });
            continue; // идем к следующему элементу цикла
          }
        }
        res.push(b);
      }
    }
    return changed ? res : list;
  };

  return insertAndRemove(blocks);
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
    
    let titleSegments = undefined;
    if (b.type === 'group') {
      titleSegments = getGroupWithChildrenSegments(b);
    }

    result.push({ block: b, depth, numbering: num, parentGroupIds, titleSegments });
    
    if (b.type === 'group' && !b.metainfo.collapsed && b.children) {
      result.push(...flattenBlocks(b.children, depth + 1, num, [...parentGroupIds, b.id]));
    }
  });
  return result;
};

export const useTreeSelection = () => {
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
  searchQuery, syncSingleDOMNode, scrollContainerRef,rowVirtualizer 
}: any) => {
  const dropTargetRef = useRef<{ id: string, pos: 'top'|'bottom'|'inside' } | null>(null);
  const [optimisticToggles, setOptimisticToggles] = useState<Set<string>>(new Set());

  return useMemo(() => ({
    checkIsSelected: (id: string) => selRef.current.has(id),
    syncSingleDOMNode,
    searchQuery,
    optimisticToggles,
    onDoubleClickNode: (clickedId: string) => { setEditingNodeId(clickedId); },
    onToggleGroup: (groupId: string) => {
      const item = flatTree.find((f: any) => f.block.id === groupId);
      if (!item) return;
      const isCollapsed = item.block.metainfo.collapsed;
      const container = scrollContainerRef.current;
      
      const escapeHtml = (str: string) => str.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
      
      const measureGroupHeight = (segments: any[]): number => {
        const groupRow = document.querySelector(`[data-tree-id="${groupId}"]`) as HTMLElement;
        if (!groupRow) return 32;
        const clone = groupRow.cloneNode(true) as HTMLElement;
        clone.style.position = 'absolute';
        clone.style.visibility = 'hidden';
        clone.style.pointerEvents = 'none';
        clone.style.zIndex = '-9999';
        clone.style.left = '0';
        clone.style.top = '0';
        clone.style.width = `${groupRow.getBoundingClientRect().width}px`;
        clone.style.height = 'auto';
        clone.style.transition = 'none';
        const vanilla = clone.querySelector('.vanilla-overlay') as HTMLElement;
        const reactContent = clone.querySelector('.react-content') as HTMLElement;
        if (vanilla && reactContent) {
          reactContent.style.display = 'none';
          vanilla.style.display = 'inline';
          vanilla.innerHTML = segments.map((seg: any, i: number) => {
            const fw = seg.isGroup ? '600' : '400';
            const comma = i < segments.length - 1 ? ', ' : '';
            return `<span style="font-weight: ${fw}">${escapeHtml(seg.text)}${comma}</span>`;
          }).join('');
        }
        const tempWrapper = document.createElement('div');
        tempWrapper.style.position = 'absolute';
        tempWrapper.style.visibility = 'hidden';
        tempWrapper.appendChild(clone);
        const appendTarget = container || document.body;
        appendTarget.appendChild(tempWrapper);
        const height = clone.getBoundingClientRect().height;
        appendTarget.removeChild(tempWrapper);
        return Math.max(height, 32); 
      };
      
      const applyVanillaText = (targetId: string, isNowCollapsed: boolean) => {
        const row = document.querySelector(`[data-tree-id="${targetId}"]`);
        if (!row) return null;
        const reactContent = row.querySelector('.react-content') as HTMLElement;
        const vanillaOverlay = row.querySelector('.vanilla-overlay') as HTMLElement;
        if (reactContent && vanillaOverlay) {
          reactContent.style.display = 'none';
          vanillaOverlay.style.display = 'inline';
          const nextSegments = isNowCollapsed 
              ? (item.titleSegments || [{ text: item.block.metainfo.title || item.block.id, isGroup: true }])
              : [{ text: item.block.metainfo.title || item.block.id, isGroup: true }];
          vanillaOverlay.innerHTML = nextSegments.map((seg: any, i: number) => {
              const fw = seg.isGroup ? '600' : '400';
              const comma = i < nextSegments.length - 1 ? ', ' : '';
              return `<span style="font-weight: ${fw}">${escapeHtml(seg.text)}${comma}</span>`;
          }).join('');
        }
        const arrowSvg = row.querySelector('.tree-group-btn svg') as HTMLElement;
        if (arrowSvg) {
          arrowSvg.style.transition = 'none';
          arrowSvg.style.transform = isNowCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
        }
        return row;
      };
      
      const cleanupVanillaDOM = (targetId: string) => {
        const row = document.querySelector(`[data-tree-id="${targetId}"]`);
        if (row) {
            const rc = row.querySelector('.react-content') as HTMLElement;
            const vo = row.querySelector('.vanilla-overlay') as HTMLElement;
            const arr = row.querySelector('.tree-group-btn svg') as HTMLElement;
            if (rc) rc.style.display = '';
            if (vo) { vo.style.display = 'none'; vo.innerHTML = ''; }
            if (arr) { arr.style.transition = ''; arr.style.transform = ''; }
        }
      };
      
      if (!isCollapsed) {
        // ===== COLLAPSE (СВОРАЧИВАНИЕ) =====
        const idsToHide = new Set<string>();
        flatTree.forEach((f: any) => {
          if (f.parentGroupIds.includes(groupId)) idsToHide.add(f.block.id);
        });
        if (idsToHide.size === 0) {
          setBlocksData((prev: Block[]) => toggleCollapseImm(prev, groupId));
          return;
        }
        const nextSegments = item.titleSegments || [{ 
          text: item.block.metainfo.title || item.block.id, 
          isGroup: true 
        }];
        const groupRow = document.querySelector(`[data-tree-id="${groupId}"]`) as HTMLElement;
        const currentHeight = groupRow?.closest('.virtual-row-wrapper')?.getBoundingClientRect().height || 32;
        const futureHeight = measureGroupHeight(nextSegments);
        const groupHeightChange = futureHeight - currentHeight;
        
        applyVanillaText(groupId, true);
        
        const groupWrapper = groupRow?.closest('.virtual-row-wrapper') as HTMLElement;
        if (groupWrapper && groupHeightChange !== 0) {
          groupWrapper.style.height = `${futureHeight}px`;
        }
        
        const wrappers = Array.from(document.querySelectorAll('.virtual-row-wrapper')) as HTMLElement[];
        const shiftMap = new Map<HTMLElement, { hide: boolean; shift: number }>();
        let cumulativeShift = 0;
        let passedGroup = false;
        wrappers.forEach((wrapper) => {
          const innerNode = wrapper.querySelector('.tree-block-flat');
          if (!innerNode) return;
          const id = innerNode.getAttribute('data-tree-id');
          if (id === groupId) {
            passedGroup = true;
            return;
          }
          if (idsToHide.has(id!)) {
            const height = wrapper.getBoundingClientRect().height;
            shiftMap.set(wrapper, { hide: true, shift: cumulativeShift });
            cumulativeShift += height;
          } else if (cumulativeShift > 0) {
            const adjustedShift = passedGroup 
              ? cumulativeShift - groupHeightChange 
              : cumulativeShift;
            shiftMap.set(wrapper, { hide: false, shift: adjustedShift });
          }
        });
        
        wrappers.forEach((wrapper) => {
          const data = shiftMap.get(wrapper);
          if (!data) return;

          if (data.hide) {
            wrapper.style.cssText += '; opacity: 0; pointer-events: none;';
          } else {
            const currentTransform = wrapper.style.transform;
            const match = currentTransform.match(/translateY\(([-\d.]+)px\)/);
            if (match) {
              const currentY = parseFloat(match[1]);
              wrapper.style.cssText += `; transition: none; transform: translateY(${currentY - data.shift}px);`;
            }
          }
        });
        
        if (container) container.offsetHeight;
        requestAnimationFrame(() => {
          setBlocksData((prev: Block[]) => toggleCollapseImm(prev, groupId));
          requestAnimationFrame(() => {
            wrappers.forEach((w) => {
              w.style.opacity = '';
              w.style.pointerEvents = '';
              w.style.transition = '';
            });
            cleanupVanillaDOM(groupId);
            if (rowVirtualizer) {
              const groupIndex = flatTree.findIndex((f: any) => f.block.id === groupId);
              if (groupIndex !== -1) {
                rowVirtualizer.measureElement(
                  document.querySelector(`[data-index="${groupIndex}"]`)
                );
                for (let i = 1; i <= 5; i++) {
                  const nextEl = document.querySelector(`[data-index="${groupIndex + i}"]`);
                  if (nextEl) rowVirtualizer.measureElement(nextEl);
                }
              }
            }
          });
        });
      } else {
        // ===== UNCOLLAPSE (РАЗВОРАЧИВАНИЕ) — ОПТИМИЗИРОВАННОЕ =====
        const collapsedSegments = [{ 
          text: item.block.metainfo.title || item.block.id, 
          isGroup: true 
        }];
        
        const groupRow = document.querySelector(`[data-tree-id="${groupId}"]`) as HTMLElement;
        const currentHeight = groupRow?.closest('.virtual-row-wrapper')?.getBoundingClientRect().height || 32;
        const futureHeight = measureGroupHeight(collapsedSegments);
        const groupHeightChange = currentHeight - futureHeight;
        
        // 1. Мгновенно меняем текст и стрелку
        applyVanillaText(groupId, false);
        
        const groupWrapper = groupRow?.closest('.virtual-row-wrapper') as HTMLElement;
        if (groupWrapper && groupHeightChange !== 0) {
          groupWrapper.style.transition = 'none';
          groupWrapper.style.height = `${futureHeight}px`;
        }
        
        // 2. Обновляем стейт БЕЗ flushSync (асинхронно)
        setBlocksData((prev: Block[]) => toggleCollapseImm(prev, groupId));
        
        // 3. В следующем кадре React уже отрендерит строки
        requestAnimationFrame(() => {
          // Получаем все новые строки
          const newRows = document.querySelectorAll(`[data-parent-ids*="${groupId}"]`);
          
          // Мгновенно показываем их (они уже в DOM)
          newRows.forEach((row: any) => {
            const wrapper = row.closest('.virtual-row-wrapper');
            if (wrapper) {
              wrapper.style.transition = 'none';
              wrapper.style.opacity = '1';
              wrapper.style.pointerEvents = 'auto';
            }
          });
          
          // Сбрасываем стили группы
          if (groupWrapper) {
            groupWrapper.style.height = '';
            groupWrapper.style.transition = '';
          }
          
          cleanupVanillaDOM(groupId);
          
          // Измеряем строки для виртуализатора
          if (rowVirtualizer) {
            const groupIndex = flatTree.findIndex((f: any) => f.block.id === groupId);
            if (groupIndex !== -1) {
              const groupEl = document.querySelector(`[data-index="${groupIndex}"]`);
              if (groupEl) rowVirtualizer.measureElement(groupEl);
              
              // Измеряем следующие 20 строк
              for (let i = 1; i <= 20; i++) {
                const el = document.querySelector(`[data-index="${groupIndex + i}"]`);
                if (el) rowVirtualizer.measureElement(el);
              }
            }
          }
        });
      }
    },



    handleChangeGroupColor: (groupId: string, color: string) => {
      startTransition(() => {
        setBlocksData((prev: Block[]) => updateBlockMetainfoImm(prev, groupId, { color }));
      });
    },
    handleRenameGroup: (groupId: string, title: string) => {
      startTransition(() => {
        setBlocksData((prev: Block[]) => updateBlockMetainfoImm(prev, groupId, { title }));
      });
    },
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
  scrollToNode, setEditingNodeId, onToggleGroup
}: any) => {

  const handleGlobalKeyDown = useCallback(async (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      let handled = false;
      if (editingNodeIdRef.current) {
        e.preventDefault();
        setEditingNodeId(null);
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur(); 
        }
        return;
      }

      if (cursorRef.current || selRef.current.size > 0) {
        e.preventDefault();
        cursorRef.current = null;
        selRef.current.clear();
        syncDOMSelection();
        handled = true;
      }

      if (handled) return;
    }

    if ((e.ctrlKey || e.metaKey) && isKey(e.key, 'f')) {
      e.preventDefault(); setIsSearchOpen(true); setTimeout(() => searchRef.current?.focus(), 50);
    }

    if ((e.ctrlKey || e.metaKey) && isKey(e.key, 'g')) { // Группировка
      e.preventDefault();
      if (selRef.current.size > 0) {
        setBlocksData((prev: Block[]) => {
            const newTree = groupSelectedBlocksImm(prev, selRef.current);
            // Находим ID новой группы (он будет в начале или можно его вернуть из функции)
            return newTree;
        });
        // Очистка выделения после группировки
        setTimeout(() => {
          selRef.current.clear();
          syncDOMSelection();
        }, 50);
      }
    }
    
    const target = e.target as HTMLElement;
    const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;



    if (isTyping) return;
    if (target.isContentEditable && editingNodeIdRef.current) return;



    // if (e.key === 'Enter') {
    //   e.preventDefault();
    //   const targetId = cursorRef.current || (selRef.current.size > 0 ? Array.from(selRef.current as Set<string>)[0] : null);
    //   if (targetId) {
    //     const item = flatTree.find((f: any) => f.block.id === targetId);
    //     if (item) {
    //         if (item.block.type === 'group') {
    //             const isCollapsed = item.block.metainfo.collapsed;
    //             // Выбираем сегменты текста
    //             const nextSegments = isCollapsed 
    //                 ? [{ text: item.block.metainfo.title || item.block.id, isGroup: true }]
    //                 : (item.titleSegments || [{ text: item.block.metainfo.title || item.block.id, isGroup: true }]);
    //             // Мгновенно инжектируем HTML, чтобы обойти лаг рендера (50мс)
    //             const row = document.querySelector(`[data-tree-id="${targetId}"]`);
    //             if (row) {
    //               const titleNode = row.querySelector('.group-title-text');
    //               if (titleNode) {
    //                 const escapeHtml = (str: string) => str.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    //                 titleNode.innerHTML = `<span style="display: inline;">` + nextSegments.map((seg: any, i: number) => {
    //                     const fw = seg.isGroup ? '600' : '400';
    //                     const comma = i < nextSegments.length - 1 ? ', ' : '';
    //                     return `<span style="font-weight: ${fw}">${escapeHtml(seg.text)}${comma}</span>`;
    //                 }).join('') + `</span>`;
    //               }
    //             }
    //             onToggleGroup(targetId);
    //         } else {
    //             setEditingNodeId(targetId);
    //             scrollToNode(targetId);
    //         }
    //     }
    //   }
    //   return;
    // }
    // if (e.key === 'Enter') {
    //   e.preventDefault();
    //   const targetId = cursorRef.current || (selRef.current.size > 0 ? Array.from(selRef.current as Set<string>)[0] : null);
    //   if (targetId) {
    //     const item = flatTree.find((f: any) => f.block.id === targetId);
    //     if (item) {
    //         if (item.block.type === 'group') {
    //           const isCollapsed = item.block.metainfo.collapsed;
    //           const nextSegments = isCollapsed 
    //                 ? [{ text: item.block.metainfo.title || item.block.id, isGroup: true }]
    //                 : (item.titleSegments || [{ text: item.block.metainfo.title || item.block.id, isGroup: true }]);
    //             // Никакого innerHTML! onToggleGroup сам всё сделает безопасно и мгновенно.
    //             const row = document.querySelector(`[data-tree-id="${targetId}"]`);
    //             if (row) {
    //               const titleNode = row.querySelector('.group-title-text');
    //               if (titleNode) {
    //                 const escapeHtml = (str: string) => str.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    //                 titleNode.innerHTML = `<span style="display: inline;">` + nextSegments.map((seg: any, i: number) => {
    //                     const fw = seg.isGroup ? '600' : '400';
    //                     const comma = i < nextSegments.length - 1 ? ', ' : '';
    //                     return `<span style="font-weight: ${fw}">${escapeHtml(seg.text)}${comma}</span>`;
    //                 }).join('') + `</span>`;
    //               }
    //             }
    //             onToggleGroup(targetId);
    //         } else {
    //             setEditingNodeId(targetId);
    //             scrollToNode(targetId);
    //         }
    //     }
    //   }
    //   return;
    // }



    if (e.key === 'Enter') {
      e.preventDefault();
      const targetId = cursorRef.current || (selRef.current.size > 0 ? Array.from(selRef.current as Set<string>)[0] : null);
      if (targetId) {
        const item = flatTree.find((f: any) => f.block.id === targetId);
        if (item) {
            if (item.block.type === 'group') {
                // Вся ванильная магия теперь инкапсулирована тут:
                onToggleGroup(targetId);
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
      flatTree.forEach((item: any) => {
        if (item.parentGroupIds.some((pid: string) => idsToDelete.has(pid))) {
          idsToDelete.add(item.block.id);
        }
      });
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
          cumulativeShift += wrapper.offsetHeight;
          // ВАЖНО: Не используем display: 'none', это триггерит перерасчет виртуализатора.
          // Прячем визуально и отключаем клики.
          wrapper.style.opacity = '0';
          wrapper.style.pointerEvents = 'none';
        } else if (cumulativeShift > 0) {
          const currentTransform = wrapper.style.transform;
          const match = currentTransform.match(/translateY\(([-\d.]+)px\)/);
          if (match) {
            const currentY = parseFloat(match[1]);
            // Сдвигаем элементы с учетом transition (0.05s)
            wrapper.style.transform = `translateY(${currentY - cumulativeShift}px)`;
          }
        }
      });
      selRef.current.clear();
      cursorRef.current = nextCursorId;
      if (nextCursorId) selRef.current.add(nextCursorId);
      syncDOMSelection();
      
      // --- 3. СИНХРОНИЗАЦИЯ С REACT И VIRTUALIZER ---
      // Ждем 50ms - ровно столько, сколько идет ваша CSS анимация (0.05s).
      // Убираем startTransition, чтобы React обновил дерево синхронно и без рывков.
      setTimeout(() => {
        setBlocksData((prev: Block[]) => removeMultipleBlocksImm(prev, idsToDelete as Set<string>));
        setSelExport(nextCursorId ? [nextCursorId] : []);
        requestAnimationFrame(() => {
          document.querySelectorAll('.virtual-row-wrapper').forEach((w: any) => {
             w.style.opacity = '';
             w.style.pointerEvents = '';
          });
        });
      }, 50);
      return;
    }



    if ((isKey(e.key, 'a') || isKey(e.key, 'b')) && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const isAbove = isKey(e.key, 'a');
      const targetId = cursorRef.current || (selRef.current.size > 0 ? Array.from(selRef.current)[0] : null) as any;
      const newId = `id_${Date.now()}`;
      const newBlock: Block = { id: newId, type: 'card', metainfo: { content: '' } };
      setBlocksData((prev: Block[]) => {
        if (!targetId) {
          return isAbove ? [newBlock, ...prev] : [...prev, newBlock];
        }
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
  }, [flatTree, syncDOMSelection, setBlocksData, rowVirtualizer, scrollToNode, onToggleGroup]);



  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { handleGlobalKeyDown(e as any); };
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [handleGlobalKeyDown]);



  return handleGlobalKeyDown;
};