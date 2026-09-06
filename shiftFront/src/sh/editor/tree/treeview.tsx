/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import { Box, Button, Separator, Spacer, Tabs, VStack } from "@chakra-ui/react";
import { GraphCtx, useGraphCtx } from "../../../App";
import { Card } from "../../card/card";
import {
  forwardRef,
  memo,
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  useCallback,
  useMemo,
} from "react";
import { LuChevronDown, LuChevronRight, LuPilcrow } from "react-icons/lu";
import { useVirtualizer } from '@tanstack/react-virtual';
import { APPWRITE_CONFIG, gReq } from "../../../appwrite/service";
import { BsDiagram2Fill } from "react-icons/bs";
import { RiRepeat2Line, RiSaveFill } from "react-icons/ri";
import { Clip } from "../../clip";
import { FaShare } from "react-icons/fa";
import { 
  flattenBlocks, 
  flattenBlocksComplete, 
  removeMultipleBlocksImm, 
  updateAndInsertImm, 
  useTreeActions, 
  useTreeKeyboard, 
  useTreeSelection 
} from "./treeHooks";
import { ContextMenu, useContextMenu } from "../contextMenu";
import { Minigraph } from "../minigraph";
import { ChatNN } from "../aichat";

export const TREE_UI = {
  colors: {
    accent: '#0d99ff',
    selectedBg: 'rgba(49, 130, 206, 0.25)',
    parentSelectedBg: 'rgba(49, 130, 206, 0.08)',
    groupDefault: '#555555',
    sliceBg: 'rgba(255, 255, 255, 0.02)',
    highlightBg: 'rgba(255, 215, 0, 0.4)',
  },
  indent: {
    step: 25,
    base: 2,
  },
  rowHeight: {
    group: 32,
    card: 20,
  },
  rowStyle: {
    basePh: 7,
    basePw: 4,
    fontSize: 12,
    radius: 6,
  },
  font: {
    title: 11,
    numbering: 10,
  },
  radius: {
    block: '4px',
  },
  groupStyle: {
    fontSize: 14,
    radius: 6,
  },
  groupRow: {
    gap: 6,
    fontWeight: 500,
    btnSize: 20,
    btnHoverBg: 'rgba(255, 255, 255, 0.1)',
    colorPickerSize: 14,
    sliceSelectedBg: 'rgba(49, 130, 206, 0.15)',
    opacities: {
      pilcrow: 0.4,
      numbering: 0.4,
      title: 1.0,
    }
  }
};

const treeviewCSS = css`
display: flex; flex: 1; width: 100%; padding: 10px; gap: 10px; height: 100%; overflow-y: auto;
scrollbar-width: thin; scrollbar-color: color-mix(in srgb, white 40%, transparent) transparent;

.indicator {
  position: absolute; display: none; height: 2px; background: ${TREE_UI.colors.accent}; z-index: 100; pointer-events: none;
}
.indicator div {
  position: absolute; left: -4px; top: -2.5px; width: 7px; height: 7px; border-radius: 50%; border: 1.5px solid ${TREE_UI.colors.accent}; background: #1e1e1e;
}

.virtual-row-wrapper[data-optimistic-hidden="true"] {
  opacity: 0 !important;
  pointer-events: none !important;
}
.virtual-row-wrapper {
  min-height: 20px;
  height: auto !important;
  transition: transform 0.05s ease-out;
}
.is-toggling .virtual-row-wrapper {
  transition: none !important;
}
.virtual-row-wrapper[style*="opacity: 0"] {
  transition: opacity 0.05s ease-out !important;
}

.tree-block-flat {
  display: flex; flex-direction: row; align-items: flex-start;
  width: 100%; 
  min-height: 20px; height: auto;
  border-radius: ${TREE_UI.rowStyle.radius}px;
  border: 1.2px solid transparent;
  box-sizing: border-box; 
  transition: background-color 0.1s, border-color 0.1s; cursor: pointer;
}

.tree-block-flat[data-selected="true"] {
  background-color: color-mix(in srgb, ${TREE_UI.colors.selectedBg} 70%, transparent);
}
.tree-block-flat[data-parent-selected="true"] {
  background-color: ${TREE_UI.colors.parentSelectedBg};
  border-left-color: rgba(49, 130, 206, 0.4);
}
.tree-block-flat.is-group[data-selected="true"] {
  background-color: transparent;
}

.group-title-row { 
  display: flex; align-items: flex-start; gap: 0;
  font-size: ${TREE_UI.groupStyle.fontSize}px; 
  font-weight: ${TREE_UI.groupRow.fontWeight}; 
  width: 100%; 
}
.card-content-row { display: flex; flex: 1; min-width: 0; align-items: center; }

.tree-group-btn { 
  background: none; border: none; color: inherit; 
  height: ${TREE_UI.groupRow.btnSize}px; 
  min-width: ${TREE_UI.groupRow.btnSize}px;
  padding: 6px; display: flex; align-items: center; justify-content: center;
  cursor: pointer; border-radius: 50px;
}
.tree-group-btn:hover { background-color: ${TREE_UI.groupRow.btnHoverBg}; }

.group-slice { transition: background-color 0.1s, border-color 0.1s; }
.group-slice[data-group-selected="true"] {
  background-color: color-mix(in srgb, ${TREE_UI.groupRow.sliceSelectedBg} 40%, transparent) !important;
  z-index: 2 !important;
}

[data-is-top="true"]{
  border-top-left-radius: ${TREE_UI.groupStyle.radius}px ${TREE_UI.groupStyle.radius}px;
  border-top-right-radius: ${TREE_UI.groupStyle.radius}px ${TREE_UI.groupStyle.radius}px;
}
[data-is-bottom="true"]{
  border-bottom-left-radius: ${TREE_UI.groupStyle.radius}px ${TREE_UI.groupStyle.radius}px;
  border-bottom-right-radius: ${TREE_UI.groupStyle.radius}px ${TREE_UI.groupStyle.radius}px;
}

&:focus, &:focus-visible, &:focus-within { outline: none !important; box-shadow: none !important; }
* { &:focus, &:focus-visible { outline: none !important; box-shadow: none !important; border-color: transparent !important; } }
.tree-block-flat { &:focus, &:focus-visible, &:focus-within { outline: none !important; box-shadow: none !important; border: none; } }
`;

const headerCSS = css`
width: 100%;
align-items:
center;
justify-content: center;


.headerTabs {
  display: flex;
  flex-direction: row;
  width: 100%;
  align-items: center;
  gap: 10px;

  button {
    height: 20px;
    gap: 3px;
    font-weight: 500;
    padding: 0px 4px;
  }
  button .icon {
    height: 13px;
    width: 13px;
  }
}
`;

const HighlightText = ({ text, query }: { text: string, query: string }) => {
  if (!query || !text) return <>{text}</>;
  const parts = text.toString().split(new RegExp(`(${query})`, 'gi'));
  
  return (
    <span style={{ display: 'inline' }}>
      {parts.map((part, i) => part.toLowerCase() === query.toLowerCase() ? (
        <span key={i} style={{ backgroundColor: TREE_UI.colors.highlightBg, color: '#fff', borderRadius: '2px', padding: '0 1px' }}>
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      ))}
    </span>
  );
};

const flatNodeAreEqual = (prev: any, next: any) => {
  const wasEditing = prev.editingId === prev.item.block.id && prev.item.block.type !== 'group';
  const isEditing = next.editingId === next.item.block.id && next.item.block.type !== 'group';
  
  if (prev.item.block !== next.item.block) return false;
  if (prev.item.numbering !== next.item.numbering) return false;
  if (prev.item.depth !== next.item.depth) return false;
  if (prev.item.titleSegments !== next.item.titleSegments) return false; 
  if (wasEditing !== isEditing) return false;
  if (prev.index !== next.index) return false;
  if (prev.item.titleWithChildren !== next.item.titleWithChildren) return false;
  if (prev.isCollapsedState !== next.isCollapsedState) return false;

  const activeGroups = next.item.block.type === 'group' 
    ? [...next.item.parentGroupIds, next.item.block.id] 
    : next.item.parentGroupIds;
    
  for (let groupId of activeGroups) {
    const prevB = prev.groupBounds[groupId];
    const nextB = next.groupBounds[groupId];
    if (!prevB || !nextB) return false;
    if (prevB.start !== nextB.start || prevB.end !== nextB.end || prevB.color !== nextB.color) return false;
  }
  return true;
};

const FlatBlockNode = memo(({ item, index, actions, groupBounds, editingId, isCollapsedState, cardRefsMap }: any) => {
  const { block, depth, numbering, parentGroupIds } = item;
  const isGroup = block.type === 'group';
  const isEditingCard = editingId === block.id && !isGroup;
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editName, setEditName] = useState(block.metainfo.title || block.id);
  const [optColor, setOptColor] = useState<string | null>(null);

  useEffect(() => {
    if (optColor !== null && block.metainfo.color === optColor) setOptColor(null);
  }, [block.metainfo.color, optColor]);

  const rowIndent = depth * TREE_UI.indent.step + TREE_UI.indent.base;

  useEffect(() => {
    if (wrapperRef.current) {
      wrapperRef.current.setAttribute('data-tree-id', block.id);
      wrapperRef.current.setAttribute('data-parent-ids', parentGroupIds.join(','));
      actions.syncSingleDOMNode(wrapperRef.current, block.id, parentGroupIds);
    }
  }, [block.id, parentGroupIds, actions]);

  const activeGroups = isGroup ? [...parentGroupIds, block.id] : parentGroupIds;

  const onRenameSubmit = () => {
    setIsEditingTitle(false);
    if (!editName || editName === block.metainfo.title) { 
      setEditName(block.metainfo.title || block.id); 
      return; 
    }
    
    requestAnimationFrame(() => {
      if (wrapperRef.current) {
        const reactNode = wrapperRef.current.querySelector('.react-content') as HTMLElement;
        const vanillaNode = wrapperRef.current.querySelector('.vanilla-overlay') as HTMLElement;
        
        if (reactNode && vanillaNode) {
          reactNode.style.display = 'none';
          vanillaNode.style.display = 'inline';
          vanillaNode.textContent = editName;
        }
      }
    });

    actions.handleRenameGroup(block.id, editName);
  };

  const handleColorChange = useCallback((e: any) => {
    e.stopPropagation();
    const val = e.target.value;
    setOptColor(val);
    actions.handleChangeGroupColor(block.id, val);
  }, [block.id, actions]);

  const displaySegments = (isGroup && isCollapsedState) 
    ? (item.titleSegments || [{ text: block.metainfo.title || block.id, isGroup: true }])
    : [{ text: block.metainfo.title ?? block.id, isGroup: true }];

  const displayColor = optColor ?? block.metainfo.color ?? TREE_UI.colors.groupDefault;
  const bounds = groupBounds[block.id];
  const isBottom = bounds !== undefined ? index === bounds.end : false;
  const MT_BUTTON_MT: number = 2;

  const SegmentedTitle = ({ segments, query }: { segments: any[], query: string }) => (
    <span style={{ display: 'inline' }}>
      {segments.map((seg, i) => (
        <span key={i} style={seg.isGroup ? { fontWeight: 600, opacity: 1.0 } : { fontWeight: 300, opacity: 0.6 }}>
          <HighlightText text={seg.text} query={query} />
          {i < segments.length - 1 ? (seg.isGroup ? ': ' : ', ') : ';'}
        </span>
      ))}
    </span>
  );

  return (
    <div
      ref={wrapperRef}
      data-is-top={isGroup}
      data-is-bottom={isBottom || (isGroup && block.metainfo.collapsed)}
      className={`tree-block-flat ${isGroup ? 'is-group' : 'is-card'}`}
      style={{ paddingLeft: `${rowIndent}px` }} 
      draggable={!isEditingCard}
      onDragStart={(e) => actions.onDragStart(e, block.id, block.type)}
      onDragOver={(e) => actions.onDragOver(e, block.id, block.type)}
      onDrop={(e) => actions.onDrop(e, block.id)}
      onClickCapture={(e) => {
        if (isEditingCard) return; 
        if (e.ctrlKey || e.shiftKey || e.altKey) {
          e.stopPropagation(); e.preventDefault();
          if (e.altKey) actions.onAltClick(e, block.id, block.type);
          else actions.onClick(e, block.id);
        }
      }}
      onClick={(e) => { 
        if (isEditingCard) return; 
        actions.onClick(e, block.id); 
      }}
      onDoubleClick={(e) => {
        if (isEditingCard) return; 
        e.stopPropagation();
        if (!isGroup) actions.onDoubleClickNode(block.id);
      }}
    >
      {activeGroups.map((groupId: any) => {
        const bounds = groupBounds[groupId];
        if (!bounds) return null;
        
        const isBottom = index === bounds.end;
        const isTop = index === bounds.start;

        return (
          <div 
            key={groupId} className="group-slice" data-slice-group-id={groupId}
            data-is-top={isTop} data-is-bottom={isBottom || (isGroup && block.metainfo.collapsed)}
            style={{
              position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
              backgroundColor: 'transparent', pointerEvents: 'none', zIndex: 0
            }} 
          />
        );
      })}

      <div style={{
        position: 'relative', zIndex: 1, display: 'flex', width: '100%',
        paddingLeft: `${rowIndent}px`,
        paddingTop: `${TREE_UI.rowStyle.basePh}px`,
        paddingBottom: `${TREE_UI.rowStyle.basePh}px`,
        paddingRight: `${TREE_UI.rowStyle.basePw}px`,
      }}>
        {isGroup ? (
          <div className="group-title-row">
            <button
              className="tree-group-btn"
              onClick={(e) => { e.stopPropagation(); actions.onToggleGroup(block.id); }}
              style={{ marginRight: '10px', marginTop: '2px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', height: `${TREE_UI.groupRow.btnSize}px`, marginTop: '2px' }}>
                <LuPilcrow style={{ opacity: TREE_UI.groupRow.opacities.pilcrow, marginLeft: '-2px', height: '12px' }} />
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', height: `${TREE_UI.groupRow.btnSize}px`, marginTop: '2px', marginLeft: '-1px' }}>
                <span style={{ fontWeight: 400, fontSize: `12px`, opacity: TREE_UI.groupRow.opacities.numbering, whiteSpace: 'nowrap' }}>
                  {numbering}
                </span>
              </div>
              
              {isCollapsedState
                ? <LuChevronRight style={{ opacity: TREE_UI.groupRow.opacities.pilcrow, marginTop: `${MT_BUTTON_MT}px`, marginLeft: '2px' }} className="smIcon" />
                : <LuChevronDown style={{ opacity: TREE_UI.groupRow.opacities.pilcrow, marginTop: `${MT_BUTTON_MT}px`, marginLeft: '2px' }} className="smIcon" />}
            </button>

            {isEditingTitle ? (
              <input 
                autoFocus 
                value={editName} 
                onChange={e => setEditName(e.target.value)} 
                onBlur={onRenameSubmit} 
                onClick={e => e.stopPropagation()}
                onKeyDown={e => { 
                  e.stopPropagation(); 
                  if (e.key === 'Enter') onRenameSubmit(); 
                  if (e.key === 'Escape') { setIsEditingTitle(false); setEditName(block.metainfo.title || block.id); } 
                }}
                style={{ flex: 1, background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid gray', borderRadius: '3px', padding: '0 4px', fontSize: `${TREE_UI.rowStyle.fontSize}px` }}
              />
            ) : (
              <div style={{ flex: 1, opacity: TREE_UI.groupRow.opacities.title, whiteSpace: 'pre-wrap', wordBreak: 'break-word', paddingTop: '1px', position: 'relative' }} onDoubleClick={(e) => { e.stopPropagation(); setIsEditingTitle(true); }}>
                <span className="group-title-text react-content" style={{ display: 'inline' }}>
                  <SegmentedTitle segments={displaySegments} query={actions.searchQuery} />
                </span>
                <span className="vanilla-overlay" style={{ display: 'none' }}></span>
              </div>
            )}
            
            <input 
              type="color" 
              value={displayColor.slice(0, 7)} 
              onChange={handleColorChange} 
              onClick={(e: any) => e.stopPropagation()} 
              style={{ 
                width: `${TREE_UI.groupRow.colorPickerSize}px`, height: `${TREE_UI.groupRow.colorPickerSize}px`, 
                padding: 0, border: 'none', background: 'none', cursor: 'pointer', borderRadius: '50%', marginTop: '3px'
              }} 
            />
          </div>
        ) : (
          <div className="card-content-row">
            <Card
              id={block.id}
              content={block.metainfo.content || ''}
              options={{ open: true, stats: false, twoSides: isEditingCard, padding: '0px', fontSize: TREE_UI.rowStyle.fontSize }}
              focus={isEditingCard}
              ref={(el: any) => {
                if (el) cardRefsMap.current.set(block.id, el);
                else cardRefsMap.current.delete(block.id);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}, flatNodeAreEqual);

export const TreeView = memo(forwardRef(({}: any, ref: any) => {
  const graphCtx = useGraphCtx();
  const { id, blocks, selfRef, headerRef, searchRef, name } = graphCtx as any;
  
	const curName = useRef(name);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [blocksData, setBlocksData] = useState(blocks || []);
  const [, setSelExport] = useState<string[]>([]);
  const [, setIsSearchOpen] = useState(false);
	const blocksDataRef = useRef(blocksData);
  
  const debouncedSearch = "";
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef(null) as any;
  const editingNodeIdRef = useRef<string | null>(null);
  const cardRefsMap = useRef<Map<string, any>>(new Map());

  useEffect(() => { editingNodeIdRef.current = editingNodeId; }, [editingNodeId]);

  const { flatTree, groupBounds, computedNs, fullFlatTree } = useMemo(() => {
    const nsDict: Record<string, string> = {};
    const traverseNs = (blocks: any[]) => {
      blocks.forEach(b => {
        nsDict[b.id] = b.metainfo?.content || b.metainfo?.title || '';
        if (b.children) traverseNs(b.children);
      });
    };
    traverseNs(blocksData);
    const flat = flattenBlocks(blocksData);
    const fullFlat = flattenBlocksComplete(blocksData);
    const bounds: any = {};
    
    fullFlat.forEach((item: any, index: number) => {
      if (item.block.type === 'group') {
        bounds[item.block.id] = { 
          start: index, 
          end: index, 
          color: item.block.metainfo.color || TREE_UI.colors.groupDefault, 
          depth: item.depth 
        };
      }
      item.parentGroupIds.forEach((pid: any) => {
        if (bounds[pid]) bounds[pid].end = Math.max(bounds[pid].end, index);
      });
    });
    return { 
      flatTree: flat,
      fullFlatTree: fullFlat,
      groupBounds: bounds, 
      computedNs: nsDict 
    };
  }, [blocksData]);

  const selection = useTreeSelection();
  const { selRef, cursorRef, lastSelectedId, syncDOMSelection, syncSingleDOMNode } = selection;

  const [altPopup, setAltPopup] = useState<any>(null);

  // --- НОВАЯ ФУНКЦИЯ: Извлекает ID всех выделенных КАРТ (включая карты внутри выделенных групп) ---
  const getSelectedCardIds = useCallback(() => {
    if (!selRef.current || selRef.current.size === 0) return [];
    
    const selectedIds = Array.from(selRef.current);
    const cardsToRepeat = new Set<string>();
    
    fullFlatTree.forEach((item: any) => {
      if (item.block.type !== 'group') {
        // Карта считается выделенной, если выделена она сама ИЛИ любая из её родительских групп
        if (selectedIds.includes(item.block.id) || item.parentGroupIds.some((pid: string) => selectedIds.includes(pid))) {
          cardsToRepeat.add(item.block.id);
        }
      }
    });
    return Array.from(cardsToRepeat);
  }, [fullFlatTree, selRef]);

  const rowVirtualizer = useVirtualizer({
    count: flatTree.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: (index) => {
      const item = flatTree[index];
      if (item.block.type === 'group') {
        const row = document.querySelector(`[data-tree-id="${item.block.id}"]`) as HTMLElement;
        if (row) return Math.max(row.getBoundingClientRect().height, TREE_UI.rowHeight.group);
        return TREE_UI.rowHeight.group;
      }
      const row = document.querySelector(`[data-tree-id="${item.block.id}"]`) as HTMLElement;
      if (row) return Math.max(row.getBoundingClientRect().height, TREE_UI.rowHeight.card);
      return TREE_UI.rowHeight.card;
    },
    getItemKey: (index) => flatTree[index].block.id,
    overscan: 15,
    paddingStart: 10,
    measureElement: (el: any) => {
      if (!el) return undefined;
      return el.getBoundingClientRect().height;
    },
  });

  const actions = useTreeActions({
    blocksData, setBlocksData, flatTree, 
    selRef, cursorRef, lastSelectedId, syncDOMSelection, setSelExport, 
    editingNodeId, setEditingNodeId, setAltPopup,
    searchQuery: debouncedSearch, syncSingleDOMNode, scrollContainerRef,
    rowVirtualizer: rowVirtualizer,
  });

  const scrollToNode = useCallback((nodeId: string, align: 'auto'|'start'|'center'|'end' = 'auto') => {
    const idx = flatTree.findIndex((i: any) => i.block.id === nodeId);
    if (idx !== -1) rowVirtualizer.scrollToIndex(idx, { align });
  }, [flatTree, rowVirtualizer]);

  const handleGlobalKeyDown = useTreeKeyboard({
    flatTree, setBlocksData, selRef, cursorRef, lastSelectedId, syncDOMSelection, 
    setSelExport, editingNodeIdRef, rowVirtualizer, setIsSearchOpen, searchRef, 
    scrollToNode, setEditingNodeId, onToggleGroup: actions.onToggleGroup,
    cardRefsMap: cardRefsMap,
  });

  const { open: openMenu, props: menuProps } = useContextMenu();
  const menuItems = useMemo(() => [
    { 
      id: 'group', 
      el: 'Group Selected', 
      shortcut: 'Ctrl+G',
      onClick: () => {
        const event = new KeyboardEvent('keydown', { key: 'g', ctrlKey: true });
        handleGlobalKeyDown(event as any);
      }
    },
    { el: 'separator' },
    { id: 'add_above', el: 'Add Card Above', shortcut: 'A', onClick: () => handleGlobalKeyDown({ key: 'a', preventDefault: () => {} } as any) },
    { id: 'add_below', el: 'Add Card Below', shortcut: 'B', onClick: () => handleGlobalKeyDown({ key: 'b', preventDefault: () => {} } as any) },
    { el: 'separator' },
    { 
      id: 'delete', 
      el: 'Delete', 
      danger: true, 
      shortcut: 'Del',
      onClick: () => handleGlobalKeyDown({ key: 'Delete', preventDefault: () => {} } as any) 
    },
  ], [handleGlobalKeyDown]);

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const target = e.target as HTMLElement;
    const row = target.closest('.tree-block-flat');
    
    if (row) {
      const id = row.getAttribute('data-tree-id');
      if (id && !selRef.current.has(id)) {
        selRef.current.clear();
        selRef.current.add(id);
        cursorRef.current = id;
        syncDOMSelection();
      }
    }
    openMenu(e);
  };

  useEffect(() => {
    if (blocks && blocks.length > 0 && blocksData.length === 0) setBlocksData(blocks);
  }, [blocks]);

  useEffect(() => { syncDOMSelection(); }, [flatTree, syncDOMSelection]);
  
	useEffect(() => {
		blocksDataRef.current = blocksData;
	}, [blocksData]);

  useEffect(() => {
    if (!editingNodeId) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const editingRow = document.querySelector(`[data-tree-id="${editingNodeId}"]`);
      if (editingRow && editingRow.contains(target)) return;
      setTimeout(() => setEditingNodeId(null), 150);
    };
    
    const timer = setTimeout(() => window.addEventListener('mousedown', handleClickOutside, { capture: true }), 50);
    return () => { 
      clearTimeout(timer); 
      window.removeEventListener('mousedown', handleClickOutside, { capture: true }); 
    };
  }, [editingNodeId]);

  const saveGraph = useCallback(async (isAutoSave = false) => {
		try {
			const updatedFields = {
				content: JSON.stringify(blocksDataRef.current),
				name: curName.current,
			};
			await gReq.update(id, updatedFields);
			if (!isAutoSave) console.info('Graph saved successfully');
		} catch (error) {
			console.error("Failed to save graph:", error);
		}
	}, [id]);

  const HeaderTabsComponent = () => {
    const [localTab, setLocalTab] = useState(selfRef.current?.getMode() || 'eg');
    
    // --- НОВЫЙ КОД: Состояния для логики скрытия/показа ---
    const [isNearBottom, setIsNearBottom] = useState(false);
    const [isChatFocused, setIsChatFocused] = useState(false);

    useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
        // Расстояние от низа экрана, при котором появляется ChatNN (в пикселях). 
        // Можете настроить это значение под себя.
        const THRESHOLD = 200; 
        const distanceToBottom = window.innerHeight - e.clientY;
        setIsNearBottom(distanceToBottom < THRESHOLD);
      };

      window.addEventListener('mousemove', handleMouseMove);
      return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // Чат показывается, если мышка внизу ИЛИ если пользователь внутри что-то пишет
    const showChat = isNearBottom || isChatFocused;
    // -------------------------------------------------------

    return (
      <span key="header-tabs" css={headerCSS}>
        <VStack
          gap={showChat ? "10px" : "0px"}
          // transition="gap 0.3s ease"
          transform={showChat ? "translateY(-3px)" : "translateY(0)"}
          /* Добавляем transform в анимацию для плавности */
          transition="gap 0.3s ease, transform 0.3s ease" 
          
          className={'blur-panel'}
        >
          <Box 
            p={0}
            onFocus={() => setIsChatFocused(true)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setIsChatFocused(false);
              }
            }}
            style={{
              maxHeight: showChat ? '500px' : '0px',
              opacity: showChat ? 1 : 0,
              transform: showChat ? 'translateY(0)' : 'translateY(20px)',
              pointerEvents: showChat ? 'auto' : 'none',
              overflow: 'hidden',
              borderWidth: showChat ? '1px' : '0px',
              transition: 'all 0.1s cubic-bezier(0.4, 0, 0.2, 1)',
              visibility: showChat ? 'visible' : 'hidden',
              border: 'none',
              gap:'10px',
            }}
          >
            <ChatNN/>
            <Separator h={'1px'} orientation={'horizontal'} w={'100%'} mt={'10px'} opacity={0.2}/>
          </Box>


          <Tabs.Root 
            className='headerTabs'
            value={localTab}
            variant="plain"
            onValueChange={(e: any) => {
              const newValue = e.value;
              setLocalTab(newValue);
              if (newValue === 'repeat') {
                const cardsToRepeat = getSelectedCardIds();
                if (cardsToRepeat.length > 0) {
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('start-feed-training', { detail: cardsToRepeat }));
                  }, 50);
                }
              }

              if (editingNodeId) { 
                setTimeout(() => { 
                  selfRef.current.setMode(newValue);
                  setEditingNodeId(null); 
                }, 150); 
              } else { 
                selfRef.current.setMode(newValue); 
              }
            }}
          >
            
            <Tabs.Trigger className='tabsTrigger' value="eg"><BsDiagram2Fill /></Tabs.Trigger>
            <Tabs.Trigger className='tabsTrigger' value="repeat" ml={'-6px'}><RiRepeat2Line /></Tabs.Trigger>

            <GraphCtx.Provider value={{ 
              selfRef: tabsRef, 
              blocks: curName, 
              setBlocks: (p: any) => { curName.current = p['0'] }, 
              ns: curName,
              setNs: async (p: any) => { curName.current = p['0']; } 
            }}>
              <Box p={0} m={0} onClickCapture={(e: any) => { if (e.altKey) { actions.onAltClick(e, '__root__', 'root'); e.stopPropagation(); } }}>
                <Card
                  id={'0'}
                  content={curName.current as any}
                  options={{ twoSides: false, fontSize: 12, onBlur: (newVal: any) => curName.current = newVal }}
                />
              </Box>
            </GraphCtx.Provider>

            <Spacer />
            
            <Button variant={'ghost'} colorPalette={'green'} onClick={saveGraph as any}>
              <RiSaveFill className={'icon'}/> save
            </Button>
            <Clip 
              props={{ h: '20px', variant: 'ghost', p: '0', w: '20px', minW: '20px' }} 
              copyIcon={<FaShare style={{ width: '13px', height: '13px' }}/>} 
              value={APPWRITE_CONFIG.BASE_URL + '/' + id} 
            />
          </Tabs.Root>
        </VStack>
      </span>
    );
  };

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (headerRef?.current?.resetContent) {
        await headerRef.current.resetContent();
        const dc = headerRef.current.getContent();
        headerRef.current.setContent([dc[0], <HeaderTabsComponent key="header-tabs-comp" />, dc[2]]);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

	const updateCardContent = useCallback((id: string, newContent: string, additionalBlocks: any[] = []) => {
		setBlocksData((prev: any[]) => updateAndInsertImm(prev, id, newContent, additionalBlocks));
	}, []);

	const treeGraphCtx = useMemo(() => ({
    ...graphCtx,
    ns: computedNs,
    updateCardContent,
    fullFlatTree 
  }), [computedNs, updateCardContent, fullFlatTree, graphCtx]);

  useImperativeHandle(ref, () => ({
    scrollToNode,
    getContainer: () => scrollContainerRef.current
  }));

  return (
		<GraphCtx.Provider value={treeGraphCtx}>
			<div
        css={treeviewCSS}
        ref={scrollContainerRef}
        onKeyDown={handleGlobalKeyDown}
        onContextMenu={onContextMenu}
      >
				<div id="drop-indicator" className="indicator"><div></div></div>

        {altPopup && (
          <Minigraph
            {...altPopup} 
            ns={computedNs}
            flatTree={fullFlatTree}
            groups={groupBounds}
            onClose={() => setAltPopup(null)}
            onDelete={() => {
                const ids = new Set(altPopup.targetNodes) as any;
                setBlocksData((prev: any) => removeMultipleBlocksImm(prev, ids));
                setAltPopup(null);
            }}
          />
        )}

        <ContextMenu {...menuProps} items={menuItems} />

				<div style={{ height: `${rowVirtualizer.getTotalSize() + 700}px`, width: '100%', position: 'relative' }}>
					{rowVirtualizer.getVirtualItems().map((virtualItem: any) => {
						const item = flatTree[virtualItem.index];
            const optToggle = (actions.optimisticToggles as any)[item.block.id];
            const isCollapsedState = item.block.type === 'group' && 
              (optToggle !== undefined ? optToggle : item.block.metainfo.collapsed);
            
            return (
              <div 
                key={item.block.id} 
                ref={rowVirtualizer.measureElement} 
                data-index={virtualItem.index} 
                className="virtual-row-wrapper"
                style={{ 
                  position: 'absolute', 
                  top: 0, 
                  left: 0, 
                  width: '100%', 
                  transform: `translateY(${virtualItem.start}px)`, 
                  display: 'block' 
                }}
              >
                <FlatBlockNode
                  item={item} 
                  index={virtualItem.index} 
                  groupBounds={groupBounds} 
                  actions={actions} 
                  editingId={editingNodeId} 
                  isCollapsedState={isCollapsedState}
                  cardRefsMap={cardRefsMap}
                />
              </div>
            );
					})}
				</div>
			</div>
		</GraphCtx.Provider>
  );
}));