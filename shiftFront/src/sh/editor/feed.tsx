/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useImperativeHandle
} from "react";
import { useGraphCtx } from "../../App";
import {
  Box,
  HStack,
  Text,
  Button,
  Spacer,
} from "@chakra-ui/react";
import { Card } from "../card/card";
import { uReq } from "../../appwrite/service";
import { calculateHierarchy } from "../card/utility";

// ==========================================
// НАСТРОЙКИ ГЕОМЕТРИИ И АНИМАЦИИ
// ==========================================
const CAMERA_Y_RATIO = 0.3;  // Позиция "камеры" 
const CARD_GAP = 2;          // Расстояние между карточками (px)
const ANIM_START_DIST = 80;  // Дистанция (px), с которой карта начинает линейно выезжать
const ANIM_STOP_DIST = 60;   // Дистанция (px), где карта останавливается и получает opacity = 1
const MAX_Y_OFFSET = 2;      // Максимальное смещение карты по Y вне зоны активности (px)

const feedCSS = css`
display: flex;
flex: 1;
width: 100%;
height: 100%;
overflow: hidden;
position: relative;

.feed-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 0px;
  scroll-behavior: smooth;
  scrollbar-width: none;
  max-width: 800px;
  margin: 0 auto;
}

.table-screen {
  padding: 0px;
  flex: 1;
  overflow-y: auto;
  scrollbar-width: none;
  padding: 10px 20px;
  max-width: 800px;
  margin: 0 auto;
}

.settings-toolbar {
  display: flex;
  gap: 5px;
  align-items: center;
  padding: 7px 5px;
  margin-bottom: 20px;
  flex-wrap: wrap;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.thinButton {
  height: 20px;
  font-size: 12px;
}

.tree-container {
  padding: 5px;
}

.row-container {
  position: relative;
  display: flex;
  width: 100%;
  will-change: transform;
  align-items: center;
}


.indicator-line {
  margin-left: 20px;
  top: 5px;

  height: 5px;
  width: 5px;

  bottom: 5px;
  border-radius: 4px;
  background-color: transparent;
  transition: background-color 0.3s ease;
  z-index: 20;
}
.indicator-line[data-forgotten="true"] {
  background-color: color-mix(in srgb, red 40%, transparent);
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

.virtual-card-wrapper[data-selected="true"] {
  opacity: 1;
  pointer-events: auto;
  z-index: 10;
}

.native-stack {
  display: flex;
  flex-direction: column;
  gap: ${CARD_GAP}px;
  padding-top: 50vh;
  padding-bottom: 50vh;
}

.card-inner-box {
  border-radius: 0px;        
  padding: 5px 10px;
  background: transparent;   
  width: 100%;
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
}
`;

export const INTERVALS = [
  0,
  3 * 60 * 1000, 
  6 * 60 * 60 * 1000, 
  7 * 24 * 60 * 60 * 1000, 
];

export const extractDeps = (text: string) => {
  const deps = [];
  const regex = /<id=([^>]+)>/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    deps.push(match[1]);
  }
  return deps;
};

export const parseRepeatData = (data: any) => {
  if (!data) return { stages: [], last: 0 };
  if (Array.isArray(data)) return { stages: data, last: data.length > 0 ? data[data.length - 1] : 0 };
  return { stages: data.stages || [], last: data.last || 0 };
};

export const getCardState = (id: string, ns: any, repeats: any) => {
  const data = parseRepeatData(repeats?.[id]);
  const level = Math.min(data.stages.length, INTERVALS.length - 1);
  const nextReview = level === 0 ? 0 : data.stages[data.stages.length - 1] + INTERVALS[level];

  const text = ns?.[id] || "";
  const deps = extractDeps(text);
  let isLocked = false;
  
  for (let depId of deps) {
    const depData = parseRepeatData(repeats?.[depId]);
    const depLevel = Math.min(depData.stages.length, INTERVALS.length - 1);
    if (depLevel === 0) {
      isLocked = true;
      break;
    }
  }

  const now = Date.now();
  const isNew = level === 0;
  const isDue = !isNew && nextReview <= now;
  const isLearned = !isNew && nextReview > now;

  return { level, nextReview, isLocked, isNew, isDue, isLearned, data };
};


export const Feed = React.forwardRef(({}: any, ref: any) => {
  const autoStart = true;
  const graphContext = useGraphCtx() as any;
  const { id, blocks, ns: contextNs, repeats, setRepeats, groups } = graphContext;

  const computedNs = useMemo(() => {
    const dict: Record<string, string> = {};
    const traverse = (nodes: any[]) => {
      if (!Array.isArray(nodes)) return;
      nodes.forEach(b => {
        if (b.id) dict[b.id] = b.metainfo?.content || b.metainfo?.title || '';
        if (b.children) traverse(b.children);
      });
    };
    traverse(blocks);
    return dict;
  }, [blocks]);

  const activeNs = Object.keys(computedNs).length > 0 ? computedNs : (contextNs || {});
  
  const [isTraining, setIsTraining] = useState(autoStart);
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({ new: true, due: true, learned: false });
  const [feedList, setFeedList] = useState<string[]>([]);
  
  // Стейт для отслеживания карточек, которые забыли в ЭТОЙ сессии.
  // Они навсегда получат красную метку до конца тренировки.
  const [forgottenCards, setForgottenCards] = useState<Set<string>>(new Set());

  const activeIndexRef = useRef(0);
  const repeatsRef = useRef(repeats || {});
  const initialRepeatsRef = useRef<any>({}); 
  const scrollRef = useRef<HTMLDivElement>(null);
  const feedListRef = useRef(feedList);
  const loadMoreRef = useRef<any>(null) as any;
  
  useEffect(() => { feedListRef.current = feedList; }, [feedList]);

  useEffect(() => {
    const keys = Object.keys(activeNs);
    if (keys.length > 0 && selectedCards.size === 0) {
      setSelectedCards(new Set(keys));
    }
  }, [activeNs]);

  useEffect(() => {
    const handleStartTraining = (e: any) => {
      const cardIds = e.detail;
      if (cardIds && cardIds.length > 0) {
        setSelectedCards(new Set(cardIds));
        handleStartTrainingAction(new Set(cardIds));
      }
    };
    window.addEventListener('start-feed-training', handleStartTraining);
    return () => window.removeEventListener('start-feed-training', handleStartTraining);
  }, []);

  useEffect(() => { 
    if (!isTraining) {
      repeatsRef.current = repeats || {}; 
      initialRepeatsRef.current = JSON.parse(JSON.stringify(repeats || {}));
    }
  }, [repeats, isTraining]);

  useEffect(() => {
    const syncToAppwrite = () => {
      try { uReq.updateRepeats(id, repeatsRef.current); } 
      catch (e) { console.error("Failed to sync repeats", e); }
    };
    window.addEventListener('beforeunload', syncToAppwrite);
    return () => {
      window.removeEventListener('beforeunload', syncToAppwrite);
      syncToAppwrite();
    };
  }, [id]);

  const getNextCards = useCallback((neededCount: number, currentList: string[], specificSelection?: Set<string>) => {
    const currentRepeats = repeatsRef.current || {};
    const unlocked: string[] = [];
    const activeSelection = specificSelection || selectedCards;
    const allKeys = Object.keys(activeNs);

    allKeys.forEach(cardId => {
      if (activeSelection.size > 0 && !activeSelection.has(cardId)) return;
      const status = getCardState(cardId, activeNs, currentRepeats);
      
      if (status.isLocked) return;
      if (status.isNew && !filters.new) return;
      if (status.isDue && !filters.due) return;
      if (status.isLearned && !filters.learned) return;
      
      unlocked.push(cardId);
    });

    if (unlocked.length === 0) return [];

    unlocked.sort((a, b) => {
      const stA = getCardState(a, activeNs, currentRepeats);
      const stB = getCardState(b, activeNs, currentRepeats);
      if (stA.isDue && !stB.isDue) return -1;
      if (!stA.isDue && stB.isDue) return 1;
      if (stA.isDue && stB.isDue) return stA.level - stB.level;
      return stA.nextReview - stB.nextReview;
    });

    let candidates = unlocked.filter(cId => !currentList.includes(cId));
    const results: string[] = [];
    
    for (let i = 0; i < neededCount; i++) {
      if (candidates.length > 0) {
        const picked = candidates.shift()!;
        results.push(picked);
      } else {
        const randomId = unlocked[Math.floor(Math.random() * unlocked.length)];
        if(randomId) results.push(randomId);
      }
    }
    return results;
  }, [activeNs, selectedCards, filters]);

  const handleStartTrainingAction = useCallback((forceSelected?: Set<string>) => {
    initialRepeatsRef.current = JSON.parse(JSON.stringify(repeatsRef.current));
    setForgottenCards(new Set()); // Сбрасываем метки ошибок
    activeIndexRef.current = 0;
    const initialCards = getNextCards(10, [], forceSelected);
    
    if (initialCards.length > 0) {
      setFeedList(initialCards);
      setIsTraining(true);
    } else {
      setIsTraining(false);
    }
  }, [getNextCards]);

  useEffect(() => {
    if (isTraining && feedList.length === 0 && Object.keys(activeNs).length > 0) {
      const keys = Object.keys(activeNs);
      const sel = selectedCards.size > 0 ? selectedCards : new Set(keys);
      handleStartTrainingAction(sel);
    }
  }, [isTraining, activeNs, selectedCards, feedList.length, handleStartTrainingAction]);

  useEffect(() => {
    loadMoreRef.current = () => {
      const moreCards = getNextCards(10, feedListRef.current);
      if (moreCards.length > 0) {
        setFeedList(prev => [...prev, ...moreCards]);
      }
    };
  }, [getNextCards]);

  const scrollToIndex = useCallback((index: number) => {
    if (!scrollRef.current) return;
    const scrollEl = scrollRef.current;
    
    // Ищем теперь .row-container, так как он является корнем элемента
    const target = scrollEl.querySelector(`.row-container[data-index="${index}"]`);
    
    if (target) {
      const containerRect = scrollEl.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const offsetToCenter = (targetRect.top - containerRect.top) - (containerRect.height * CAMERA_Y_RATIO) + (targetRect.height / 2);
      scrollEl.scrollBy({
        top: offsetToCenter,
        behavior: 'smooth'
      });
    }
  }, []);

  useEffect(() => {
    if (!scrollRef.current || !isTraining) return;
    const scrollEl = scrollRef.current;
    let ticking = false;

    const updateFocus = () => {
      const rect = scrollEl.getBoundingClientRect();
      const cameraTargetY = rect.top + rect.height * CAMERA_Y_RATIO;

      // Получаем ряды, а не внутренние обертки
      const nodes = scrollEl.querySelectorAll('.row-container');
      if (nodes.length === 0) return;

      let closestNode = null as any;
      let minDistance = Infinity;
      let newActiveIndex = activeIndexRef.current;

      const measurements = Array.from(nodes).map(node => {
        const nodeRect = node.getBoundingClientRect();
        const nodeCenter = nodeRect.top + nodeRect.height / 2;
        const distanceToCenter = Math.abs(cameraTargetY - nodeCenter);
        const isBelow = nodeCenter > cameraTargetY;

        return { 
          node: node as HTMLElement, 
          distanceToCenter, 
          isBelow,
          index: parseInt(node.getAttribute('data-index') || '0', 10) 
        };
      });

      measurements.forEach(m => {
        if (m.distanceToCenter < minDistance) {
          minDistance = m.distanceToCenter;
          closestNode = m.node;
          newActiveIndex = m.index;
        }
      });

      measurements.forEach(m => {
        let translateY = 0;
        let scale = 1;

        if (m.distanceToCenter > ANIM_START_DIST) {
          translateY = MAX_Y_OFFSET;
          scale = 0.9;
        } else if (m.distanceToCenter <= ANIM_START_DIST && m.distanceToCenter > ANIM_STOP_DIST) {
          const ratio = (m.distanceToCenter - ANIM_STOP_DIST) / (ANIM_START_DIST - ANIM_STOP_DIST);
          translateY = MAX_Y_OFFSET * ratio;
          scale = 1 - (0.1 * ratio); 
        } else {
          translateY = 0;
          scale = 1;
        }

        const yOffsetMultiplier = m.isBelow ? 1 : -1;
        translateY *= yOffsetMultiplier;

        // ПРИМЕНЯЕМ TRANSLATE К КОНТЕЙНЕРУ (Двигает и карточку, и индикатор)
        m.node.style.transform = `translateY(${translateY}px)`;

        // ПРИМЕНЯЕМ SCALE ТОЛЬКО К КАРТОЧКЕ
        const cardWrapper = m.node.querySelector('.virtual-card-wrapper') as HTMLElement;
        if (cardWrapper) {
          cardWrapper.style.transform = `scale(${scale.toFixed(3)})`;
        }
      });

      // Переключатель data-selected для Opacity
      measurements.forEach(m => {
        const isFocused = (m.node === closestNode) && (m.distanceToCenter <= ANIM_STOP_DIST);
        const cardWrapper = m.node.querySelector('.virtual-card-wrapper');
        if (cardWrapper) {
          const currentAttr = cardWrapper.getAttribute('data-selected');
          if (currentAttr !== String(isFocused)) {
            cardWrapper.setAttribute('data-selected', String(isFocused));
          }
        }
      });

      if (newActiveIndex !== activeIndexRef.current) {
        activeIndexRef.current = newActiveIndex;
        if (newActiveIndex >= feedListRef.current.length - 4) {
          loadMoreRef.current?.();
        }
      }
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          updateFocus();
          ticking = false;
        });
        ticking = true;
      }
    };

    scrollEl.addEventListener('scroll', handleScroll, { passive: true });
    
    requestAnimationFrame(() => {
      updateFocus();
      if (activeIndexRef.current === 0) scrollToIndex(0);
    });
    
    return () => scrollEl.removeEventListener('scroll', handleScroll);
  }, [isTraining, scrollToIndex]);

  const handleAction = useCallback((direction: 'remember' | 'forgot', targetIndex = activeIndexRef.current) => {
    if (targetIndex >= feedListRef.current.length) return;
    const activeId = feedListRef.current[targetIndex];
    const now = Date.now();
    
    // Если забыл — добавляем в красный список навсегда (в рамках текущей тренировки)
    if (direction === 'forgot') {
      setForgottenCards(prev => new Set(prev).add(activeId));
    }

    const nextRepeats = { ...repeatsRef.current };
    const baseData = parseRepeatData(initialRepeatsRef.current[activeId]);
    const stages = [...baseData.stages];

    if (direction === 'remember') {
      if (stages.length === 0) stages.push(now);
      else {
        const requiredInterval = INTERVALS[Math.min(stages.length, INTERVALS.length - 1)];
        const timePassed = now - stages[stages.length - 1];
        if (timePassed >= requiredInterval) stages.push(now);
      }
    } else {
      stages.length = 0;
    }
    
    nextRepeats[activeId] = { stages, last: now };
    repeatsRef.current = nextRepeats; 
    setTimeout(() => { setRepeats(nextRepeats); }, 100);
    
    if (targetIndex === activeIndexRef.current && targetIndex + 1 < feedListRef.current.length) {
      scrollToIndex(targetIndex + 1);
    }
  }, [setRepeats, scrollToIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName) || (e.target as HTMLElement).isContentEditable) return;
      if (!isTraining || feedList.length === 0) return;
      
      if (e.key === 'ArrowRight' || e.code === 'Space') {
        e.preventDefault(); handleAction('remember');
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault(); handleAction('forgot');
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (activeIndexRef.current > 0) scrollToIndex(activeIndexRef.current - 1);
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (activeIndexRef.current < feedList.length - 1) scrollToIndex(activeIndexRef.current + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAction, isTraining, feedList.length, scrollToIndex]);


  const { nodeToGroup, groupToGroup } = useMemo(() => calculateHierarchy(groups || {}), [groups]);

  const getDescendantNodes = useCallback((gId: string) => {
    let res: string[] = [];
    const childGroups = Object.keys(groups || {}).filter(g => groupToGroup[g] === gId);
    const childNodes = (groups[gId]?.nodes || []).filter((n: string) => nodeToGroup[n] === gId);
    res.push(...childNodes);
    childGroups.forEach(cg => res.push(...getDescendantNodes(cg)));
    return res;
  }, [groups, groupToGroup, nodeToGroup]);

  const getGroupStats = useCallback((gId: string) => {
    let newCnt = 0, dueCnt = 0, learnedCnt = 0;
    const nodes = getDescendantNodes(gId);
    nodes.forEach(n => {
      const st = getCardState(n, activeNs, repeatsRef.current);
      if (!st.isLocked) {
        if (st.isNew) newCnt++;
        else if (st.isDue) dueCnt++;
        else if (st.isLearned) learnedCnt++;
      }
    });
    return { newCnt, dueCnt, learnedCnt };
  }, [getDescendantNodes, activeNs]);

  const handleToggleNode = (id: string, checked: boolean) => {
    setSelectedCards(prev => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  };

  const handleToggleGroup = (gId: string, checked: boolean) => {
    const nodes = getDescendantNodes(gId);
    setSelectedCards(prev => {
      const next = new Set(prev);
      nodes.forEach(n => checked ? next.add(n) : next.delete(n));
      return next;
    });
  };

  const renderTreeNode = (id: string, depth: number) => {
    const st = getCardState(id, activeNs, repeatsRef.current);
    if (!st) return null;
    return (
      <HStack key={id} ml={`${depth * 20}px`} fontSize="13px" py="4px">
        <input type="checkbox" checked={selectedCards.has(id)} onChange={e => handleToggleNode(id, e.target.checked)} />
        {/* @ts-expect-error */}
        <Text maxW="300px" noOfLines={1} title={activeNs[id]}>{activeNs[id] || id}</Text>
        <Spacer />
        {st.isLocked && <Text color="gray.500" fontSize="11px" w="120px" textAlign="right">Locked</Text>}
        {!st.isLocked && st.isNew && <Text color="blue.400" fontSize="11px" w="120px" textAlign="right">New</Text>}
        {!st.isLocked && st.isDue && <Text color="red.400" fontSize="11px" w="120px" textAlign="right">Due (Lvl {st.level})</Text>}
        {!st.isLocked && st.isLearned && <Text color="green.400" fontSize="11px" w="120px" textAlign="right">Learned (Lvl {st.level})</Text>}
      </HStack>
    );
  };

  const renderTreeGroup = (gId: string, depth: number) => {
    const childGroups = Object.keys(groups || {}).filter(g => groupToGroup[g] === gId);
    const childNodes = (groups[gId]?.nodes || []).filter((n: string) => nodeToGroup[n] === gId);
    const stats = getGroupStats(gId);
    const descNodes = getDescendantNodes(gId);
    const isChecked = descNodes.length > 0 && descNodes.every(n => selectedCards.has(n));
    const isIndeterminate = !isChecked && descNodes.some(n => selectedCards.has(n));

    return (
      <Box key={gId}>
        <HStack ml={`${depth * 20}px`} fontSize="14px" py="6px" fontWeight="bold" borderBottom="1px solid rgba(255,255,255,0.1)">
          <input type="checkbox" checked={isChecked} ref={el => { if (el) el.indeterminate = isIndeterminate; }} onChange={e => handleToggleGroup(gId, e.target.checked)} />
          <Text color={"white"}>{gId}</Text>
          <Spacer />
          <HStack gap="3" fontSize="11px" fontWeight="normal">
            <Text color="blue.400">New: {stats.newCnt}</Text>
            <Text color="red.400">Due: {stats.dueCnt}</Text>
            <Text color="green.400">Learned: {stats.learnedCnt}</Text>
          </HStack>
        </HStack>
        {childGroups.map(cg => renderTreeGroup(cg, depth + 1))}
        {childNodes.map((cn:any)=>renderTreeNode(cn, depth + 1))}
      </Box>
    );
  };

  const rootGroups = Object.keys(groups || {}).filter(g => !groupToGroup[g]);
  const rootNodes = Object.keys(activeNs).filter(n => !nodeToGroup[n]);

  useImperativeHandle(ref, () => ({
    updateContentToRepeat: (cardIds: string[]) => {
      setSelectedCards(new Set(cardIds));
      handleStartTrainingAction(new Set(cardIds));
    }
  }), [handleStartTrainingAction]);


  if (!isTraining) {
    return (
      <Box css={feedCSS} style={{ flexDirection: 'column' }}>
         <Box className="table-screen">
          <Box pt="20px" pb="10px" h={'70px'}/>
          <Box className="settings-toolbar">
            <label style={{ display: 'flex', gap: '5px', alignItems: 'center', fontSize: '13px' }}>
              <input type="checkbox" checked={filters.new} onChange={e => setFilters({ ...filters, new: e.target.checked })} /> new
            </label>
            <label style={{ display: 'flex', gap: '5px', alignItems: 'center', fontSize: '13px' }}>
              <input type="checkbox" checked={filters.due} onChange={e => setFilters({ ...filters, due: e.target.checked })} /> due
            </label>
            <label style={{ display: 'flex', gap: '5px', alignItems: 'center', fontSize: '13px' }}>
              <input type="checkbox" checked={filters.learned} onChange={e => setFilters({ ...filters, learned: e.target.checked })} /> learned
            </label>
            <Button colorPalette="red" variant="ghost" className='thinButton' onClick={() => {
              if (window.confirm('Очистить всю историю повторений для этого графа?')) {
                setRepeats({}); setFeedList([]);
              }
            }}>Clear History</Button>
            <Spacer />
            <Button className='thinButton' colorPalette="blue" onClick={() => handleStartTrainingAction()}>Start Training</Button>
          </Box>
          <Box className="tree-container">
            {rootGroups.map(gId => renderTreeGroup(gId, 0))}
            {rootNodes.map(nId => renderTreeNode(nId, 0))}
            {rootGroups.length === 0 && rootNodes.length === 0 && (
              <Text fontSize="13px" color="gray.500">Граф пуст или загружается...</Text>
            )}
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box css={feedCSS}>
      <Box ref={scrollRef} className="feed-container" style={{ position: 'relative' }}>
        {feedList.length === 0 && (
          <Box display="flex" justifyContent="center" alignItems="center" h="100%" color="gray.500">
             Загрузка карточек...
          </Box>
        )}

        <div className="native-stack">
          {feedList.map((cardId, index) => {
            const activeLevel = getCardState(cardId, activeNs, initialRepeatsRef.current).level;
            const isInitialFocus = index === activeIndexRef.current;
            const isForgotten = forgottenCards.has(cardId);

            return (
              <Box
                key={`${cardId}-${index}`}
                className="row-container"
                data-index={index}
                onClick={() => {
                  if (index !== activeIndexRef.current) scrollToIndex(index);
                }}
              >
                <div 
                  className="indicator-line"
                  data-forgotten={isForgotten}
                />

                <Box
                  className="virtual-card-wrapper"
                  data-selected={isInitialFocus}
                >
                  <Box className="card-inner-box" position="relative">
                    <Card
                      id={cardId}
                      content={activeNs[cardId]}
                      options={{
                        twoSides: false,
                        open: activeLevel === 0 || isForgotten, 
                        showStats: false,
                        fontSize: 16, 
                      }}
                    />
                  </Box>
                </Box>
              </Box>
            );
          })}
        </div>
      </Box>
    </Box>
  );
});