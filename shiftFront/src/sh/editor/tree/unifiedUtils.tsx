import { useCallback, useEffect, useRef, useState } from "react";
import { getBlockInfoFromNode } from "./unifiedHooks";

export type DomBlock = {
  id: string;
  text: string;
  isRendered?: boolean;
  isGroup?: boolean;
  parentId?: string;
  // --- новые поля ---
  isAIChatContainer?: boolean;
  chatMessages?: any[];
  isSpinner?: any;
  role?: any;
  highlightRects?: any;
};

export const convertBlocksToUnifiedFormat = (blocks: DomBlock[]): string => {
  const lines: string[] = [];
  const blockMap = new Map(blocks.map(b => [b.id, b]));
  
  const getDepth = (block: DomBlock): number => {
    let depth = 0;
    let currentParentId = block.parentId;
    
    while (currentParentId) {
      const parent = blockMap.get(currentParentId);
      if (!parent) break;
      depth++;
      currentParentId = parent.parentId;
    }
    
    return depth;
  };
  
  blocks.forEach(block => {
    if (block.isAIChatContainer) return;
    
    const depth = getDepth(block);
    const prefix = depth > 0 ? '>'.repeat(depth) + ' ' : '';
    
    if (block.isGroup) {
      lines.push(`${prefix}# ${block.text}`);
    } else {
      lines.push(`${prefix}${block.text}`);
    }
  });
  
  return lines.join('\n~~~\n');
};

export const extractContent = (node: Node): string => {
  let text = '';
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.textContent;
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement;
      if (el.tagName === 'IMG') {
        text += `<img src="${el.getAttribute('src')}" style="${el.getAttribute('style')}" />`;
      } else if (el.classList.contains('inlineCell')) {
        const parts = el.id.split(':');
        text += parts.length === 2 ? `<id=${parts[0]}:${parts[1]}>` : `<id=${el.id}>`;
      } else if (el.tagName === 'BR') {
        text += '\n';
      } else if (el.tagName === 'DIV' || el.tagName === 'P') {
        const inner = extractContent(el);
        if (text.length > 0 && !text.endsWith('\n')) text += '\n';
        text += inner;
        if (!text.endsWith('\n')) text += '\n';
      } else {
        text += extractContent(el);
      }
    }
  }
  return text;
};

export const createOffsetWalker = (root: Node) => {
  let textSoFar = '';
  let currentRawLength = 0;
  let targetNode: Node | null = null;
  let targetOffset = 0;

  const appendText = (str: string) => {
    textSoFar += str;
    currentRawLength += str.length;
  };

  const walk = (node: Node, targetRaw: number): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length || 0;
      if (currentRawLength + len >= targetRaw) {
        targetNode = node;
        targetOffset = targetRaw - currentRawLength;
        return true;
      }
      appendText(node.textContent || '');
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.tagName === 'IMG') {
        const raw = `<img src="${el.getAttribute('src')}" style="${el.getAttribute('style')}" />`;
        if (currentRawLength + raw.length >= targetRaw) { targetNode = el.parentNode; targetOffset = Array.from(el.parentNode!.childNodes).indexOf(el) + 1; return true; }
        appendText(raw);
      } else if (el.classList.contains('inlineCell')) {
        const parts = el.id.split(':');
        const rawId = parts.length === 2 ? `<id=${parts[0]}:${parts[1]}>` : `<id=${el.id}>`;
        if (currentRawLength + rawId.length >= targetRaw) {
          targetNode = el.parentNode;
          targetOffset = Array.from(el.parentNode!.childNodes).indexOf(el) + 1;
          return true;
        }
        appendText(rawId);
      } else if (el.tagName === 'BR') {
        if (currentRawLength + 1 >= targetRaw) {
          targetNode = el.parentNode;
          targetOffset = Array.from(el.parentNode!.childNodes).indexOf(el);
          return true;
        }
        appendText('\n');
      } else if (el.tagName === 'DIV' || el.tagName === 'P') {
        if (textSoFar.length > 0 && !textSoFar.endsWith('\n')) {
            if (currentRawLength + 1 >= targetRaw) { targetNode = el; targetOffset = 0; return true; }
            appendText('\n');
        }
        for (let child of Array.from(el.childNodes)) {
          if (walk(child, targetRaw)) return true;
        }
        if (!textSoFar.endsWith('\n')) {
            if (currentRawLength + 1 >= targetRaw) { targetNode = el; targetOffset = el.childNodes.length; return true; }
            appendText('\n');
        }
      } else {
        for (let child of Array.from(el.childNodes)) {
          if (walk(child, targetRaw)) return true;
        }
      }
    }
    return false;
  };

  return {
    findOffset: (targetRaw: number) => {
      textSoFar = '';
      currentRawLength = 0;
      targetNode = null;
      targetOffset = 0;
      walk(root, targetRaw);
      return { node: targetNode, offset: targetOffset };
    }
  };
};









// ─── типы ─────────────────────────────────────────────────────────────────────

export interface DropIndicator {
  top: number;
  left: number;
  width: number;
  range: Range;
}

// ─── хук ──────────────────────────────────────────────────────────────────────

const getCaretRange = (x: number, y: number): Range | null => {
if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y);
if ((document as any).caretPositionFromPoint) {
    const pos = (document as any).caretPositionFromPoint(x, y);
    const range = document.createRange();
    range.setStart(pos.offsetNode, pos.offset);
    range.collapse(true);
    return range;
}
return null;
};




  
export const useDragDrop = ({
  editorRef,
  syncDOMToStateRef,
  setBlocksRef,
}: any) => {
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);

  // храним последний indicator в ref чтобы handleDrop не захватывал stale state
  const dropIndicatorRef = useRef<DropIndicator | null>(null);
  useEffect(() => { dropIndicatorRef.current = dropIndicator; }, [dropIndicator]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();

    const range = getCaretRange(e.clientX, e.clientY);
    if (!range || !editorRef.current) return;

    const rect          = range.getBoundingClientRect();
    const containerRect = editorRef.current.getBoundingClientRect();

    setDropIndicator({
      top:   rect.top - containerRect.top + editorRef.current.scrollTop,
      left:  20,
      width: containerRect.width - 40,
      range,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();

    if (e.dataTransfer.getData('text/plain') !== 'top-splitter') {
      setDropIndicator(null);
      return;
    }

    const indicator = dropIndicatorRef.current;
    if (!indicator?.range || !editorRef.current) {
      setDropIndicator(null);
      return;
    }

    const blockInfo = getBlockInfoFromNode(
      indicator.range.startContainer,
      indicator.range.startOffset,
      editorRef.current,
    );

    if (blockInfo) {
      const { blockIndex, offset } = blockInfo;
      const syncDOM   = syncDOMToStateRef.current;
      const setBlocks = setBlocksRef.current;
      const cur       = syncDOM();
      const block     = cur[blockIndex];

      if (block) {
        const full   = block.text;
        const before = full.substring(0, offset);
        const after  = full.substring(offset);

        const lastNlBefore   = before.lastIndexOf('\n');
        const firstNlAfter   = after.indexOf('\n');

        let splitPosition: number;

        if (firstNlAfter === -1 && lastNlBefore === -1) {
          // нет \n ни до ни после — режем в конце блока
          splitPosition = full.length;
        } else if (firstNlAfter === -1) {
          // нет \n после — режем по последнему \n до
          splitPosition = lastNlBefore + 1;
        } else if (lastNlBefore === -1) {
          // нет \n до — режем по первому \n после
          splitPosition = offset + firstNlAfter + 1;
        } else {
          // есть с обеих сторон — выбираем ближайший
          const distBefore = offset - (lastNlBefore + 1);
          const distAfter  = firstNlAfter;
          splitPosition = distAfter <= distBefore
            ? offset + firstNlAfter  + 1
            : lastNlBefore + 1;
        }
        cur.splice(blockIndex, 1,
          { ...block, text: full.substring(0, splitPosition) },
          {
            id:         `blk-${Date.now()}`,
            text:       full.substring(splitPosition),
            isRendered: false,
            parentId:   block.isGroup ? block.id : block.parentId,
          },
        );
        setBlocks([...cur]);
      }
    }
    setDropIndicator(null);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropIndicator(null);
  }, []);

  return {
    dropIndicator,
    handleDragOver,
    handleDrop,
    handleDragLeave,
  };
};































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
        // было: child.metainfo?.content.split(...)
        let cardText = (child.metainfo?.content || '').split('@@@')[0] || child.id;
        if (typeof cardText === 'string') cardText = cardText.replace(/\n/g, ' ').trim();
        segments.push({ text: cardText, isGroup: false });
      }
    });
  };
  collect(block);
  return segments;
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


export const flattenBlocksComplete = (
  blocks: Block[], 
  depth = 0, 
  prefix = '', 
  parentGroupIds: string[] = []
): FlatItem[] => {
  let result: FlatItem[] = [];
  blocks.forEach((b, i) => {
    const num = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
    
    let titleSegments = undefined;
    if (b.type === 'group') {
      titleSegments = getGroupWithChildrenSegments(b);
    }

    result.push({ 
      block: b, 
      depth, 
      numbering: num, 
      parentGroupIds, 
      titleSegments 
    });
    
    // ВСЕГДА обходим детей, игнорируя collapsed
    if (b.children && b.children.length > 0) {
      const childParentIds = b.type === 'group' 
        ? [...parentGroupIds, b.id] 
        : parentGroupIds;
      
      result.push(...flattenBlocksComplete(
        b.children, 
        depth + 1, 
        num, 
        childParentIds
      ));
    }
  });
  return result;
};

export const useTreeKeyboard = ({
  // flatTree,
  readOnly,
  setBlocksData,
  saveGraph,
}: any) => {
  const handleGlobalKeyDown = useCallback(async (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && isKey(e.key, 's')) {
      e.preventDefault();
      if (readOnly) {
        console.warn('[readOnly] сохранение запрещено: вы не владелец графа');
        return;
      }
      if (saveGraph) {
        saveGraph(false);
      }
      return;
    }
  }, [
    // flatTree,
    setBlocksData,
    readOnly,
  ]);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { handleGlobalKeyDown(e as any); };
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [handleGlobalKeyDown]);
  return handleGlobalKeyDown;
};