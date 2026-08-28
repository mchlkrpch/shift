/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import { ID } from "appwrite"; // <--- ДОБАВИТЬ ЭТОТ ИМПОРТ
import React, { useState, useEffect, useRef, useCallback, useMemo, useImperativeHandle } from "react";
import { useGraphCtx } from "../../App";
import {
  Textarea, Box, HStack, Text, IconButton, Button, Spinner, Kbd, Spacer,
  VStack
} from "@chakra-ui/react";
import { FaPaperPlane, FaHistory } from "react-icons/fa";
import { createPortal } from "react-dom";
import { Card } from "../card/card";
import { uReq } from "../../appwrite/service";
import { calculateHierarchy } from "../card/utility";
import ollama from 'ollama/browser';

const useCreateCard = () => {
  return (text: string) => {
    console.log("TODO: Создать карту с текстом:", text);
    alert(`Тут будет создана карта с текстом:\n"${text}"`);
  };
};

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
    max-width: 800px;
    margin: 0 auto; /* Центрируем Feed на весь экран */
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

.history-card {
  opacity: 0.3;
  transition: opacity 0.3s;
  pointer-events: none;
  position: relative;
  margin-bottom: 16px;
  width: 100%;
  gap: 5px;
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

const contextMenuCSS = css`
  position: absolute;
  z-index: 10000;
  background: color-mix(in srgb, #2a2a35 95%, transparent);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  padding: 4px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.5);
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  min-width: 150px;

  .menu-item {
    padding: 6px 12px;
    font-size: 12px;
    color: #e2e8f0;
    cursor: pointer;
    border-radius: 4px;
    transition: background 0.1s;
  }

  .menu-item:hover {
    background: color-mix(in srgb, var(--chakra-colors-blue-500) 50%, transparent);
  }
`;

export const INTERVALS =[
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
  if (!data) return { stages:[], last: 0 };
  if (Array.isArray(data)) return { stages: data, last: data.length > 0 ? data[data.length - 1] : 0 };
  return { stages: data.stages ||[], last: data.last || 0 };
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

import {GoogleGenAI} from '@google/genai';
import { MdClose } from "react-icons/md";
import { LuChevronRight } from "react-icons/lu";
const GEMINI_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

const genAI = new GoogleGenAI({apiKey: GEMINI_API_KEY});

const getContextForAi = (currId: string, ns: any) => {
  if (!currId || !ns) return "";
  const visited = new Set<string>();
  
  const traverse = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    const content = ns[id];
    if (!content) return;
    const matches = [...content.matchAll(/<id=([a-zA-Z0-9_:-]+)>/g)];
    for (const match of matches) {
      traverse(match[1]);
    }
  };
  
  traverse(currId);
  
  let result = "";
  visited.forEach(id => {
    if (ns[id]) {
      result += `[Card ID: ${id}]\n${ns[id]}\n\n`;
    }
  });
  return result.trim();
};

const ResizeHandle = ({ cursor, top, left, right, bottom, w, h, onDown }: any) => (
  <Box position="absolute" top={top} left={left} right={right} bottom={bottom} w={w} h={h} cursor={cursor} onPointerDown={onDown} zIndex={100} />
);

export function ChatNN({ currentCardId, ns }: { currentCardId?: string | null, ns?: any }) {
  const [prompt, setPrompt] = useState('');
  const [historyText, setHistoryText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Изменено на массив для поддержки до 5 изображений
  const [pastedImages, setPastedImages] = useState<{ url: string, base64: string, file: File, tokens: number }[]>([]);
  // Состояние для попапа с просмотром картинки
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  
  // Настройки AI
  const [model, setModel] = useState('qwen2.5vl:7b'); 
  const [useContext, setUseContext] = useState(true);
  const [generateCardsMode, setGenerateCardsMode] = useState(false);

  const [menu, setMenu] = useState<{ 
    isOpen: boolean, x: number, y: number, text: string,
    type: 'text' | 'card', chunkIndex: number, selectionStart: number, selectionEnd: number,
    cardId: string, cardContent: string
  }>({
    isOpen: false, x: 0, y: 0, text: '',
    type: 'text', chunkIndex: -1, selectionStart: 0, selectionEnd: 0, cardId: '', cardContent: ''
  });

  // 2. Добавляем функцию парсинга истории
  const getParsedHistory = (text: string) => {
    const CARD_REGEX = /<card id="([^"]+)">([\s\S]*?)<\/card>/g;
    const parts = [];
    let lastIdx = 0;
    let match;
    while ((match = CARD_REGEX.exec(text)) !== null) {
      if (match.index > lastIdx) {
        parts.push({ type: 'text', content: text.substring(lastIdx, match.index) });
      }
      parts.push({ type: 'card', id: match[1], content: match[2], raw: match[0] });
      lastIdx = CARD_REGEX.lastIndex;
    }
    if (lastIdx < text.length) {
      parts.push({ type: 'text', content: text.substring(lastIdx) });
    }
    return parts.length ? parts : [{ type: 'text', content: text }];
  };

  const updateTextChunk = (index: number, newText: string) => {
    const parts = getParsedHistory(historyText);
    parts[index].content = newText;
    setHistoryText(parts.map((p: any) => p.type === 'card' ? p.raw : p.content).join(''));
  };

  const [isDraggingCard, setIsDraggingCard] = useState(false);

  // Обновите функцию handleConvertToCard:
  const handleConvertToCard = () => {
    const { chunkIndex, selectionStart, selectionEnd } = menu;
    const parts = getParsedHistory(historyText);
    const targetText = parts[chunkIndex].content;

    const selectedText = targetText.substring(selectionStart, selectionEnd).trim();
    const words = selectedText.split(/\s+/);
    const front = words.slice(0, 3).join(" ");
    const back = words.slice(3).join(" ");
    
    // Генерируем уникальный ID через Appwrite (Пунк 3)
    const cardId = ID.unique();

    const cardStr = `\n\n<card id="${cardId}">\n${front}\n@@@\n${back}\n</card>\n\n`;

    const before = targetText.substring(0, selectionStart);
    const after = targetText.substring(selectionEnd);

    parts[chunkIndex].content = before + cardStr + after;
    setHistoryText(parts.map((p: any) => p.type === 'card' ? p.raw : p.content).join(''));
    setMenu(prev => ({ ...prev, isOpen: false }));
  };

  const handleAttachToGraph = () => {
    // TODO: Хук для прикрепления к графу по клику
    console.log("Прикрепить к графу вызвано для карты:", menu.cardId);
    setMenu(prev => ({ ...prev, isOpen: false }));
  };

  const outputRef = useRef<HTMLTextAreaElement>(null);
  const createCard = useCreateCard();

  // Состояние окна истории
  const rectRef = useRef({ 
      x: 100, 
      y: 100, 
      w: window.innerWidth - 200, 
      h: window.innerHeight - 300 
  });
  const [rect, setRectState] = useState(rectRef.current);
  const setRect = (newRect: any) => { rectRef.current = newRect; setRectState(newRect); };

  useEffect(() => {
    if (outputRef.current && isHistoryOpen) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [historyText, isHistoryOpen]);

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    let addedCount = 0;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') === 0) {
        e.preventDefault();
        
        // Ограничение до 5 изображений
        if (pastedImages.length + addedCount >= 5) {
          console.warn("Максимум 5 изображений");
          break;
        }
        
        const file = items[i].getAsFile();
        if (!file) continue;
        
        addedCount++;

        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          const estimatedTokens = Math.floor(file.size / 300) + 256; 

          setPastedImages(prev => {
            if (prev.length >= 5) return prev;
            return [...prev, {
              url: URL.createObjectURL(file),
              base64,
              file,
              tokens: estimatedTokens
            }];
          });
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const removeImage = (index: number) => {
    setPastedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if (!prompt.trim() && pastedImages.length === 0) return;
    
    console.log('m:', model);

    let finalPrompt = prompt;
    if (useContext && currentCardId && ns) {
      const graphContext = getContextForAi(currentCardId, ns);
      if (graphContext) {
        finalPrompt = `[КОНТЕКСТ СВЯЗАННЫХ КАРТ ИЗ ГРАФА]:\n${graphContext}\n\n[ЗАПРОС ПОЛЬЗОВАТЕЛЯ]:\n${finalPrompt}`;
      }
    }

    let sendCallback = null;
    
    if (model === 'qwen2.5vl:7b') {
      sendCallback = async()=>{
        const message: any = { role: 'user', content: finalPrompt || "Опиши изображения" };
        if (pastedImages.length > 0) {
          // Ollama принимает массив base64 строк
          message.images = pastedImages.map(img => img.base64.split(',')[1]);
        }

        const response = await ollama.chat({
          model: model,
          messages: [message]
        });
        return response.message.content;
      }
    } else {
      sendCallback = async()=>{
        // Для Gemini формируем массив контента, если есть картинки
        let contentsToPass: any = finalPrompt;
        if (pastedImages.length > 0) {
          contentsToPass = [
            finalPrompt || "Опиши изображения",
            ...pastedImages.map(img => ({
              inlineData: {
                data: img.base64.split(',')[1],
                mimeType: img.file.type
              }
            }))
          ];
        }

        const response = await genAI.models.generateContent({
          model: model, 
          contents: contentsToPass,
        });
        return response.text || '';
      }
    }
    
    try {
      const newAnswer = await sendCallback();

      setHistoryText(prev => {
        const separator = prev.trim() ? '\n\n' + '—'.repeat(30) + '\n\n' : '';
        const imgIndicator = pastedImages.length > 0 ? ` [+${pastedImages.length} img]` : '';
        return prev + separator + `[Запрос]${imgIndicator}: ${finalPrompt}\n\n` + newAnswer;
      });

    } catch (error) {
      console.error("Ошибка при запросе к модели:", error);
      setHistoryText(prev => prev + '\n\n[Ошибка]: Не удалось получить ответ от нейросети. Проверьте консоль.');
    }
  
    // Очистка после отправки
    setPrompt("");
    setPastedImages([]);
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    const selectedText = target.value.substring(target.selectionStart, target.selectionEnd);

    if (selectedText.trim()) {
      e.preventDefault(); 
      setMenu({
        isOpen: true,
        x: e.clientX,
        y: e.clientY + 5,
        text: selectedText.trim()
      } as any);
    } else {
      setMenu(prev => ({ ...prev, isOpen: false }));
    }
  };

  useEffect(() => {
    const handleClickOutside = () => setMenu(prev => ({ ...prev, isOpen: false }));
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePointerDownDrag = (e: React.PointerEvent, action: string) => {
    // ... остался без изменений (пропущен для краткости, оставьте ваш код драг-н-дропа)
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startRect = { ...rectRef.current };

    const handleMove = (moveEvent: PointerEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        let { x, y, w, h } = startRect;
        
        if (action === 'move') { 
            x += dx; 
            y += dy; 
        } else {
            if (action.includes('e')) w += dx;
            if (action.includes('s')) h += dy;
            if (action.includes('w')) { x += dx; w -= dx; }
            if (action.includes('n')) { y += dy; h -= dy; }
            
            if (w < 300) { if (action.includes('w')) x += (w - 300); w = 300; }
            if (h < 200) { if (action.includes('n')) y += (h - 200); h = 200; }
        }
        setRect({ x, y, w, h });
    };

    const handleUp = () => {
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  return (
    <>
      {createPortal(
        <Box 
          position="fixed" 
          bottom="20px" 
          left="50%" 
          transform="translateX(-50%)" 
          zIndex={9998}
          w="80%" 
          maxW="800px" 
          bg="#1e1f20" 
          borderRadius="14px" 
          p="12px 14px"
          border="1px solid color-mix(in srgb, white, transparent 95%)"
          display="flex"
          flexDirection="column"
          boxShadow="0 8px 32px rgba(0,0,0,0.4)"
        >
          <HStack alignItems="flex-start" gap={3}>
            <IconButton
              aria-label="Toggle History"
              variant="ghost"
              color={isHistoryOpen ? "blue.400" : "gray.400"}
              onClick={() => setIsHistoryOpen(!isHistoryOpen)}
              mt="4px" // Выравнивание по уровню инпута
            >
              <FaHistory />
            </IconButton>

            <Box display="flex" flexDirection="column" flex={1} gap={2} w="100%" overflow="hidden">
              <input 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onPaste={handlePaste}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) handleSend();
                }}
                placeholder="Ask AI (Ctrl + Enter) - Paste up to 5 images"
                css={css`
                  width: 100%;
                  background: transparent;
                  border: none;
                  outline: none;
                  color: white;
                  font-size: 15px;
                  padding: 8px 0;
                  &::placeholder { color: #6b6b6b; }
                `}
              />
            </Box>
          </HStack>

          {pastedImages.length > 0 && (
                <HStack 
                  w="100%" 
                  overflowX="auto" 
                  scrollbarWidth="none" 
                  gap="12px" 
                  pb="4px"
                >
                  {pastedImages.map((img, idx) => (
                    <Box 
                      key={idx}
                      bg="#2a2a2a" 
                      border="1px solid #444" 
                      borderRadius="10px" 
                      p="6px 8px" 
                      display="flex" 
                      alignItems="center" 
                      gap="10px" 
                      minW="fit-content"
                      cursor="pointer"
                      _hover={{ bg: '#333' }}
                      transition="0.2s"
                      onClick={() => setPreviewImage(img.url)}
                    >
                      <Box w="36px" h="36px" borderRadius="6px" overflow="hidden" bg="#111" display="flex" justifyContent="center" alignItems="center">
                        <img src={img.url} alt="pasted" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'cover' }} />
                      </Box>
                      
                      <Box display="flex" flexDirection="column" maxW="120px">
                        {/* @ts-expect-error */}
                        <Text fontSize="12px" color="white" fontWeight="500" noOfLines={1} title={img.file.name}>
                          {img.file.name || `image_${idx + 1}.png`}
                        </Text>
                        <Text fontSize="11px" color="gray.400">
                          {img.tokens.toLocaleString()} tokens
                        </Text>
                      </Box>
                      
                      <IconButton 
                        aria-label="Remove" 
                        size="xs" 
                        variant="ghost" 
                        color="gray.400" 
                        minW="24px" h="24px" 
                        _hover={{ bg: 'rgba(255,255,255,0.1)', color: 'white' }}
                        onClick={(e) => {
                          e.stopPropagation(); // Чтобы не открывался попап
                          removeImage(idx);
                        }}
                      >
                        <MdClose />
                      </IconButton>
                    </Box>
                  ))}
                </HStack>
              )}
          
          <HStack mt={pastedImages.length > 0 ? 2 : 1} gap={4} fontSize="9px" color="gray.400" justifyContent="center">
            <HStack overflowX={'auto'} scrollbarWidth={'none'} w={'100%'}>
              <HStack
                gap={1}
                p={'6px 8px'}
                fontSize={'11px'}
                fontWeight={600}
                bgColor={'color-mix(in srgb, white, transparent 95%)'}
                borderRadius={'50px'}
              >
                <select 
                    value={model} 
                    color="gray.400"
                    onChange={(e) => setModel(e.target.value)} 
                    style={{ background: 'transparent', border: 'none', outline: 'none', cursor: 'pointer' }}
                  >
                    <optgroup label="Cloud Models" style={{ background: '#1e1e1e' }}>
                      <option value="gemini-3.6-flash">gemini-3.6-flash</option>
                    </optgroup>
                    <optgroup label="Local Models" style={{ background: '#1e1e1e' }}>
                      <option value="qwen2.5vl:7b">qwen2.5vl:7b (Ollama)</option>
                    </optgroup>
                  </select>
              </HStack>

              <label style={{ display: 'flex', gap: '4px', cursor: 'pointer', alignItems: 'center', minWidth: 'fit-content' }}>
                <input type="checkbox" checked={useContext} onChange={(e) => setUseContext(e.target.checked)} />
                course ctx
              </label>

              <label style={{ display: 'flex', gap: '4px', cursor: 'pointer', alignItems: 'center', minWidth: 'fit-content' }}>
                <input type="checkbox" checked={generateCardsMode} onChange={(e) => setGenerateCardsMode(e.target.checked)} />
                json output
              </label>
            </HStack>
            
            <HStack
              gap={1}
              p={'6px 12px'}
              fontSize={'12px'}
              fontWeight={600}
              bgColor={'color-mix(in srgb, white, transparent 92%)'}
              borderRadius={'50px'}
              cursor="pointer"
              _hover={{bgColor: 'color-mix(in srgb, white, transparent 85%)'}}
              onClick={handleSend}
            >
              run <LuChevronRight/>
            </HStack>
          </HStack>
        </Box>, 
        document.body
      )}

      {/* Попап для просмотра прикрепленного изображения */}
      {previewImage && createPortal(
        <Box 
          position="fixed" 
          top={0} left={0} right={0} bottom={0} 
          bg="rgba(0,0,0,0.85)" 
          backdropFilter="blur(5px)"
          zIndex={10000} 
          display="flex" 
          justifyContent="center" 
          alignItems="center"
          onClick={() => setPreviewImage(null)}
        >
          <Box position="relative" maxW="90vw" maxH="90vh" onClick={(e) => e.stopPropagation()}>
            <IconButton 
              aria-label="Close Preview" 
              position="absolute" 
              top="-40px" 
              right="-40px" 
              size="sm"
              variant="ghost"
              color="white"
              bg="rgba(255,255,255,0.1)"
              _hover={{ bg: "rgba(255,255,255,0.2)" }}
              onClick={() => setPreviewImage(null)}
            >
              <MdClose size={24} />
            </IconButton>
            <img 
              src={previewImage} 
              alt="Preview" 
              style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }} 
            />
          </Box>
        </Box>,
        document.body
      )}

      {isHistoryOpen && createPortal(
        <Box 
          position="fixed" 
          top={rect.y} 
          left={rect.x} 
          w={`${rect.w}px`} 
          h={`${rect.h}px`} 
          bg="rgba(30,30,36,0.95)" 
          border="1px solid rgba(255,255,255,0.15)" 
          borderRadius="md" 
          zIndex={9997} 
          boxShadow="dark-lg" 
          backdropFilter="blur(20px)"
          display="flex" 
          flexDirection="column"
          // --- ДОБАВЛЕННЫЕ СТИЛИ ДЛЯ DRAG & DROP (Пункт 1) ---
          opacity={isDraggingCard ? 0 : 1}
          pointerEvents={isDraggingCard ? 'none' : 'auto'}
          transition="opacity 0.15s ease-in-out"
          // ---------------------------------------------------
        >
          <HStack 
            h="30px" 
            bg="rgba(0,0,0,0.3)" 
            px={3} 
            cursor="grab" 
            onPointerDown={(e) => handlePointerDownDrag(e, 'move')} 
            borderBottom="1px solid rgba(255,255,255,0.1)"
          >
            <Text fontSize="12px" fontWeight="600" color="white" pointerEvents="none">
              AI Note History
            </Text>
            <Spacer pointerEvents="none" />
            <IconButton aria-label="Close" size="xs" height="20px" minW="20px" variant="ghost" onClick={() => setIsHistoryOpen(false)}>
               ✕
            </IconButton>
          </HStack>

          <Box position="relative" flex={1} p={2} overflow="hidden" display="flex">
            <Box 
  ref={outputRef} 
  flex={1} 
  p={2} 
  overflowY="auto" 
  display="flex" 
  flexDirection="column"
  css={css`
    scrollbar-width: thin;
    font-family: 'Roboto Mono', monospace;
    font-size: 13px;
    line-height: 1.6;
  `}
>
  {getParsedHistory(historyText).map((part: any, idx: number) => {
    if (part.type === 'card') {
      return (
        <Box
          key={idx}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('application/json', JSON.stringify({
              type: 'ai_card',
              id: part.id,
              content: part.content
            }));
            // Прячем окно асинхронно, чтобы браузер успел отрисовать ghost-image карты
            setTimeout(() => setIsDraggingCard(true), 0);
          }}
          onDragEnd={() => {
            // При отпускании мыши, выключаем невидимость окна и закрываем его
            setIsDraggingCard(false);
            setIsHistoryOpen(false);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenu({
              isOpen: true, x: e.clientX, y: e.clientY,
              type: 'card', cardId: part.id, cardContent: part.content,
              chunkIndex: idx, selectionStart: 0, selectionEnd: 0, text: ''
            });
          }}
          borderLeft="3px solid var(--chakra-colors-blue-500)"
          bg="rgba(255,255,255,0.05)"
          my={2}
          p={2}
          borderRadius="4px"
          cursor="grab"
        >
          <Card id={part.id} content={part.content} options={{twoSides: false, stats: false}} />
        </Box>
      );
    } else {
      return (
        <Textarea
          key={idx}
          id={`history-chunk-${idx}`} // <-- Добавляем ID для фокуса
          value={part.content}
          onChange={(e) => updateTextChunk(idx, e.target.value)}
          placeholder={idx === 0 ? "Здесь появится история ваших запросов. Текст можно свободно редактировать..." : ""}
          
          // --- ДОБАВЛЯЕМ ОБРАБОТКУ КЛАВИШ УДАЛЕНИЯ (Пункт 2) ---
          onKeyDown={(e) => {
            const target = e.target as HTMLTextAreaElement;
            // Стирание карты сверху (Backspace)
            if (e.key === 'Backspace' && target.selectionStart === 0 && target.selectionEnd === 0) {
              if (idx >= 2) { // 2 означает, что над нами есть карта (idx 1) и еще текст (idx 0)
                e.preventDefault();
                const parts = getParsedHistory(historyText);
                parts.splice(idx - 1, 1);
                setHistoryText(parts.map((p: any) => p.type === 'card' ? p.raw : p.content).join(''));
                
                // Возвращаем фокус на предыдущий текстовый блок
                setTimeout(() => {
                  const prev = document.getElementById(`history-chunk-${idx - 2}`) as HTMLTextAreaElement;
                  if (prev) {
                    prev.focus();
                    prev.selectionStart = prev.value.length;
                    prev.selectionEnd = prev.value.length;
                  }
                }, 0);
              }
            }
            // Стирание карты снизу (Delete)
            if (e.key === 'Delete' && target.selectionStart === target.value.length && target.selectionEnd === target.value.length) {
              const parts = getParsedHistory(historyText);
              if (idx < parts.length - 2) {
                e.preventDefault();
                parts.splice(idx + 1, 1);
                setHistoryText(parts.map((p: any) => p.type === 'card' ? p.raw : p.content).join(''));
              }
            }
          }}
          // -----------------------------------------------------

          onContextMenu={(e) => {
// ... остальной код Textarea
            const target = e.target as HTMLTextAreaElement;
            const selStart = target.selectionStart;
            const selEnd = target.selectionEnd;
            const selectedText = target.value.substring(selStart, selEnd);
            
            if (selectedText.trim()) {
              e.preventDefault();
              setMenu({
                isOpen: true, x: e.clientX, y: e.clientY,
                type: 'text', text: selectedText, chunkIndex: idx,
                selectionStart: selStart, selectionEnd: selEnd,
                cardId: '', cardContent: ''
              });
            } else {
              setMenu(prev => ({ ...prev, isOpen: false }));
            }
          }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = target.scrollHeight + 'px';
          }}
          css={css`
            background: transparent;
            border: none;
            outline: none;
            color: #e2e8f0;
            resize: none;
            overflow: hidden;
            padding: 0;
            min-height: 30px;
            &:focus { box-shadow: none; }
          `}
          ref={(el) => {
            if (el) {
              el.style.height = 'auto';
              el.style.height = el.scrollHeight + 'px';
            }
          }}
        />
      );
    }
  })}
</Box>
          </Box>

          <ResizeHandle cursor="ew-resize" top={'-10px'} bottom={0} left={'-10px'} w="10px" onDown={(e: any) => handlePointerDownDrag(e, 'w')} />
          <ResizeHandle cursor="ew-resize" top={'-10px'} bottom={0} right={'-10px'} w="10px" onDown={(e: any) => handlePointerDownDrag(e, 'e')} />
          <ResizeHandle cursor="ns-resize" left={0} right={0} top={'-10px'} h="10px" onDown={(e: any) => handlePointerDownDrag(e, 'n')} />
          <ResizeHandle cursor="ns-resize" left={0} right={0} bottom={'-10px'} h="10px" onDown={(e: any) => handlePointerDownDrag(e, 's')} />
          <ResizeHandle cursor="nwse-resize" top={'-10px'} left={'-10px'} w="10px" h="10px" onDown={(e: any) => handlePointerDownDrag(e, 'nw')} />
          <ResizeHandle cursor="nesw-resize" top={'-10px'} right={'-10px'} w="10px" h="10px" onDown={(e: any) => handlePointerDownDrag(e, 'ne')} />
          <ResizeHandle cursor="nesw-resize" bottom={'-10px'} left={'-10px'} w="10px" h="10px" onDown={(e: any) => handlePointerDownDrag(e, 'sw')} />
          <ResizeHandle cursor="nwse-resize" bottom={'-10px'} right={'-10px'} w="10px" h="10px" onDown={(e: any) => handlePointerDownDrag(e, 'se')} />
        </Box>,
        document.body
      )}

      {menu.isOpen && createPortal(
  <Box 
    css={contextMenuCSS} 
    style={{ top: menu.y, left: menu.x }}
    onMouseDown={(e) => e.stopPropagation()} 
  >
    {menu.type === 'text' ? (
      <>
        <Box className="menu-item" onClick={handleConvertToCard}>
          Преобразовать в карту
        </Box>
        <Box className="menu-item" onClick={() => {
          navigator.clipboard.writeText(menu.text);
          setMenu({ ...menu, isOpen: false });
        }}>
          Копировать
        </Box>
      </>
    ) : (
      <>
        <Box className="menu-item" onClick={handleAttachToGraph}>
          Прикрепить к графу
        </Box>
      </>
    )}
  </Box>, document.body
)}
    </>
  );
}

export const Feed = React.forwardRef(({initialSelection, autoStart, _setMode, onActiveCardChange}: any, ref: any) => {
  const { id, ns, repeats, setRepeats, groups } = useGraphCtx() as any;
  
  const [isTraining, setIsTraining] = useState(autoStart || false);
  const[selectedCards, setSelectedCards] = useState<Set<string>>(() => {
    if (initialSelection && initialSelection.length > 0) {
      return new Set(initialSelection);
    }
    return new Set(Object.keys(ns || {}));
  });

  const [filters, setFilters] = useState({ new: true, due: true, learned: false });
  const [history, setHistory] = useState<{ id: string; status: 'remember' | 'forgot' }[]>([]);
  const [queue, setQueue] = useState<string[]>(initialSelection || []);
  const repeatsRef = useRef(repeats || {});
  const historyRef = useRef(history);
  const activeCardRef = useRef<HTMLDivElement>(null);

  // console.log('initialSelection',initialSelection)

  useEffect(() => {
    if (onActiveCardChange) {
      onActiveCardChange(queue.length > 0 ? queue[0] : null);
    }
  }, [queue, onActiveCardChange]);

  useEffect(() => { repeatsRef.current = repeats || {}; }, [repeats]);
  useEffect(() => { historyRef.current = history; },[history]);
  useEffect(() => {
    if(!initialSelection) {
      setSelectedCards(prev => {
        const next = new Set(prev);
        Object.keys(ns || {}).forEach(k => next.add(k));
        return next;
      });
    }
  }, [ns, initialSelection]);

  useEffect(() => {
    const syncToAppwrite = () => {
      try {
        const currentRepeats = repeatsRef.current;
        uReq.updateRepeats(id, currentRepeats);
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

    // Быстрое локальное обновление для мгновенной реакции UI без полного ререндера графа
    const nextRepeats = { ...repeatsRef.current };
    const prevData = parseRepeatData(nextRepeats[activeId]);
    const stages = [...prevData.stages];

    if (direction === 'remember') {
      if (stages.length === 0) {
        stages.push(now);
      } else {
        const requiredInterval = INTERVALS[Math.min(stages.length, INTERVALS.length - 1)];
        const timePassed = now - stages[stages.length - 1];
        if (timePassed >= requiredInterval) {
          stages.push(now);
        }
      }
    } else {
      stages.length = 0;
    }
    
    nextRepeats[activeId] = { stages, last: now };
    repeatsRef.current = nextRepeats; // Мгновенный синхронный апдейт локального рефа

    // Откладываем тяжелый глобальный апдейт setRepeats в Event Loop
    setTimeout(() => {
        setRepeats(nextRepeats);
    }, 10);

    setHistory(prev => [...prev, { id: activeId, status: direction }]);
    setQueue(prev => {
      const newQueue = prev.slice(1);
      // ОПТИМИЗАЦИЯ СКОРОСТИ: Запрашиваем новые карты, только если очередь иссякает
      if (newQueue.length >= 3) return newQueue;

      const nextRecentHistory =[...historyRef.current.map(h => h.id), activeId].slice(-10);
      const nextCards = getNextCards(4, newQueue, nextRecentHistory);
      return [...newQueue, ...nextCards];
    });
  }, [queue, getNextCards, setRepeats]);


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
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName) || (e.target as HTMLElement).isContentEditable) return;
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
        <Text maxW="300px">{id}</Text>
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
  const rootNodes = Object.keys(ns || {}).filter(n => !nodeToGroup[n]);

  const handleStartTraining = () => {
    setIsTraining(true);
    setQueue([]); 
  };

  // console.log('queue', queue)

  useImperativeHandle(ref, () => ({
    updateContentToRepeat: (cardIds: string[]) => {
      console.log("Feed: Updating content to repeat", cardIds);
      setSelectedCards(new Set(cardIds));
      setQueue(cardIds);
      setIsTraining(true);
      setHistory([]);
    }
  }), []);

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
        <Box pt="20px" pb="10px"/>

        {/* ОПТИМИЗАЦИЯ: Ограничиваем рендер 20 картами истории */}
        {history.slice(-20).map((h: any, i: number) => (
          <Box key={`${h.id}-${i}`} className="history-card">
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
              options={{
                twoSides:false,
                open:activeLevel===0,
                showStats:false,
                fontSize:18,
              }}
            />
          </Box>
        )}

        {queue.slice(1, 4).map((id, i) => (
          <Box key={`upcoming-${id}-${i}`} className="upcoming-card">
            <Card id={id} content={ns[id]} options={{ twoSides: false, stats: false }} />
          </Box>
        ))}
        <Box minH="120px" />
      </Box>
    </Box>
  );
});