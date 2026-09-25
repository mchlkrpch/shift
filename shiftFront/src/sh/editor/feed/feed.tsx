/** @jsxImportSource @emotion/react */
import {
  Box,
  // HStack,
  // Text,
  Spacer,
  Button,
  // VStack,
  Spinner,
} from "@chakra-ui/react";
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useImperativeHandle
} from "react";
import { useGraphCtx } from "../../../App";
import { Card } from "../../card/card";
import { ANIM_START_DIST,
  ANIM_STOP_DIST,
  buildDependencyGraph,
  buildExtendedRepeats,
  CAMERA_Y_RATIO,
  CARD_GAP,
  checkIsDue,
  // extractDeps,
  feedCSS,
  FeedTimeline,
  getCardState,
  LEVEL_UP_WINDOWS,
  makeEmptyRow,
  MAX_LEVEL,
  MAX_Y_OFFSET,
  // menuCSS,
  SelectionTree,
  type CardCategory,
  type ExtendedRepeatEntry,
  type FeedRow,
  type ScheduledEvent,
} from "./feedUtils";
// import { menuCSS } from "../tree/unifiedTreeview";


const PALE_LOOKAHEAD = 25;
const ROW_HEIGHT_ESTIMATE = 130;
const CATCHUP_BATCH_SIZE = 8;
const CATCHUP_INTERVAL_MS = 150;
const FEED_INITIAL_CAPACITY = 25;
const CATCHUP_HARD_LIMIT = 5000;


const toRawRepeats = (extended: Record<string, ExtendedRepeatEntry>) => {
  const out: Record<string, { history: number[]; nOfErrors: number; last: number }> = {};
  Object.keys(extended).forEach(id => {
    const e = extended[id];
    out[id] = { history: e.history, nOfErrors: e.nOfErrors, last: e.history.length ? e.history[e.history.length - 1] : 0 };
  });
  return out;
};



// ———— React.memo Карточка для исключения перерисовок при скролле —————————————————————————

const FeedRowItem = React.memo(({ row, index, visualCategory, content, onHeightMeasure, scrollToIndex }: any) => {
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!rowRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const height = entries[0].target.getBoundingClientRect().height;
      if (height > 0) onHeightMeasure(row.uid, height);
    });
    observer.observe(rowRef.current);
    return () => observer.disconnect();
  }, [row.uid, onHeightMeasure]);
  if (row.category === 'empty') {
    return (
      <Box
        ref={rowRef}
        className="row-container"
        data-index={index}
        style={{ height: ROW_HEIGHT_ESTIMATE }}
      />
    );
  }
  return (
    <Box ref={rowRef} className="row-container" data-index={index} onClick={() => scrollToIndex(index)}>
      <div className="indicator-line" data-category={visualCategory} />
      <Box className="virtual-card-wrapper" data-selected="false">
        <Box className="card-inner-box" position="relative">
          <Card
            id={row.cardId}
            content={content}
            options={{
              twoSides: false,
              open: visualCategory === 'new' || visualCategory === 'forgottenPast',
              showStats: false,
              fontSize: 12
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}, (prev, next) => {
  return (
    prev.row.uid === next.row.uid &&
    prev.visualCategory === next.visualCategory &&
    prev.index === next.index &&
    prev.content === next.content
  )
});



// ———— Debug Panels (Автономные интервалы обновления) ———————————————————————————————————————————

// const DebugLocked = ({ activeNs, extendedRepeatsRef, depsMap, selectedCardsRef, feedSizeRef, feedCapacity }: any) => {
//   const [, setTick] = useState(0);
//   useEffect(() => {
//     const int = setInterval(() => setTick(t => t + 1), 1000);
//     return () => clearInterval(int);
//   }, []);
//   const feedSize = feedSizeRef.current;
//   const cs = Object.keys(activeNs).map(cardId => {
//     const rawDeps = extractDeps(activeNs[cardId]?.content || '');
//     const resolvedDeps = depsMap[cardId] || [];
//     const st = getCardState(cardId, activeNs, extendedRepeatsRef.current, depsMap);
//     return {
//       id: cardId,
//       title: activeNs[cardId]?.content || cardId,
//       rawDeps,
//       resolvedDeps,
//       unresolvedDeps: rawDeps.filter(d => !resolvedDeps.includes(d)),
//       isLocked: st.isLocked,
//       level: st.level,
//       inSelected: selectedCardsRef.current.has(cardId),
//     };
//   });
//   return (
//     <Box css={menuCSS} fontSize={'4px'}>
//       <Box className={'menuFrame'} bottom={0} maxH={'200px'}>
//         {cs.length} cards · feed {feedSize}/{feedCapacity} (sz/capacity)
//         {cs.map((c:any) => (
//           <Box key={c.id} py="2px" borderBottom="1px solid rgba(255,255,255,0.05)">
//             <HStack justify="space-between">
//               <Text maxW="50px" fontWeight="bold" title={c.title}>{c.title}</Text>
//               <Text color={c.isLocked ? 'red.300' : 'green.300'}>{c.isLocked ? 'LOCKED' : `OPEN (lvl ${c.level})`}</Text>
//             </HStack>
//             {c.unresolvedDeps.length > 0 && <Text color="orange.300">⚠️ unresolved: {c.unresolvedDeps.join(', ')}</Text>}
//           </Box>
//         ))}
//       </Box>
//     </Box>
//   )
// }

// const DebugEvents = ({ globalEventsRef, activeNs, extendedRepeatsRef, depsMap, feedSizeRef, feedCapacity }: any) => {
//   const [, setTick] = useState(0);
//   useEffect(() => {
//     const int = setInterval(() => setTick(t => t + 1), 1000); // Читаем свежие данные 1 раз в сек
//     return () => clearInterval(int);
//   }, []);
//   const executed = globalEventsRef.current.filter((e:any) => e.status === 'executed').slice(-7);
//   const pending = globalEventsRef.current.filter((e:any) => e.status === 'pending').sort((a:any, b:any) => a.scheduledAt - b.scheduledAt);
//   const feedSize = feedSizeRef.current;
//   const now = Date.now();
//   return (
//     <Box css={menuCSS} fontSize={'4px'}>
//       <Box className={'menuFrame'} right={0} bottom={0} maxH={'200px'}>
//         <Text fontWeight="bold" color="white">Feed: {feedSize} / {feedCapacity} (sz/capacity)</Text>
//         Исполненные события:
//         {executed.length === 0 && <Text>Нет исполненных</Text>}
//         {executed.map((ev:any) => {
//           const title = activeNs[ev.cardId]?.content?.substring(0, 15) || ev.cardId;
//           const prefix = ev.type === 'insert' ? `[Добавлено]` : `[Пожелтела]`;
//           return (
//             <HStack key={ev.id} justify="space-between" py="2px" borderBottom="1px solid rgba(255,255,255,0.05)">
//               <Text maxW="150px" color="gray.500" title={activeNs[ev.cardId]?.content}>{prefix} {title}</Text>
//               <Text color="gray.500" minW="60px" textAlign="right">только что</Text>
//             </HStack>
//           );
//         })}
//         <Text fontWeight="bold" mb={2} mt={2} color="white">Ожидающие ({pending.length}):</Text>
//         <VStack align="stretch" gap="1">
//           {pending.slice(0, 100).map((ev:any) => {
//             const diff = ev.scheduledAt - now;
//             let timeStr = 'Сейчас';
//             if (diff > 0) {
//               const totalSec = Math.floor(diff / 1000);
//               const h = Math.floor(totalSec / 3600);
//               const m = Math.floor((totalSec % 3600) / 60);
//               const s = totalSec % 60;
//               if (h > 0) timeStr = `через ${h}ч ${m}м`;
//               else if (m > 0) timeStr = `через ${m}м ${s}с`;
//               else timeStr = `через ${s}с`;
//             }
//             const st = getCardState(ev.cardId, activeNs, extendedRepeatsRef.current, depsMap);
//             const isFrozen = ev.level > st.level;
//             const title = activeNs[ev.cardId]?.content?.substring(0, 20) || ev.cardId;
//             return (
//               <HStack key={ev.id} justify="space-between" py="2px" borderBottom="1px solid rgba(255,255,255,0.05)">
//                 <Text maxW="160px" color="gray.300">{isFrozen ? `[Lvl ${ev.level} ⏸️]` : `[Lvl ${ev.level}]`} {title}</Text>
//                 <Text color={diff <= 0 ? 'green.300' : (ev.type === 'decay' ? 'yellow.300' : 'blue.300')} textAlign="right">{timeStr}</Text>
//               </HStack>
//             );
//           })}
//         </VStack>
//       </Box>
//     </Box>
//   )
// }



// ———— Main Feed ———————————————————————————————————————————————————————————————————————————————

export const Feed = React.forwardRef(({}: any, ref: any) => {
  const [isTraining, setIsTraining] = useState(false);

  const [filters, _setFilters] = useState({ new: true, due: true, learned: false });
  const [_clearDialogPos, setClearDialogPos] = useState<{ top: number; left: number } | null>(null);
  const [_isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const { blocks, repeats, setRepeats } = useGraphCtx() as any;

  const activeNs = useMemo(() => {
    const dict: Record<string, { content: string; path: string[] }> = {};
    const traverse = (nodes: any[], path: string[]) => {
      if (!Array.isArray(nodes)) return;
      nodes.forEach(b => {
        if (b.type === 'group') {
          const label = b.metainfo?.title || b.id;
          if (b.children) traverse(b.children, [...path, label]);
          return;
        }
        if (b.id) dict[b.id] = { content: b.metainfo?.content || b.metainfo?.title || '', path };
        if (b.children) traverse(b.children, path);
      });
    };
    traverse(blocks, []);
    return dict;
  }, [blocks]);

  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const extendedRepeats = useMemo(() => buildExtendedRepeats(activeNs, repeats), [activeNs, repeats]);
  const depsMap = useMemo(() => buildDependencyGraph(activeNs), [activeNs]);

  const [feedList, setFeedList] = useState<FeedRow[]>(
    () => Array.from({ length: FEED_INITIAL_CAPACITY }, (_, i) => makeEmptyRow(i)));
  const [feedSize, setFeedSize] = useState(0);
  const feedSizeRef = useRef(0);
  const [activeIndexState, setActiveIndexState] = useState(0);
  const [, forceTick] = useState(0); // Облегченный стейт для запуска tickEngine в UI

  const answeredRowUidsRef = useRef<Set<string>>(new Set());
  const desiredAheadRef = useRef(PALE_LOOKAHEAD);

  const activeIndexRef = useRef(0);
  const extendedRepeatsRef = useRef<Record<string, ExtendedRepeatEntry>>(extendedRepeats);
  const scrollRef = useRef<HTMLDivElement>(null);
  const feedListRef = useRef<FeedRow[]>(feedList);
  const selectedCardsRef = useRef<Set<string>>(selectedCards);
  const globalEventsRef = useRef<ScheduledEvent[]>([]);

  const heightsCacheRef = useRef<Record<string, number>>({});
  const [renderedRange, setRenderedRange] = useState({ start: 0, end: 40 });
  const renderedRangeRef = useRef(renderedRange);

  const commitFeedList = useCallback((list: FeedRow[], size?: number) => {
    feedListRef.current = list;
    setFeedList(list);
    if (size !== undefined) {
      feedSizeRef.current = size;
      setFeedSize(size);
    }
  }, []);

  useEffect(() => { selectedCardsRef.current = selectedCards; }, [selectedCards]);
  useEffect(() => { if (!isTraining) extendedRepeatsRef.current = extendedRepeats; }, [extendedRepeats, isTraining]);

  const StartTraining = useCallback((forceSelected?: Set<string>) => {
    let targetSelection = forceSelected || selectedCards;
    if (targetSelection.size === 0) {
      const allKeys = Object.keys(activeNs);
      if (allKeys.length > 0) {
        const newSelection = new Set(allKeys);
        setSelectedCards(newSelection);
        targetSelection = newSelection;
      }
    }
    if (targetSelection.size > 0) {
      activeIndexRef.current = 0;
      setActiveIndexState(0);
      globalEventsRef.current = [];
      answeredRowUidsRef.current = new Set();
      desiredAheadRef.current = PALE_LOOKAHEAD;
      heightsCacheRef.current = {};
      const initialRange = { start: 0, end: 40 };
      renderedRangeRef.current = initialRange;
      setRenderedRange(initialRange);
      const initial = Array.from({ length: FEED_INITIAL_CAPACITY }, (_, i) => makeEmptyRow(i));
      commitFeedList(initial, 0);
      setIsTraining(true);
    } else {
      alert("Нет доступных карточек для тренировки.");
    }
  }, [selectedCards, activeNs, commitFeedList]);

  const bumpDesiredAhead = useCallback(() => {
    if (!scrollRef.current) return;
    const scrollEl = scrollRef.current;
    const deepestIndex = Math.floor((scrollEl.scrollTop + scrollEl.clientHeight) / ROW_HEIGHT_ESTIMATE);
    const target = deepestIndex + PALE_LOOKAHEAD;
    if (target > desiredAheadRef.current) desiredAheadRef.current = target;
  }, []);

  const getVisualCategory = useCallback((row: FeedRow, index: number): CardCategory => {
    if (row.category === 'forgottenPast') return 'forgottenPast';
    return index < activeIndexState ? 'done' : row.category;
  }, [activeIndexState]);

  const _getAvaible = useCallback(() => {
    const pool = new Set(selectedCardsRef.current);
    Object.keys(activeNs).forEach(cardId => {
      if (pool.has(cardId)) return;
      const deps = depsMap[cardId];
      if (!deps || deps.length === 0) return;
      const st = getCardState(cardId, activeNs, extendedRepeatsRef.current, depsMap);
      if (!st.isLocked) pool.add(cardId);
    });
    return pool;
  }, [activeNs, depsMap]);

  const _schedule = useCallback((cardId: string, startLevel: number, baseTime: number) => {
    const newEvents: ScheduledEvent[] = [];
    for (let lvl = startLevel; lvl < MAX_LEVEL; lvl++) {
      const win = LEVEL_UP_WINDOWS[lvl];
      const rowUid = `${cardId}-${Date.now()}-${lvl}-${Math.random()}`;
      newEvents.push({ id: `${rowUid}-insert`, cardId, type: 'insert', scheduledAt: baseTime + win[0], level: lvl, rowUid, status: 'pending' });
      newEvents.push({ id: `${rowUid}-decay`, cardId, type: 'decay', scheduledAt: baseTime + win[1], level: lvl, rowUid, status: 'pending' });
    }
    globalEventsRef.current.push(...newEvents);
  }, []);

  const tickEngine = useCallback((options?: { catchUp?: boolean }) => {
    const currentNow = Date.now();
    let feedUpdated = false;
    const newFeedList = [...feedListRef.current];
    let sz = feedSizeRef.current;
    const trainingPool = _getAvaible();

    const ensureCapacity = (requiredSize: number) => {
      while (newFeedList.length < requiredSize) newFeedList.push(makeEmptyRow(newFeedList.length));
    };

    const materializeRow = (row: FeedRow) => {
      ensureCapacity(sz + 1);
      newFeedList[sz] = row;
      sz += 1;
      feedUpdated = true;
    };

    trainingPool.forEach(cardId => {
      const st = getCardState(cardId, activeNs, extendedRepeatsRef.current, depsMap);
      if (st.isLocked) return;
      const hasInsertEvents = globalEventsRef.current.some(e => e.cardId === cardId && e.type === 'insert' && e.status === 'pending');
      const inUnansweredFeed = newFeedList.slice(activeIndexRef.current, sz).some(r => r.cardId === cardId);
      if (!hasInsertEvents && !inUnansweredFeed) {
        const isNew = st.level === 0 && st.entry.nOfErrors === 0;
        const isMastered = st.level >= MAX_LEVEL;
        const isDue = checkIsDue(st.level, st.entry.history, currentNow);
        const isWaiting = !isDue && st.level > 0 && !isMastered;
        let shouldInclude = false;
        if (isNew && filters.new) shouldInclude = true;
        if ((isDue && !isNew) && filters.due) shouldInclude = true;
        if ((isWaiting || isMastered) && filters.learned) shouldInclude = true;
        if (shouldInclude && isDue) {
          _schedule(cardId, st.level, st.level === 0 ? currentNow : st.entry.history[st.level - 1]);
        }
      }
    });

    const forgottenToInsert: FeedRow[] = [];
    globalEventsRef.current.forEach(ev => {
      if (ev.status === 'pending' && ev.scheduledAt <= currentNow) {
        ev.status = 'executed';
        if (ev.type === 'insert') {
          const st = getCardState(ev.cardId, activeNs, extendedRepeatsRef.current, depsMap);
          let initialCategory: CardCategory = 'grow';
          if (ev.level === 0 && st.entry.nOfErrors > 0) initialCategory = 'forgottenPast';
          else if (ev.level === 0) initialCategory = 'new';
          const newRow: FeedRow = { uid: ev.rowUid, cardId: ev.cardId, category: initialCategory, level: ev.level };
          if (initialCategory === 'forgottenPast') forgottenToInsert.push(newRow);
          else materializeRow(newRow);
        }
        else if (ev.type === 'decay') {
          const rowIndex = newFeedList.findIndex(r => r.uid === ev.rowUid);
          if (rowIndex !== -1 && rowIndex >= activeIndexRef.current) {
            newFeedList[rowIndex] = { ...newFeedList[rowIndex], category: 'possiblyForgotten' };
            feedUpdated = true;
          }
        }
      }
    });

    let futureRowsCount = sz - activeIndexRef.current + forgottenToInsert.length;
    const targetAhead = Math.max(PALE_LOOKAHEAD, desiredAheadRef.current - activeIndexRef.current);
    let addedThisTick = 0;
    const batchLimit = options?.catchUp ? CATCHUP_HARD_LIMIT : CATCHUP_BATCH_SIZE;

    while (futureRowsCount < targetAhead && addedThisTick < batchLimit) {
      const futureIds = new Set([ ...newFeedList.slice(activeIndexRef.current, sz).map(r => r.cardId), ...forgottenToInsert.map(r => r.cardId) ]);
      let availablePale = Array.from(trainingPool).filter(id => !futureIds.has(id) && !getCardState(id, activeNs, extendedRepeatsRef.current, depsMap).isLocked && !globalEventsRef.current.some(e => e.cardId === id && e.type === 'insert' && e.status === 'pending'));
      
      if (availablePale.length === 0) availablePale = Array.from(trainingPool).filter(id => !getCardState(id, activeNs, extendedRepeatsRef.current, depsMap).isLocked);
      
      if (availablePale.length > 0) {
        const randomId = availablePale[Math.floor(Math.random() * availablePale.length)];
        materializeRow({ uid: `pale-${randomId}-${Date.now()}-${Math.random()}`, cardId: randomId, category: 'pale', level: -1 });
        futureRowsCount++; addedThisTick++;
      } else break;
    }
    
    forgottenToInsert.forEach(row => materializeRow(row));
    if (feedUpdated) commitFeedList(newFeedList, sz);
    return newFeedList;
  }, [activeNs, depsMap, filters, _schedule, _getAvaible, commitFeedList]);

  const commitRowHistory = useCallback((row: FeedRow, direction: 'remember' | 'forgot' = 'remember') => {
    if (row.category === 'pale' || row.category === 'empty') return;
    if (answeredRowUidsRef.current.has(row.uid)) return;

    const activeId = row.cardId;
    const actionTime = Date.now();
    const prevEntry = extendedRepeatsRef.current[activeId] || { path: activeId, history: [], nOfErrors: 0 };
    let history = [...prevEntry.history];
    let nOfErrors = prevEntry.nOfErrors;

    if (direction === 'forgot') {
      history = []; 
      nOfErrors += 1;
      // Отменяем все предыдущие будущие события
      globalEventsRef.current.forEach(e => {
        if (e.cardId === activeId && e.status === 'pending') e.status = 'cancelled';
      });
      // Генерируем с нуля 8 событий от времени actionTime
      _schedule(activeId, 0, actionTime);
    } else {
      const level = history.length;
      if (level === 0) {
        // Раньше тут был instantMastery, теперь честно идем на level 1 (1 мин)
        history = [actionTime];
      } else if (level < MAX_LEVEL) {
        const win = LEVEL_UP_WINDOWS[level]!;
        if (actionTime >= history[level - 1] + win[0]) {
          history.push(actionTime);
        }
      }
      const currentDecay = globalEventsRef.current.find(e => e.rowUid === row.uid && e.type === 'decay');
      if (currentDecay && currentDecay.status === 'pending') currentDecay.status = 'cancelled';
      // ВАЖНО: Сдвигаем оставшиеся ожидающие события, чтобы они отсчитывались от ТЕКУЩЕГО времени ответа
      const nextLevel = history.length;
      for (let l = nextLevel; l < MAX_LEVEL; l++) {
        const evI = globalEventsRef.current.find(e => e.cardId === activeId && e.level === l && e.type === 'insert' && e.status === 'pending');
        const evD = globalEventsRef.current.find(e => e.cardId === activeId && e.level === l && e.type === 'decay' && e.status === 'pending');
        if (evI) evI.scheduledAt = actionTime + LEVEL_UP_WINDOWS[l][0];
        if (evD) evD.scheduledAt = actionTime + LEVEL_UP_WINDOWS[l][1];
      }
    }
    const nextExtended = { ...extendedRepeatsRef.current, [activeId]: { ...prevEntry, history, nOfErrors } };
    extendedRepeatsRef.current = nextExtended;
    answeredRowUidsRef.current.add(row.uid);
    setTimeout(() => { setRepeats(toRawRepeats(nextExtended)); }, 50);
  }, [setRepeats, _schedule]);

  const trimSuddenlyLockedFuture = useCallback((fromIndex: number) => {
    const list = feedListRef.current;
    const sz = feedSizeRef.current;
    const pastAndCurrent = list.slice(0, fromIndex + 1);
    const materializedFuture = list.slice(fromIndex + 1, sz);
    const tail = list.slice(sz);
    const validFuture = materializedFuture.filter(r => !getCardState(r.cardId, activeNs, extendedRepeatsRef.current, depsMap).isLocked);
    commitFeedList([...pastAndCurrent, ...validFuture, ...tail], pastAndCurrent.length + validFuture.length);
  }, [activeNs, depsMap, commitFeedList]);

  const handleHeightMeasure = useCallback((uid: string, height: number) => {
    if (Math.abs((heightsCacheRef.current[uid] || 0) - height) > 2) {
      heightsCacheRef.current[uid] = height;
    }
  }, []);

  const scrollToIndex = useCallback((index: number) => {
    if (!scrollRef.current) return;
    const scrollEl = scrollRef.current;
    const target = scrollEl.querySelector(`.row-container[data-index="${index}"]`);
    
    if (target) {
      const containerRect = scrollEl.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const offsetToCenter = (targetRect.top - containerRect.top) - (containerRect.height * CAMERA_Y_RATIO) + (targetRect.height / 2);
      scrollEl.scrollBy({ top: offsetToCenter, behavior: 'smooth' });
    } else {
      let topOffset = 0;
      for (let i = 0; i < index; i++) topOffset += (heightsCacheRef.current[feedListRef.current[i]?.uid] || ROW_HEIGHT_ESTIMATE) + CARD_GAP;
      const targetHeight = heightsCacheRef.current[feedListRef.current[index]?.uid] || ROW_HEIGHT_ESTIMATE;
      const scrollToY = topOffset + (scrollEl.clientHeight * 0.5) - (scrollEl.clientHeight * CAMERA_Y_RATIO) + (targetHeight / 2);
      scrollEl.scrollTo({ top: scrollToY, behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    if (!scrollRef.current || !isTraining) return;
    const scrollEl = scrollRef.current;
    let ticking = false;

    const updateFocus = () => {
      const rect = scrollEl.getBoundingClientRect();
      const cameraTargetY = rect.top + rect.height * CAMERA_Y_RATIO;
      const nodes = scrollEl.querySelectorAll('.row-container');
      let closestNode = null as any, minDistance = Infinity, newActiveIndex = activeIndexRef.current;
      
      const measurements = Array.from(nodes).map(node => {
        const nodeRect = node.getBoundingClientRect();
        const nodeCenter = nodeRect.top + nodeRect.height / 2;
        return { node: node as HTMLElement, distanceToCenter: Math.abs(cameraTargetY - nodeCenter), isBelow: nodeCenter > cameraTargetY, index: parseInt(node.getAttribute('data-index') || '0', 10) };
      });

      measurements.forEach(m => {
        if (m.distanceToCenter < minDistance) { minDistance = m.distanceToCenter; closestNode = m.node; newActiveIndex = m.index; }
        let translateY = 0, scale = 1;
        if (m.distanceToCenter > ANIM_START_DIST) { translateY = MAX_Y_OFFSET; scale = 0.9; }
        else if (m.distanceToCenter <= ANIM_START_DIST && m.distanceToCenter > ANIM_STOP_DIST) {
          const ratio = (m.distanceToCenter - ANIM_STOP_DIST) / (ANIM_START_DIST - ANIM_STOP_DIST);
          translateY = MAX_Y_OFFSET * ratio; scale = 1 - (0.1 * ratio);
        }
        m.node.style.transform = `translateY(${translateY * (m.isBelow ? 1 : -1)}px)`;
        const wrapper = m.node.querySelector('.virtual-card-wrapper') as HTMLElement;
        if (wrapper) wrapper.style.transform = `scale(${scale.toFixed(3)})`;
      });

      measurements.forEach(m => {
        const isFocused = (m.node === closestNode) && (m.distanceToCenter <= ANIM_STOP_DIST);
        const wrapper = m.node.querySelector('.virtual-card-wrapper');
        if (wrapper) {
          const nextAttr = String(isFocused);
          if (wrapper.getAttribute('data-selected') !== nextAttr) wrapper.setAttribute('data-selected', nextAttr);
        }
      });

      const currentRange = renderedRangeRef.current;
      const buffer = 15;
      if (newActiveIndex < currentRange.start + buffer || newActiveIndex > currentRange.end - buffer) {
          const newStart = Math.max(0, newActiveIndex - 25);
          const newEnd = Math.min(feedListRef.current.length, newActiveIndex + 35);
          if (newStart !== currentRange.start || newEnd !== currentRange.end) {
              renderedRangeRef.current = { start: newStart, end: newEnd };
              setRenderedRange({ start: newStart, end: newEnd });
          }
      }

      let committedAny = false;
      if (newActiveIndex > activeIndexRef.current) {
        for (let i = activeIndexRef.current; i < newActiveIndex; i++) {
          const skippedRow = feedListRef.current[i];
          if (skippedRow && skippedRow.category !== 'pale' && skippedRow.category !== 'empty' && !answeredRowUidsRef.current.has(skippedRow.uid)) {
            commitRowHistory(skippedRow, 'remember');
            committedAny = true;
          }
        }
      }

      activeIndexRef.current = newActiveIndex;
      if (newActiveIndex !== activeIndexState) setActiveIndexState(newActiveIndex);
      if (committedAny) trimSuddenlyLockedFuture(newActiveIndex);

      const remainingRows = feedSizeRef.current - newActiveIndex - 1;
      if (remainingRows < PALE_LOOKAHEAD) tickEngine({ catchUp: true });
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          bumpDesiredAhead();
          updateFocus();
          ticking = false;
        });
        ticking = true;
      }
    };
    scrollEl.addEventListener('scroll', handleScroll, { passive: true });
    requestAnimationFrame(updateFocus);
    return () => scrollEl.removeEventListener('scroll', handleScroll);
  }, [isTraining, activeIndexState]);

  const handleAction = useCallback((direction: 'remember' | 'forgot', targetIndex = activeIndexRef.current) => {
    if (targetIndex >= feedSizeRef.current) return;
    const row = feedListRef.current[targetIndex];
    answeredRowUidsRef.current.delete(row.uid);
    commitRowHistory(row, direction);

    if (direction === 'forgot') {
      // 1. Быстрая мутация DOM-индикатора для моментального визуального эффекта (без лагов React-стейта)
      const rowNode = scrollRef.current?.querySelector(`.row-container[data-index="${targetIndex}"]`);
      if (rowNode) {
        const indicator = rowNode.querySelector('.indicator-line');
        if (indicator) indicator.setAttribute('data-category', 'forgottenPast');
      }

      // 2. Асинхронное надежное обновление в state
      if (row.category !== 'pale' && row.category !== 'empty' && row.category !== 'forgottenPast') {
        const markedList = [...feedListRef.current];
        markedList[targetIndex] = { ...markedList[targetIndex], category: 'forgottenPast' };
        commitFeedList(markedList, feedSizeRef.current);
      }
    }

    trimSuddenlyLockedFuture(targetIndex);
    forceTick(t => t + 1);
    tickEngine();
    
    if (targetIndex === activeIndexRef.current && targetIndex + 1 < feedSizeRef.current) {
      const nextIndex = targetIndex + 1;
      activeIndexRef.current = nextIndex;
      setActiveIndexState(nextIndex);
      setTimeout(() => scrollToIndex(nextIndex), 50);
    }
  }, [scrollToIndex, trimSuddenlyLockedFuture, tickEngine, commitRowHistory, commitFeedList]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;
      if (!isTraining || feedList.length === 0) return;
      if (e.key === 'ArrowRight' || e.code === 'Space') { e.preventDefault(); handleAction('remember'); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); handleAction('forgot'); }
      if (e.key === 'ArrowUp') { e.preventDefault(); if (activeIndexRef.current > 0) scrollToIndex(activeIndexRef.current - 1); }
      if (e.key === 'ArrowDown') { e.preventDefault(); if (activeIndexRef.current < feedSize - 1) scrollToIndex(activeIndexRef.current + 1); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAction, isTraining, feedSize, feedList.length, scrollToIndex]);

  useEffect(() => {
    if (!isTraining) return;
    const timerId = setInterval(() => {
      if (desiredAheadRef.current > feedSizeRef.current) tickEngine();
    }, CATCHUP_INTERVAL_MS);
    return () => clearInterval(timerId);
  }, [isTraining, tickEngine]);

  useImperativeHandle(ref, () => ({
    updateContentToRepeat: (cardIds: string[]) => {
      setSelectedCards(new Set(cardIds));
      StartTraining(new Set(cardIds));
    }
  }), [StartTraining]);

  if (!isTraining) {
    return (
      <Box css={feedCSS}>
        <Box className="table-screen">
          <Box className="settings-toolbar">
            <Button colorPalette="red" variant="ghost" className='thinButton' onClick={e => {
              const r = e.currentTarget.getBoundingClientRect();
              setClearDialogPos({ top: r.bottom + 5, left: r.left });
              setIsClearDialogOpen(true);
            }}>Clear History</Button>
            <Spacer />
            <Button className='thinButton' colorPalette="blue" onClick={() => StartTraining()}>Start Training</Button>
          </Box>
          <Box className="tree-container">
            <SelectionTree
              activeNs={activeNs}
              extendedRepeatsRef={extendedRepeatsRef}
              depsMap={depsMap}
              selectedCards={selectedCards}
              setSelectedCards={setSelectedCards}
            />
          </Box>
        </Box>
      </Box>
    );
  }

  let paddingTop = 0;
  for (let i = 0; i < renderedRange.start; i++) paddingTop += (heightsCacheRef.current[feedList[i]?.uid] || ROW_HEIGHT_ESTIMATE) + CARD_GAP;
  let paddingBottom = 0;
  for (let i = renderedRange.end; i < feedList.length; i++) paddingBottom += (heightsCacheRef.current[feedList[i]?.uid] || ROW_HEIGHT_ESTIMATE) + CARD_GAP;
  
  const renderList = feedList.slice(renderedRange.start, renderedRange.end);

  return (
    <Box css={feedCSS}>
      <FeedTimeline feedList={feedList} feedSize={feedSize} globalEvents={globalEventsRef.current} activeIndexState={activeIndexState} />

      {/* <DebugLocked 
        activeNs={activeNs} 
        extendedRepeatsRef={extendedRepeatsRef} 
        depsMap={depsMap} 
        selectedCardsRef={selectedCardsRef} 
        feedSizeRef={feedSizeRef} 
        feedCapacity={feedList.length} 
      />
      <DebugEvents 
        globalEventsRef={globalEventsRef} 
        activeNs={activeNs} 
        extendedRepeatsRef={extendedRepeatsRef} 
        depsMap={depsMap} 
        feedSizeRef={feedSizeRef} 
        feedCapacity={feedList.length} 
      /> */}

      <Box ref={scrollRef} className="feed-container">
        {feedSize === 0 && <Spinner />}
        <div 
          className="native-stack" 
          style={{
            paddingTop: `calc(50vh + ${paddingTop}px)`,
            paddingBottom: `calc(50vh + ${paddingBottom}px)`
          }}
        >
          {renderList.map((row, localIdx) => {
            const index = renderedRange.start + localIdx;
            return (
              <FeedRowItem
                key={row.uid}
                row={row}
                index={index}
                visualCategory={getVisualCategory(row, index)}
                content={activeNs[row.cardId]?.content}
                onHeightMeasure={handleHeightMeasure}
                scrollToIndex={scrollToIndex}
              />
            );
          })}
        </div>
      </Box>
    </Box>
  );
});
