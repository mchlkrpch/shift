/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import {
	Box,
	HStack,
	Text,
	Spacer
} from "@chakra-ui/react";
import React, {
	useCallback,
	useMemo
} from "react";


// camera geometry
export const CAMERA_Y_RATIO = 0.3;
export const CARD_GAP = 2;
export const ANIM_START_DIST = 80;
export const ANIM_STOP_DIST = 60;
export const MAX_Y_OFFSET = 2;

// repeat intervals
export const LEVEL_UP_WINDOWS: Array<[number, number]> = [
	[0, 30 * 1000],                              // Lvl 0: [now, 30 sec]
	[1 * 60 * 1000, 30 * 60 * 1000],             // Lvl 1: [1 min, 30 min]
	[1 * 60 * 60 * 1000, 6 * 60 * 60 * 1000],    // Lvl 2: [1 h, 6 h]
	[12 * 60 * 60 * 1000, 24 * 60 * 60 * 1000],  // Lvl 3: [12 h, 1 d]
];
export const MAX_LEVEL = LEVEL_UP_WINDOWS.length; 
export const N_UNLOCK = 1; 

export type CardCategory =
	| 'new'
	| 'grow'
	| 'waiting'
	| 'possiblyForgotten'
	| 'forgottenPast'
	| 'mastered'
	| 'done'
	| 'pale'
	| 'empty';

export const CATEGORY_COLORS: Record<CardCategory, string> = {
	new: 'color-mix(in srgb, var(--chakra-colors-bg-inverted) 60%, var(--chakra-colors-bg))',
	grow: 'color-mix(in srgb, var(--chakra-colors-bg-inverted) 90%, var(--chakra-colors-bg))',
	waiting: 'rgba(120,170,255,0.35)',
	possiblyForgotten: '#ecc94b',
	forgottenPast: '#e53e3e',
	mastered: 'rgba(72,187,120,0.5)',
	done: 'color-mix(in srgb, var(--chakra-colors-bg-inverted) 10%, var(--chakra-colors-bg))',
	pale: 'color-mix(in srgb, var(--chakra-colors-bg-inverted) 10%, var(--chakra-colors-bg))',
	empty: 'transparent'
};

export const CATEGORY_LABELS: Record<CardCategory, string> = {
	new: 'New',
	grow: 'Ready',
	waiting: 'Learned',
	possiblyForgotten: 'At risk',
	forgottenPast: 'Forgot before',
	mastered: 'Mastered',
	done: 'Done',
	pale: 'Practice',
	empty: 'empty'
};

export const CATEGORY_TEXT_COLORS: Record<CardCategory, string> = {
	new: 'gray.400',
	grow: 'blue.300',
	waiting: 'green.400',
	possiblyForgotten: 'yellow.400',
	forgottenPast: 'red.400',
	mastered: 'purple.300',
	done: 'gray.600',
	pale: 'gray.500',
	empty: 'transparent',
};

// --- СSS Ускорение (добавлены contain и will-change) ---
export const feedCSS = css`
display: flex;
flex: 1;
width: 100%;
height: 100%;
overflow: hidden;
position: relative;

.table-screen {
	padding: 0px;
	flex: 1; overflow-y: auto;
	scrollbar-width: none;
	padding: 10px 20px;
	max-width: 800px;
	margin: 0 auto;
}
.settings-toolbar {
	display: flex;
	gap: 5px; align-items: center;
	padding: 7px 5px;
	margin-top: 70px;
	margin-bottom: 20px;
	flex-wrap: wrap;
	border-bottom: 1px solid rgba(255,255,255,0.05);
}
.thinButton { height: 20px; font-size: 12px; }
.tree-container { padding: 5px; }
.legend-item { display: flex; align-items: center; gap: 4px; font-size: 11px; opacity: 0.7; }
.legend-dot { width: 8px; height: 8px; border-radius: 50%; }

/* Hardware acceleration & containment */
.row-container { 
	position: relative; 
	display: flex; 
	width: 100%; 
	align-items: center; 
	will-change: transform; 
	contain: layout style;
}
.indicator-line {margin-left: 20px; top: 5px; height: 5px; width: 5px; bottom: 5px; border-radius: 4px; background-color: transparent; transition: background-color 0.3s ease; z-index: 20; }
.indicator-line[data-category="new"] { background-color: ${CATEGORY_COLORS.new}; }
.indicator-line[data-category="grow"] { background-color: ${CATEGORY_COLORS.grow}; }
.indicator-line[data-category="possiblyForgotten"] { background-color: ${CATEGORY_COLORS.possiblyForgotten}; }
.indicator-line[data-category="forgottenPast"] { background-color: ${CATEGORY_COLORS.forgottenPast}; }
.indicator-line[data-category="mastered"] { background-color: ${CATEGORY_COLORS.mastered}; }
.indicator-line[data-category="waiting"] { background-color: transparent; }
.indicator-line[data-category="done"] { background-color: ${CATEGORY_COLORS.done}; } 
.indicator-line[data-category="pale"] { background-color: ${CATEGORY_COLORS.pale}; } 

.feed-container {
	flex: 1;
	display: flex;
	flex-direction: column;
	position: relative;
	padding: 0px 80px;
	margin: 0 auto;
	overflow-y: auto;
	scroll-behavior: smooth;
	scrollbar-width: none;
}

.virtual-card-wrapper { 
	flex: 1; 
	padding: 0px 20px; 
	padding-left: 50px; 
	opacity: 0.3; 
	pointer-events: none; 
	will-change: transform, opacity; 
	contain: content; 
	transform-origin: left center; 
}
.virtual-card-wrapper[data-selected="true"] { opacity: 1; pointer-events: auto; z-index: 10; }
.native-stack {
	display: flex;
	flex-direction: column;
	gap: ${CARD_GAP}px;
	width: 100%;
}
.card-inner-box { border-radius: 7px; padding: 5px 10px; width: 100%; transition: border-color 0.3s ease, box-shadow 0.3s ease; background-color: var(--chakra-colors-bg-emphasized); }
.feed-timeline { position: absolute; top: 60px; left: 0; right: 0; max-width: 800px; margin: 0 auto; height: 10px; z-index: 40; pointer-events: none; }
.feed-timeline-clip {
	position: absolute;
	top: 0; bottom: 0;
	left: 20px; right: 20px;
	overflow: hidden;
	border-radius: 0px;
	box-shadow: 0 0 0 1px rgba(255,255,255,0.08);
}
.feed-timeline-track { position: absolute; top: 0; left: 0; height: 100%; width: 100%; }
.feed-timeline-thumb { position: absolute; top: -3px; width: 3px; height: 16px; background: #4299e1; border-radius: 2px; left: 0%; transform: translateX(-50%); box-shadow: 0 0 4px rgba(66,153,225,0.9); }
`;

// export const menuCSS = css`
// .menuFrame { position: fixed; backdrop-filter: blur(20px); background-color: var(--chakra-colors-bg); border: 1.5px solid color-mix(in srgb, var(--chakra-colors-bg-inverted) 10%, var(--chakra-colors-bg)); border-radius: 5px; padding: 3px; overflow-y: auto; min-width: 100px; display: flex; flex-direction: column; gap: 5px; font-weight: 400; z-index: 12000; scrollbar-width: thin; scrollbar-color: color-mix(in srgb, var(--chakra-colors-bg-inverted) 10%, var(--chakra-colors-bg)) transparent; box-shadow: 0 2px 10px var(--chakra-colors-bg); }
// .menuFrame .tip { font-size: 11px; opacity: 0.3; font-weight: 400; }
// .item { width: 100%; font-size: 11px; display: flex; align-items: center; gap: 4px; padding: 2px; border-radius: 5px; transition: background 0.1s ease; }
// `;


export interface ExtendedRepeatEntry { path: string; history: number[]; nOfErrors: number; }
export interface FeedRow { uid: string; cardId: string; category: CardCategory; level: number; }
export interface ScheduledEvent { id: string; cardId: string; type: 'insert' | 'decay'; scheduledAt: number; level: number; rowUid: string; status: 'pending' | 'executed' | 'cancelled'; }




// ———— cards dependencies via <id=...> in it's content ———————————————————————————————————————————————————————————————————————


export const extractDeps = (text: string) => {
  const deps: string[] = [];
  const regex = /<id=([^>]+)>/g;
  let match;
  while ((match = regex.exec(text)) !== null) deps.push(match[1].split(':')[0]);
  return deps;
};

export const buildDependencyGraph = (
	ns: Record<string, { content: string; path: string[] }>
): Record<string, string[]> => {
  const map: Record<string, string[]> = {};
  Object.keys(ns).forEach(id => {
    map[id] = extractDeps(ns[id]?.content || '').filter(d => ns[d] !== undefined);
  });
  return map;
};



// ———— FEED TIMELINE PROGRESS BAR ———————————————————————————————————————————————————————————————————————

export const makeEmptyRow = (idx: number): FeedRow => ({
  uid: `empty-${idx}`,
  cardId: '',
  category: 'empty',
  level: -1,
});

export const buildTimelineGradient = (sequence: Array<CardCategory>) => {
  if (sequence.length === 0) return 'transparent';
  const NUM_BUCKETS = Math.min(sequence.length, 300);
  const bucketSize = sequence.length / NUM_BUCKETS;
  const stops: string[] = [];
  
  for (let b = 0; b < NUM_BUCKETS; b++) {
    const from = Math.floor(b * bucketSize);
    const to = Math.max(from + 1, Math.floor((b + 1) * bucketSize));
    let chosen: CardCategory = 'mastered';
    outer:
    for (const cat of [
				'forgottenPast',
				'possiblyForgotten',
				'grow',
				'new',
				'waiting',
				'mastered',
				'pale',
				'done'
			] as CardCategory[]
		) {
      for (let i = from; i < to && i < sequence.length; i++) {
        if (sequence[i] === cat) { chosen = cat; break outer; }
      }
    }
    const color = CATEGORY_COLORS[chosen];
    stops.push(`${color} ${(b / NUM_BUCKETS) * 100}%, ${color} ${((b + 1) / NUM_BUCKETS) * 100}%`);
  }
  return `linear-gradient(to right, ${stops.join(', ')})`;
};


// ПОЛНАЯ история вместо "окна" ±K карт:
// - трек всегда занимает 100% ширины клипа (никакого scale/translate под ±K карт вокруг текущего индекса);
// - последовательность категорий строится по ВСЕЙ материализованной части ленты (0..feedSize),
//   плюс "превью" ожидающих insert-событий в конце;
// - позиция маркера — это просто % прогресса (activeIndexState / totalLength), без независимого
//   сканирования DOM (getBoundingClientRect по всем row-container). Это заодно снимает лишнюю
//   нагрузку с каждого scroll-кадра (см. второй пункт правок в NewFeed.tsx).
export const FeedTimeline = ({ feedList, feedSize, globalEvents, activeIndexState }: any) => {
  const { gradient, totalLength } = useMemo(() => {
    const materialized = feedList.slice(0, feedSize);
    const seq = materialized.map((r: FeedRow, i: number) =>
      r.category === 'forgottenPast' ? 'forgottenPast' : (i < activeIndexState ? 'done' : r.category)
    );
    const pendingInserts = globalEvents.filter((e: ScheduledEvent) => e.type === 'insert' && e.status === 'pending');
    pendingInserts.sort((a: any, b: any) => a.scheduledAt - b.scheduledAt);
    pendingInserts.forEach((e: ScheduledEvent) => { seq.push(e.level === 0 ? 'new' : 'grow'); });
    return { gradient: buildTimelineGradient(seq), totalLength: seq.length };
  }, [feedList, feedSize, globalEvents, activeIndexState]);

  const thumbPercent = totalLength > 0 ? ((activeIndexState + 0.5) / totalLength) * 100 : 0;
  return (
    <Box className="feed-timeline">
      <Box className="feed-timeline-clip">
        <Box className="feed-timeline-track" style={{ background: gradient }} />
      </Box>
      <Box className="feed-timeline-thumb" style={{ left: `${thumbPercent}%` }} />
    </Box>
  );
};



export const getLevelFromHistory = (history: number[]) => Math.min(history.length, MAX_LEVEL);

export const getInstantMasteryHistory = (now: number): number[] => {
  const H = 60 * 60 * 1000, M = 60 * 1000;
  return [now - (18 * H + 4 * H + 15 * M), now - (18 * H + 4 * H), now - (18 * H), now];
};

export const getCardState = (
	id: string,
	ns: Record<string, { content: string; path: string[] }>,
	extendedRepeats: Record<string, ExtendedRepeatEntry>,
	depsMap: Record<string, string[]>
) => {
	const entry = extendedRepeats[id] || { path: id, history: [], nOfErrors: 0 };
	const level = getLevelFromHistory(entry.history);
	const deps = depsMap[id] || extractDeps(ns[id]?.content || '');
	let isLocked = false;
	for (const depId of deps) {
		const depEntry = extendedRepeats[depId];
		if (!depEntry || depEntry.history.length < N_UNLOCK) { isLocked = true; break; }
	}
	return { level, isLocked, entry };
};

export const checkIsDue = (level: number, history: number[], now: number) => {
  if (level >= MAX_LEVEL) return false;
  if (level === 0) return true;
  const win = LEVEL_UP_WINDOWS[level]!;
  const lastTime = history[level - 1];
  return now >= lastTime + win[0];
};

const parseExistingRepeatEntry = (data: any): { history: number[]; nOfErrors: number } => {
  if (!data) return { history: [], nOfErrors: 0 };
  if (Array.isArray(data)) return { history: data, nOfErrors: 0 };
  if (Array.isArray(data.history)) return { history: data.history, nOfErrors: data.nOfErrors || 0 };
  return { history: data.stages || [], nOfErrors: data.wrongCount || 0 };
};

export const buildExtendedRepeats = (
  ns: Record<string, { content: string; path: string[] }>,
  existingRepeats: Record<string, any> = {}
): Record<string, ExtendedRepeatEntry> => {
  const result: Record<string, ExtendedRepeatEntry> = {};
  Object.keys(ns).forEach(id => {
    const { history, nOfErrors } = parseExistingRepeatEntry(existingRepeats?.[id]);
    result[id] = { path: id, history, nOfErrors };
  });
  return result;
};

export type ActiveNsEntry = { content: string; path: string[] };
export type ActiveNs = Record<string, ActiveNsEntry>;

export type PathTreeNode = {
  key: string; 
  name: string; 
  children: Record<string, PathTreeNode>;
  nodeIds: string[];
};

export const buildPathTree = (activeNs: ActiveNs): PathTreeNode => {
  const root: PathTreeNode = { key: '', name: '', children: {}, nodeIds: [] };
  Object.keys(activeNs).forEach(id => {
    const path = activeNs[id]?.path || [];
    let cursor = root;
    let accKey = '';
    path.forEach(segment => {
      accKey = accKey ? `${accKey}/${segment}` : segment;
      if (!cursor.children[segment]) {
        cursor.children[segment] = { key: accKey, name: segment, children: {}, nodeIds: [] };
      }
      cursor = cursor.children[segment];
    });
    cursor.nodeIds.push(id);
  });
  return root;
};

export const getAllNodeIds = (node: PathTreeNode): string[] => {
  let res = [...node.nodeIds];
  Object.values(node.children).forEach(child => { res = res.concat(getAllNodeIds(child)); });
  return res;
};


export interface SelectionTreeProps {
  activeNs: ActiveNs;
  extendedRepeatsRef: React.MutableRefObject<Record<string, ExtendedRepeatEntry>>;
  depsMap: Record<string, string[]>;
  selectedCards: Set<string>;
  setSelectedCards: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export const SelectionTree: React.FC<SelectionTreeProps> = ({
  activeNs,
  extendedRepeatsRef,
  depsMap,
  selectedCards,
  setSelectedCards,
}) => {
  const pathTree = useMemo(() => buildPathTree(activeNs), [activeNs]);

  const handleToggleNode = useCallback((id: string, checked: boolean) => {
    setSelectedCards(prev => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  }, [setSelectedCards]);

  const handleTogglePathGroup = useCallback((node: PathTreeNode, checked: boolean) => {
    const ids = getAllNodeIds(node);
    setSelectedCards(prev => {
      const next = new Set(prev);
      ids.forEach(n => checked ? next.add(n) : next.delete(n));
      return next;
    });
  }, [setSelectedCards]);

  const renderTreeNode = useCallback((id: string, depth: number) => {
    const st = getCardState(id, activeNs, extendedRepeatsRef.current, depsMap);
    if (!st) return null;
    let label = 'Ready';
    let color = CATEGORY_TEXT_COLORS.grow;
    if (st.isLocked) { label = 'Locked'; color = 'gray.500'; }
    else if (st.level >= MAX_LEVEL) { label = 'Mastered'; color = CATEGORY_TEXT_COLORS.mastered; }
    else if (st.level === 0) {
      label = st.entry.nOfErrors > 0 ? 'Forgot before' : 'New';
      color = st.entry.nOfErrors > 0 ? CATEGORY_TEXT_COLORS.forgottenPast : CATEGORY_TEXT_COLORS.new;
    } else {
      label = `Lvl ${st.level}`;
    }
    return (
      <HStack key={id} ml={`${depth * 20}px`} fontSize="13px" py="4px">
        <input type="checkbox" checked={selectedCards.has(id)} onChange={e => handleToggleNode(id, e.target.checked)} />
        <Text maxW="300px" title={activeNs[id]?.content}>{activeNs[id]?.content || id}</Text>
        <Spacer />
        <Text color={color} fontSize="11px" w="140px" textAlign="right">{label}</Text>
      </HStack>
    );
  }, [activeNs, extendedRepeatsRef, depsMap, selectedCards, handleToggleNode]);

  const renderNode = useCallback((node: PathTreeNode, depth: number): React.ReactNode => {
    const allIds = getAllNodeIds(node);
    const isChecked = allIds.length > 0 && allIds.every(n => selectedCards.has(n));
    const isIndeterminate = !isChecked && allIds.some(n => selectedCards.has(n));
    const isRoot = node.key === '';
    const sortedChildren = Object.values(node.children).sort((a, b) => a.name.localeCompare(b.name));

    return (
      <Box key={node.key || '__root__'}>
        {!isRoot && (
          <HStack ml={`${depth * 20}px`} fontSize="14px" py="6px" fontWeight="bold" borderBottom="1px solid rgba(255,255,255,0.1)">
            <input type="checkbox" checked={isChecked} ref={el => { if (el) el.indeterminate = isIndeterminate; }} onChange={e => handleTogglePathGroup(node, e.target.checked)} />
            <Text color="white">{node.name}</Text>
          </HStack>
        )}
        <Box pl={isRoot ? '0px' : '20px'}>
          {sortedChildren.map(child => renderNode(child, isRoot ? depth : depth + 1))}
          {node.nodeIds.map(id => renderTreeNode(id, isRoot ? depth : depth + 1))}
        </Box>
      </Box>
    );
  }, [selectedCards, handleTogglePathGroup, renderTreeNode]);
  return <>{renderNode(pathTree, 0)}</>;
};