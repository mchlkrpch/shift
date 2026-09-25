import { useEffect, useRef, useState } from 'react';
// import { Header } from "../components/header";
import { Spinner, Box, Text } from '@chakra-ui/react';
import { gReq } from '../appwrite/service'; 
import { GraphCtx } from '../App';
import { Editor } from '../sh/editor/editor';
import { History } from './utils';
import { Sh } from '../sh/card/utility';
import store from '../storage';

// ============================================================================
// TYPES
// ============================================================================

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

// ============================================================================
// BLOCKS UTILITIES
// ============================================================================

const isBlocksArray = (arr: any): arr is Block[] => {
  return (
    Array.isArray(arr) &&
    arr.every(b =>
      b && typeof b.id === 'string' &&
      (b.type === 'card' || b.type === 'group') &&
      typeof b.metainfo === 'object'
    )
  )
}

/** 
 * Конвертирует старый формат (ns, groups) в новый древовидный JSON.
 * Использует эвристику подмножеств для восстановления иерархии групп.
 */
export const legacyToBlocks = (ns: any, groups: any): Block[] => {
  const blocksMap = new Map<string, Block>();
  const rootBlocks: Block[] = [];

  // 1. Создаем карты
  Object.entries(ns || {}).forEach(([id, content]) => {
    blocksMap.set(id, { 
      id, 
      type: 'card', 
      metainfo: { content: content as string } 
    });
  });

  // 2. Создаем группы
  Object.entries(groups || {}).forEach(([id, gData]: any) => {
    blocksMap.set(id, {
      id, 
      type: 'group',
      metainfo: { 
        title: id, 
        color: gData?.color || '#555555', 
        collapsed: false 
      },
      children: []
    });
  });

  // 3. Вычисляем иерархию через подмножества
  const gSets: Record<string, Set<string>> = {};
  Object.entries(groups || {}).forEach(([gName, gData]: any) => { 
    gSets[gName] = new Set(gData?.nodes || []); 
  });
  
  const g2g: Record<string, string> = {};
  const gNames = Object.keys(groups || {});
  
  const isSubset = (setA: Set<string>, setB: Set<string>) => {
      if (setA.size === 0) return false;
      for (let elem of setA) { if (!setB.has(elem)) return false; }
      return true;
  };
  
  gNames.forEach(g1 => {
      let bestParent: null | string = null;
      let minSize = Infinity;
      gNames.forEach(g2 => {
          if (g1 === g2) return;
          if (gSets[g1].size > 0 && gSets[g1].size < gSets[g2].size && isSubset(gSets[g1], gSets[g2])) {
              if (gSets[g2].size < minSize) { 
                bestParent = g2; 
                minSize = gSets[g2].size; 
              }
          }
      });
      if (bestParent) g2g[g1] = bestParent;
  });

  const n2g: Record<string, string> = {};
  Object.keys(groups || {}).forEach(g => {
      (groups[g]?.nodes || []).forEach((n: string) => {
          if (!n2g[n]) {
              let bestGroup: null | string = null;
              let minSize = Infinity;
              gNames.forEach(gx => { 
                  if (gSets[gx]?.has(n) && gSets[gx].size < minSize) { 
                      bestGroup = gx; 
                      minSize = gSets[gx].size; 
                  } 
              });
              if (bestGroup) n2g[n] = bestGroup;
          }
      });
  });

  // 4. Сборка дерева
  blocksMap.forEach((block, id) => {
    let parentId = block.type === 'group' ? g2g[id] : n2g[id];
    if (parentId && blocksMap.has(parentId)) {
      const parent = blocksMap.get(parentId)!;
      parent.children = parent.children || [];
      parent.children.push(block);
    } else {
      rootBlocks.push(block);
    }
  });

  return rootBlocks;
};

/** 
 * Конвертирует новый древовидный JSON обратно в старый формат.
 * Ключевое исправление: добавляет узлы во ВСЕ группы-предки (ancestors), 
 * чтобы legacyToBlocks могла корректно восстановить иерархию через подмножества.
 */
export const blocksToLegacy = (blocks: Block[]) => {
  const ns: Record<string, string> = {};
  const groups: Record<string, { color: string; nodes: string[] }> = {};

  const traverse = (b: Block, ancestors: string[]) => {
    if (b.type === 'card') {
      ns[b.id] = b.metainfo.content ?? '';
      // Добавляем узел во все группы-предки (не только в прямого родителя)
      ancestors.forEach(a => {
        if (!groups[a].nodes.includes(b.id)) {
          groups[a].nodes.push(b.id);
        }
      });
      return;
    }
    
    // Инициализируем группу
    groups[b.id] = { 
      color: b.metainfo.color || '#555555', 
      nodes: [] 
    };
    
    // Рекурсивно обходим детей с обновленным списком предков
    const nextAncestors = [...ancestors, b.id];
    (b.children || []).forEach(c => traverse(c, nextAncestors));
  };

  blocks.forEach(b => traverse(b, []));
  return { ns, groups };
};

/**
 * Пытается прочитать новый формат (дерево blocks), при неудаче — падает в legacy.
 * Возвращает и blocks, и ns/groups (нужны для Sigma / calcG / сохранения).
 */
export const parseGraphContent = (contentStr: string, groupsStr: string) => {
  let rawContent: any = {};
  let rawGroups: any = {};

  try { rawContent = JSON.parse(contentStr || '{}'); } catch { rawContent = {}; }
  try { rawGroups  = JSON.parse(groupsStr  || '{}'); } catch { rawGroups  = {}; }

  // --- Попытка №1: новый формат ---
  try {
    // Поддерживаем два варианта: прямой массив или объект с полем blocks
    const maybeBlocks =
      isBlocksArray(rawContent) ? rawContent :
      (rawContent && isBlocksArray(rawContent.blocks)) ? rawContent.blocks : null;
    if (!maybeBlocks) throw new Error('not blocks-v2');

    const legacy = blocksToLegacy(maybeBlocks);
    return { 
      blocks: maybeBlocks, 
      ns: legacy.ns, 
      groups: legacy.groups, 
      format: 'v2' as const 
    };
  } catch (e) {
    // --- Попытка №2: legacy (ns: Record<string, string>) ---
    const ns = (rawContent && typeof rawContent === 'object' && !Array.isArray(rawContent)) 
      ? rawContent 
      : {};
    const groups = (rawGroups && typeof rawGroups === 'object') ? rawGroups : {};
    
    return { 
      blocks: legacyToBlocks(ns, groups), 
      ns, 
      groups, 
      format: 'legacy' as const 
    };
  }
};

// ============================================================================
// COMPONENT
// ============================================================================

export const GraphPage = ({mode,id,name}: any) => {
    const [gData,setGraphData] = useState<any>(null);
    const [loading,setLoading] = useState<boolean>(true);
    const [error,setError] = useState<string | null>(null);

    const headerRef = useRef(null) as any;
    const collaboratorsRef = useRef(null) as any;
    
    // Legacy states (для обратной совместимости с Sigma/calcG)
    const [curNs,setNs] = useState<Record<string, string>>({});
    const [curGroups,setCurGroups] = useState<Record<string, any>>({});
    
    const gRef=useRef<any>(null);
    // const [gOwner, setOwner] = useState(undefined) as any;
    // New state (дерево блоков)
    const [curBlocks, setCurBlocks] = useState<Block[]>([]);
    
    const [nm,setName]=useState(name) as any;
    // const headerRef=useRef<any>(null);

    const [curRepeats,setCurRepeats]=useState(
        store.getState().userData.repeats[window.location.pathname.split('/')[1]],
    );

    useEffect(() => {
        const fetchGraphData = async()=>{
            if (mode === 'brief') {
                try {
                    const data = await gReq.read(id) as any;
                    if (data) {
                        setName(data.name);
                        setGraphData(data);
                        // Для brief mode тоже парсим, но отображаем только name
                        const { ns } = parseGraphContent(data.content, data.groups || '{}');
                        setNs(ns);
                    } else {
                        setError("no such graph");
                    }
                } catch (err) {
                    console.error(err);
                    setError("err");
                } finally {
                    setLoading(false);
                }
            } else {
                try {
                    const pathParts = window.location.pathname.split('/');
                    id = pathParts[pathParts.length-1]||pathParts[1];
                    const data = await gReq.read(id) as any;
                    
                    if (data) {
                        setName(data.name);
                        setGraphData(data);
                        // Парсим с попыткой прочитать новый формат
                        const { blocks, } = parseGraphContent(
                            data.content, 
                            data.groups || '{}'
                        );
                        collaboratorsRef.current = JSON.parse(data.collaborators);
                        // setNs(ns);
                        // setCurGroups(groups);
                        setCurBlocks(blocks);
                    } else {
                        setError("no such graph");
                    }
                } catch (err) {
                    console.error(err);
                    setError("err");
                } finally {
                    setLoading(false);
                }
            }
        };
        fetchGraphData();
    },[mode, id]); // добавлены зависимости для безопасности

    if (mode==='brief') {
        return <Box w={'100%'} onClick={()=>{
            History.push(`/${id}`)
        }}>
            <Sh value={name||'empty'}/>
        </Box>
    }

    if (mode==='page'){
        return (
            <Box display="flex" flexDirection="column" h="100vh">
                {loading ? (
                    <Spinner size="xl" mt={10} />
                ) : error ? (
                    <Text color="red.500" mt={10}>{error}</Text>
                ) : (
                    <GraphCtx.Provider value={{
                        selfRef:gRef,
                        ns: curNs,
                        setNs: setNs,
                        owner: gData.owner,
                        collaborators: collaboratorsRef,
                        groups: curGroups,
                        setGroups: setCurGroups,
                        blocks: curBlocks,        // <-- прокидываем дерево
                        setBlocks: setCurBlocks,  // <-- и setter для него
                        gRef: gRef,
                        id: window.location.pathname.split('/')[1],
                        name: nm,
                        repeats: curRepeats,
                        headerRef: headerRef,
                        setRepeats: setCurRepeats, 
                    }}>
                        <Editor ref={gRef}/>
                    </GraphCtx.Provider>
                )}
            </Box>
        );
    }
    
    return null;
}