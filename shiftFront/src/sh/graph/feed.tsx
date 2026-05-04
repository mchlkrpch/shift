/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useGraphCtx } from "../../App";
import {
  Box, HStack, Separator, Text, Input, IconButton, Button, Spinner, Kbd, Spacer
} from "@chakra-ui/react";
import { FaMagic } from "react-icons/fa";
import { createPortal } from "react-dom";
import { Card } from "../card/card";
import { uReq } from "../../appwrite/service";
import { calculateHierarchy } from "../card/utility";

const feedCSS = css`
display: flex;
flex: 1;
width: 100%;
height: 100%;
overflow: hidden;

.feed-container {
	flex: 1;
	display: flex;
	flex-direction: column;
	overflow-y: auto;
	padding: 0px;
	scroll-behavior: smooth;
	scrollbar-width: none;
}

.table-screen {
  padding: 0px;
  flex: 1;
  overflow-y: auto;
  scrollbar-width: none;
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

.notepad-container {
	flex: 1;
	display: flex;
	flex-direction: column;
	padding: 20px;
	background-color: color-mix(in srgb, #1a1a24 50%, transparent);
}

.editor-area {
	flex: 1;
	outline: none;
	overflow-y: auto;
	font-family: 'Roboto Mono', monospace;
	font-size: 14px;
	line-height: 1.6;
	white-space: pre-wrap;
	padding: 10px;
	border-radius: 8px;
	background: transparent;
}

.history-card {
	opacity: 0.3;
	transition: opacity 0.3s;
	pointer-events: none;
	position: relative;
	margin-bottom: 16px;
	width: 100%;
}

.history-card:hover {
	opacity: 0.8;
}

.status-dot {
	width: 10px;
	height: 10px;
	border-radius: 50%;
	position: absolute;
	right: 3px;
	top: 50%;
	transform: translateY(-50%);
}

.active-card {
	border-radius: 3px;
	padding: 0px;
	margin-bottom: 24px;
	transition: all 0.3s ease;
	margin: 3px 3px;
	background-color: color-mix(in srgb, black 30%, transparent);
}

.upcoming-card {
	opacity: 0.4;
	transform: scale(0.95);
	pointer-events: none;
	margin-bottom: 16px;
	filter: blur(0.5px);
}
`;

const popupCSS = css`
position: absolute;
z-index: 9999;
background: color-mix(in srgb, #2a2a35 95%, transparent);
border: 1px solid #4a5568;
border-radius: 8px;
padding: 10px;
width: 300px;
box-shadow: 0 10px 25px rgba(0,0,0,0.5);
backdrop-filter: blur(10px);

.ai-response {
	margin-top: 10px;
	padding: 8px;
	background: rgba(0,0,0,0.3);
	border-radius: 4px;
	font-size: 12px;
	color: #a0aec0;
}
`;

export const INTERVALS =[
  0,
  3 * 60 * 1000, // 3min
  6 * 60 * 60 * 1000, // 6h
  7 * 24 * 60 * 60 * 1000, // 1week
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

// Функция парсинга истории для совместимости со старыми массивами
export const parseRepeatData = (data: any) => {
  if (!data) return { stages:[], last: 0 };
  if (Array.isArray(data)) return { stages: data, last: data.length > 0 ? data[data.length - 1] : 0 };
  return { stages: data.stages ||[], last: data.last || 0 };
};

// Экспортируем для Graph (SpDef)
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

export const Feed = React.forwardRef((props: any, ref: any) => {
  const { id, ns, repeats, setRepeats, groups } = useGraphCtx() as any;
  
  // States для экрана настройки и фильтров
  const [isTraining, setIsTraining] = useState(false);
  const [selectedCards, setSelectedCards] = useState<Set<string>>(() => new Set(Object.keys(ns || {})));
  const [filters, setFilters] = useState({ new: true, due: true, learned: false });

  const [history, setHistory] = useState<{ id: string; status: 'remember' | 'forgot' }[]>([]);
  const [queue, setQueue] = useState<string[]>([]);
  const repeatsRef = useRef(repeats || {});
  const historyRef = useRef(history);
  const activeCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => { repeatsRef.current = repeats || {}; }, [repeats]);
  useEffect(() => { historyRef.current = history; },[history]);
  useEffect(() => {
    // Синхронизация новых добавленных нод
    setSelectedCards(prev => {
      const next = new Set(prev);
      Object.keys(ns || {}).forEach(k => next.add(k));
      return next;
    });
  }, [ns]);

  useEffect(() => {
    const syncToAppwrite = () => {
      try {
        const currentRepeats = repeatsRef.current;
        uReq.updateRepeats(id, currentRepeats);
        console.log("Saving repeats to Appwrite:", currentRepeats);
      } catch (e) {
        console.error("Failed to sync repeats", e);
      }
    };
    window.addEventListener('beforeunload', syncToAppwrite);
    return () => {
      window.removeEventListener('beforeunload', syncToAppwrite);
      syncToAppwrite();
    };
  }, [id]);

  const getNextCards = useCallback((neededCount: number, currentQueue: string[], recentHistoryIds: string[]) => {
    const currentRepeats = repeatsRef.current || {};
    const unlocked: string[] =[];

    Object.keys(ns).forEach(cardId => {
      if (!selectedCards.has(cardId)) return;
      const status = getCardState(cardId, ns, currentRepeats);
      
      if (status.isLocked) return;
      if (status.isNew && !filters.new) return;
      if (status.isDue && !filters.due) return;
      if (status.isLearned && !filters.learned) return;
      
      unlocked.push(cardId);
    });

    if (unlocked.length === 0) return[];

    unlocked.sort((a, b) => {
      const stA = getCardState(a, ns, currentRepeats);
      const stB = getCardState(b, ns, currentRepeats);
      if (stA.isDue && !stB.isDue) return -1;
      if (!stA.isDue && stB.isDue) return 1;
      if (stA.isDue && stB.isDue) return stA.level - stB.level;
      return stA.nextReview - stB.nextReview;
    });

    let candidates = unlocked.filter(cId => !currentQueue.includes(cId));
    let preferredCandidates = candidates.filter(cId => !recentHistoryIds.includes(cId));
    
    const results: string[] =[];
    for (let i = 0; i < neededCount; i++) {
      if (preferredCandidates.length > 0) {
        const picked = preferredCandidates.shift()!;
        results.push(picked);
        candidates = candidates.filter(cId => cId !== picked);
      } else if (candidates.length > 0) {
        const picked = candidates.shift()!;
        results.push(picked);
      } else {
        const randomId = unlocked[Math.floor(Math.random() * unlocked.length)];
        results.push(randomId);
      }
    }
    return results;
  },[ns, selectedCards, filters]);

  const handleSwipe = useCallback((direction: 'remember' | 'forgot') => {
    if (queue.length === 0) return;

    const activeId = queue[0];
    const now = Date.now();

    setRepeats((prev: any) => {
      const next = { ...prev };
      const prevData = parseRepeatData(next[activeId]);
      const stages = [...prevData.stages];

      if (direction === 'remember') {
        if (stages.length === 0) {
          stages.push(now);
        } else {
          const requiredInterval = INTERVALS[Math.min(stages.length, INTERVALS.length - 1)];
          const timePassed = now - stages[stages.length - 1];
          // Только если прошло достаточно времени от *старта* уровня - добавляем новый этап
          if (timePassed >= requiredInterval) {
            stages.push(now);
          }
        }
      } else {
        // При забывании сбрасываем прогресс
        stages.length = 0;
      }
      
      // Всегда обновляем поле last, чтобы сбросить кривую забывания без потери тайминга начала уровня
      next[activeId] = { stages, last: now };
      return next;
    });

    setHistory(prev => [...prev, { id: activeId, status: direction }]);
    setQueue(prev => {
      const newQueue = prev.slice(1);
      const nextRecentHistory =[...historyRef.current.map(h => h.id), activeId].slice(-10);
      const nextCards = getNextCards(1, newQueue, nextRecentHistory);
      return [...newQueue, ...nextCards];
    });
  }, [queue, getNextCards, setRepeats]);


  // ==========================================
  // Блокнот ИИ
  // ==========================================
  const editorRef = useRef<HTMLDivElement>(null);
  const[aiPopup, setAiPopup] = useState<{ visible: boolean; x: number; y: number; text: string; range: Range | null } | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const[aiResult, setAiResult] = useState("");

  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && editorRef.current?.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setAiPopup({ visible: true, x: rect.left, y: rect.bottom + window.scrollY, text: selection.toString(), range: range });
      setAiPrompt("");
      setAiResult("");
    } else if (selection?.isCollapsed && !aiPopup?.visible) {
      setAiPopup(null);
    }
  };

  const handleAiSubmit = async () => {
    if (!aiPrompt || !aiPopup) return;
    setIsAiLoading(true);
    setTimeout(() => {
      setAiResult(`[AI-редакция]: "${aiPopup.text}"\n[С учетом]: ${aiPrompt}\nВывод: Отредактированный текст от нейросети.`);
      setIsAiLoading(false);
    }, 1500);
  };

  const acceptAiResult = () => {
    if (!aiPopup?.range || !aiResult) return;
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(aiPopup.range);
    aiPopup.range.deleteContents();
    const textNode = document.createTextNode(aiResult);
    aiPopup.range.insertNode(textNode);
    setAiPopup(null);
    setAiResult("");
    setAiPrompt("");
  };

  // Автоматический выход из режима тренировки если всё пройдено
  useEffect(() => {
    if (isTraining && queue.length === 0) {
      const initialCards = getNextCards(6, [],[]);
      if (initialCards.length === 0) {
        setIsTraining(false);
      } else {
        setQueue(initialCards);
      }
    }
  }, [isTraining, queue.length, getNextCards]);

  useEffect(() => {
    if (activeCardRef.current) {
      activeCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [history.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName) || (e.target as HTMLElement).isContentEditable) return;
      if (!isTraining) return;
      if (e.key === 'ArrowLeft') handleSwipe('remember');
      if (e.key === 'ArrowRight') handleSwipe('forgot');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSwipe, isTraining]);

  const activeLevel = queue.length > 0 ? getCardState(queue[0], ns, repeatsRef.current).level : 0;

  // ==========================================
  // Логика Таблицы и Иерархии Групп
  // ==========================================
  const { nodeToGroup, groupToGroup } = useMemo(() => calculateHierarchy(groups || {}), [groups]);

  const getDescendantNodes = useCallback((gId: string) => {
    let res: string[] =[];
    const childGroups = Object.keys(groups || {}).filter(g => groupToGroup[g] === gId);
    const childNodes = (groups[gId]?.nodes || []).filter((n: string) => nodeToGroup[n] === gId);
    res.push(...childNodes);
    childGroups.forEach(cg => res.push(...getDescendantNodes(cg)));
    return res;
  },[groups, groupToGroup, nodeToGroup]);

  const getGroupStats = useCallback((gId: string) => {
    let newCnt = 0, dueCnt = 0, learnedCnt = 0;
    const nodes = getDescendantNodes(gId);
    nodes.forEach(n => {
      const st = getCardState(n, ns, repeatsRef.current);
      if (!st.isLocked) {
        if (st.isNew) newCnt++;
        else if (st.isDue) dueCnt++;
        else if (st.isLearned) learnedCnt++;
      }
    });
    return { newCnt, dueCnt, learnedCnt };
  }, [getDescendantNodes, ns]);

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
    const st = getCardState(id, ns, repeatsRef.current);
    if (!st) return null;
    return (
      <HStack key={id} ml={`${depth * 20}px`} fontSize="13px" py="4px">
        <input type="checkbox" checked={selectedCards.has(id)} onChange={e => handleToggleNode(id, e.target.checked)} />
        <Text maxW="300px"
					// isTruncated
					>{id}</Text>
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
					{/* ||groups[gId]?.color */}
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
  const rootNodes = Object.keys(ns || {}).filter(n => !nodeToGroup[n]);

  const handleStartTraining = () => {
    setIsTraining(true);
    setQueue([]); // Очередь сгенерируется заново в useEffect с учетом фильтров
  };

  if (!isTraining) {
    return (
      <Box css={feedCSS} style={{ flexDirection: 'column' }}>
        <Box className="table-screen">
          <Box className="settings-toolbar">
            <label style={{ display: 'flex', gap: '5px', alignItems: 'center', fontSize: '13px' }}>
              <input type="checkbox" checked={filters.new} onChange={e => setFilters({ ...filters, new: e.target.checked })} /> 
              new
            </label>
            <label style={{ display: 'flex', gap: '5px', alignItems: 'center', fontSize: '13px' }}>
              <input type="checkbox" checked={filters.due} onChange={e => setFilters({ ...filters, due: e.target.checked })} /> 
              due
            </label>
            <label style={{ display: 'flex', gap: '5px', alignItems: 'center', fontSize: '13px' }}>
              <input type="checkbox" checked={filters.learned} onChange={e => setFilters({ ...filters, learned: e.target.checked })} /> 
              learned
            </label>

            <Button colorPalette="red" variant="ghost"
							className='thinButton'
							onClick={() => {
							if (window.confirm('Очистить всю историю повторений для этого графа?')) {
								setRepeats({});
                setHistory([]);
                setQueue([]);
              }
            }}>Clear History</Button>
            <Spacer />

						<Button
							className='thinButton'
							colorPalette="blue"
							onClick={handleStartTraining}>Start Training</Button>
          </Box>

          <Box className="tree-container">
            {rootGroups.map(gId => renderTreeGroup(gId, 0))}
            {rootNodes.map(nId => renderTreeNode(nId, 0))}
            {rootGroups.length === 0 && rootNodes.length === 0 && (
              <Text fontSize="13px" color="gray.500">Граф пуст</Text>
            )}
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box css={feedCSS}>
      <Box className="feed-container">
        <Box px="10px" pt="10px" pb="20px">
          <Button size="xs" variant="ghost" onClick={() => setIsTraining(false)}>← Назад к настройкам</Button>
        </Box>

        {history.map((h: any, i: number) => (
          <Box key={i} className="history-card">
            <Card id={h.id} content={ns[h.id]} options={{ twoSides: false, showStats: false }} />
            <Box className="status-dot" bg={h.status === 'remember' ? 'green.500' : 'red.500'} />
          </Box>
        ))}

        {queue.length > 0 && (
          <Box className="active-card" ref={activeCardRef} key={`active-wrapper-${queue[0]}`}>
            <HStack w={'100%'} fontSize={'11px'} gap={'2px'} p={'2px 5px'}>
              <Text m={0} opacity={.3} fontWeight={300}>
                {activeLevel === 0 ? "look through the content" : `restore content (${activeLevel})`}
              </Text>
              <Spacer />
              <Box opacity={.3} fontWeight={300} gap={'5px'} display="flex" alignItems="center">
                <Kbd variant="subtle">{`←`}</Kbd> memorized {'\t'}
                not yet <Kbd variant="subtle">{`→`}</Kbd>
              </Box>
            </HStack>
            <Card
              key={queue[0]}
              id={queue[0]}
              content={ns[queue[0]]}
              options={{ twoSides: false, open: activeLevel > 0, showStats: false }}
            />
          </Box>
        )}

        {queue.slice(1).map((id, i) => (
          <Box key={`upcoming-${id}-${i}`} className="upcoming-card">
            <Card id={id} content={ns[id]} options={{ twoSides: false, stats: false }} />
          </Box>
        ))}        
      </Box>

      <Separator orientation="vertical" />
      <Box className="notepad-container">
        <Text fontSize={'12px'} opacity={.3} fontWeight={300}>note</Text>
        <div ref={editorRef} className="editor-area" contentEditable suppressContentEditableWarning onMouseUp={handleMouseUp}></div>
      </Box>

      {aiPopup?.visible && createPortal(
        <Box css={popupCSS} style={{ top: aiPopup.y, left: aiPopup.x }}>
          <Text fontSize="10px" color="gray.400" mb={1}>what we should do?</Text>
          <HStack>
            <Input size="sm" placeholder="Сформулируй короче..." value={aiPrompt} autoFocus onChange={(e) => setAiPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAiSubmit(); if (e.key === 'Escape') setAiPopup(null); }} />
            <IconButton size="sm" aria-label="ask ai" colorPalette="blue" onClick={handleAiSubmit} disabled={isAiLoading}>
              {isAiLoading ? <Spinner size="sm" /> : <FaMagic />}
            </IconButton>
          </HStack>

          {aiResult && (
            <Box className="ai-response">
              <Text>{aiResult}</Text>
              <HStack mt={2} justifyContent="flex-end">
                <Button size="xs" variant="ghost" onClick={() => setAiPopup(null)}>Отмена</Button>
                <Button size="xs" colorPalette="green" onClick={acceptAiResult}>Вставить</Button>
              </HStack>
            </Box>
          )}
        </Box>, document.body)}
    </Box>
  );
});