/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import { Box, HStack, IconButton, Spacer, Text, Textarea } from "@chakra-ui/react";
import { ID } from "appwrite";
import {
	useEffect,
	useRef,
	useState
} from "react";
import ollama from 'ollama/browser';
import { FaHistory } from "react-icons/fa";
import { GoogleGenAI } from '@google/genai';
import { MdClose } from "react-icons/md";
import { LuChevronRight } from "react-icons/lu";
import { createPortal } from "react-dom";
import { Card } from "../card/card";



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
  <Box
    position="absolute"
    top={top} left={left} right={right} bottom={bottom}
    w={w} h={h}
    cursor={cursor}
    onPointerDown={onDown}
    zIndex={100}
  />
);


export function ChatNN({ currentCardId, ns }: { currentCardId?: string | null, ns?: any }) {
  const [prompt, setPrompt] = useState('');
  const [historyText, setHistoryText] = useState('');
  
  const [pastedImages, setPastedImages] = useState<{ url: string, base64: string, file: File, tokens: number }[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  
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

  const handleConvertToCard = () => {
    const { chunkIndex, selectionStart, selectionEnd } = menu;
    const parts = getParsedHistory(historyText);
    const targetText = parts[chunkIndex].content;

    const selectedText = targetText.substring(selectionStart, selectionEnd).trim();
    const words = selectedText.split(/\s+/);
    const front = words.slice(0, 3).join(" ");
    const back = words.slice(3).join(" ");
    
    const cardId = ID.unique();
    const cardStr = `\n\n<card id="${cardId}">\n${front}\n@@@\n${back}\n</card>\n\n`;

    const before = targetText.substring(0, selectionStart);
    const after = targetText.substring(selectionEnd);

    parts[chunkIndex].content = before + cardStr + after;
    setHistoryText(parts.map((p: any) => p.type === 'card' ? p.raw : p.content).join(''));
    setMenu(prev => ({ ...prev, isOpen: false }));
  };

  const handleAttachToGraph = () => {
    setMenu(prev => ({ ...prev, isOpen: false }));
  };

  const outputRef = useRef<HTMLTextAreaElement>(null);

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
        
        if (pastedImages.length + addedCount >= 5) break;
        
        const file = items[i].getAsFile();
        if (!file) continue;
        
        addedCount++;

        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          const estimatedTokens = Math.floor(file.size / 300) + 256; 

          setPastedImages(prev => {
            if (prev.length >= 5) return prev;
            return [...prev, { url: URL.createObjectURL(file), base64, file, tokens: estimatedTokens }];
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
          message.images = pastedImages.map(img => img.base64.split(',')[1]);
        }

        const response = await ollama.chat({ model: model, messages: [message] });
        return response.message.content;
      }
    } else {
      sendCallback = async()=>{
        let contentsToPass: any = finalPrompt;
        if (pastedImages.length > 0) {
          contentsToPass = [
            finalPrompt || "Опиши изображения",
            ...pastedImages.map(img => ({ inlineData: { data: img.base64.split(',')[1], mimeType: img.file.type } }))
          ];
        }

        const response = await genAI.models.generateContent({ model: model, contents: contentsToPass });
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
      console.error("Ошибка:", error);
      setHistoryText(prev => prev + '\n\n[Ошибка]: Не удалось получить ответ.');
    }
    setPrompt("");
    setPastedImages([]);
  };

  useEffect(() => {
    const handleClickOutside = () => setMenu(prev => ({ ...prev, isOpen: false }));
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePointerDownDrag = (e: React.PointerEvent, action: string) => {
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
            x += dx; y += dy; 
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
      <Box w="100%" display="flex" flexDirection="column" mt="4px">
        <HStack alignItems="flex-start" gap={3}>
          <IconButton aria-label="Toggle History" variant="ghost" color={isHistoryOpen ? "blue.400" : "gray.400"} onClick={() => setIsHistoryOpen(!isHistoryOpen)} mt="4px">
            <FaHistory />
          </IconButton>
          <Box display="flex" flexDirection="column" flex={1} gap={2} w="100%" overflow="hidden">
            <input 
              value={prompt} onChange={(e) => setPrompt(e.target.value)} onPaste={handlePaste}
              onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) handleSend(); }}
              placeholder="Ask AI (Ctrl + Enter) - Paste up to 5 images"
              css={css`width: 100%; background: transparent; border: none; outline: none; color: white; font-size: 15px; padding: 8px 0; &::placeholder { color: #6b6b6b; }`}
            />
          </Box>
        </HStack>

        {pastedImages.length > 0 && (
          <HStack w="100%" overflowX="auto" scrollbarWidth="none" gap="12px" pb="4px">
            {pastedImages.map((img, idx) => (
              <Box key={idx} bg="#2a2a2a" border="1px solid #444" borderRadius="10px" p="6px 8px" display="flex" alignItems="center" gap="10px" minW="fit-content" cursor="pointer" _hover={{ bg: '#333' }} onClick={() => setPreviewImage(img.url)}>
                <Box w="36px" h="36px" borderRadius="6px" overflow="hidden" bg="#111" display="flex" justifyContent="center" alignItems="center">
                  <img src={img.url} alt="pasted" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'cover' }} />
                </Box>
                <Box display="flex" flexDirection="column" maxW="120px">
                  {/* @ts-expect-error */}
                  <Text fontSize="12px" color="white" fontWeight="500" noOfLines={1}>{img.file.name || `img_${idx + 1}`}</Text>
                  <Text fontSize="11px" color="gray.400">{img.tokens.toLocaleString()} tkns</Text>
                </Box>
                <IconButton aria-label="Remove" size="xs" variant="ghost" color="gray.400" minW="24px" h="24px" _hover={{ bg: 'rgba(255,255,255,0.1)', color: 'white' }} onClick={(e) => { e.stopPropagation(); removeImage(idx); }}>
                  <MdClose />
                </IconButton>
              </Box>
            ))}
          </HStack>
        )}
        
        <HStack mt={pastedImages.length > 0 ? 2 : 1} gap={4} fontSize="9px" color="gray.400" justifyContent="center">
          <HStack overflowX={'auto'} scrollbarWidth={'none'} w={'100%'}>
            <HStack gap={1} p={'6px 8px'} fontSize={'11px'} fontWeight={600} bgColor={'transparent'} borderRadius={'50px'}>
              <select value={model} color="gray.400" onChange={(e) => setModel(e.target.value)} style={{ background: 'transparent', border: 'none', outline: 'none', cursor: 'pointer' }}>
                <optgroup label="Cloud Models" style={{ background: '#1e1e1e' }}><option value="gemini-3.6-flash">gemini-3.6-flash</option></optgroup>
                <optgroup label="Local Models" style={{ background: '#1e1e1e' }}><option value="qwen2.5vl:7b">qwen2.5vl:7b (Ollama)</option></optgroup>
              </select>
            </HStack>
            <label style={{ display: 'flex', gap: '4px', cursor: 'pointer', alignItems: 'center', minWidth: 'fit-content' }}>
              <input type="checkbox" checked={useContext} onChange={(e) => setUseContext(e.target.checked)} /> course ctx
            </label>
            <label style={{ display: 'flex', gap: '4px', cursor: 'pointer', alignItems: 'center', minWidth: 'fit-content' }}>
              <input type="checkbox" checked={generateCardsMode} onChange={(e) => setGenerateCardsMode(e.target.checked)} /> json out
            </label>
          </HStack>
          <HStack gap={1} p={'6px 12px'} fontSize={'12px'} fontWeight={600} bgColor={'color-mix(in srgb, white, transparent 92%)'} borderRadius={'50px'} cursor="pointer" _hover={{bgColor: 'color-mix(in srgb, white, transparent 85%)'}} onClick={handleSend}>
            run <LuChevronRight/>
          </HStack>
        </HStack>
      </Box>

      {previewImage && createPortal(
        <Box position="fixed" top={0} left={0} right={0} bottom={0} bg="rgba(0,0,0,0.85)" backdropFilter="blur(5px)" zIndex={10000} display="flex" justifyContent="center" alignItems="center" onClick={() => setPreviewImage(null)}>
          <Box position="relative" maxW="90vw" maxH="90vh" onClick={(e) => e.stopPropagation()}>
            <IconButton aria-label="Close Preview" position="absolute" top="-40px" right="-40px" size="sm" variant="ghost" color="white" bg="rgba(255,255,255,0.1)" _hover={{ bg: "rgba(255,255,255,0.2)" }} onClick={() => setPreviewImage(null)}>
              <MdClose size={24} />
            </IconButton>
            <img src={previewImage} alt="Preview" style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }} />
          </Box>
        </Box>, document.body
      )}

      {isHistoryOpen && createPortal(
        <Box position="fixed" top={rect.y} left={rect.x} w={`${rect.w}px`} h={`${rect.h}px`} bg="rgba(30,30,36,0.95)" border="1px solid rgba(255,255,255,0.15)" borderRadius="md" zIndex={9997} boxShadow="dark-lg" backdropFilter="blur(20px)" display="flex" flexDirection="column" opacity={isDraggingCard ? 0 : 1} pointerEvents={isDraggingCard ? 'none' : 'auto'} transition="opacity 0.15s ease-in-out">
          <HStack h="30px" bg="rgba(0,0,0,0.3)" px={3} cursor="grab" onPointerDown={(e) => handlePointerDownDrag(e, 'move')} borderBottom="1px solid rgba(255,255,255,0.1)">
            <Text
							fontSize="12px"
							fontWeight="600"
							color="white"
							pointerEvents="none"
						>AI Note History</Text>
            <Spacer pointerEvents="none" />
            <IconButton aria-label="Close" size="xs" height="20px" minW="20px" variant="ghost" onClick={() => setIsHistoryOpen(false)}>✕</IconButton>
          </HStack>
          <Box position="relative" flex={1} p={2} overflow="hidden" display="flex">
            <Box ref={outputRef} flex={1} p={2} overflowY="auto" display="flex" flexDirection="column" css={css`scrollbar-width: thin; font-family: 'Roboto Mono', monospace; font-size: 13px; line-height: 1.6;`}>
              {getParsedHistory(historyText).map((part: any, idx: number) => {
                if (part.type === 'card') {
                  return (
                    <Box key={idx} draggable onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('application/json', JSON.stringify({ type: 'ai_card', id: part.id, content: part.content })); setTimeout(() => setIsDraggingCard(true), 0); }} onDragEnd={() => { setIsDraggingCard(false); setIsHistoryOpen(false); }} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setMenu({ isOpen: true, x: e.clientX, y: e.clientY, type: 'card', cardId: part.id, cardContent: part.content, chunkIndex: idx, selectionStart: 0, selectionEnd: 0, text: '' }); }} borderLeft="3px solid var(--chakra-colors-blue-500)" bg="rgba(255,255,255,0.05)" my={2} p={2} borderRadius="4px" cursor="grab">
                      <Card
												id={part.id}
												content={part.content}
												options={{twoSides: false, stats: false}}
											/>
                    </Box>
                  );
                } else {
                  return (
                    <Textarea key={idx} id={`history-chunk-${idx}`} value={part.content} onChange={(e) => updateTextChunk(idx, e.target.value)} placeholder={idx === 0 ? "Текст можно свободно редактировать..." : ""} onKeyDown={(e) => { const target = e.target as HTMLTextAreaElement; if (e.key === 'Backspace' && target.selectionStart === 0 && target.selectionEnd === 0) { if (idx >= 2) { e.preventDefault(); const parts = getParsedHistory(historyText); parts.splice(idx - 1, 1); setHistoryText(parts.map((p: any) => p.type === 'card' ? p.raw : p.content).join('')); setTimeout(() => { const prev = document.getElementById(`history-chunk-${idx - 2}`) as HTMLTextAreaElement; if (prev) { prev.focus(); prev.selectionStart = prev.value.length; prev.selectionEnd = prev.value.length; } }, 0); } } if (e.key === 'Delete' && target.selectionStart === target.value.length && target.selectionEnd === target.value.length) { const parts = getParsedHistory(historyText); if (idx < parts.length - 2) { e.preventDefault(); parts.splice(idx + 1, 1); setHistoryText(parts.map((p: any) => p.type === 'card' ? p.raw : p.content).join('')); } } }} onContextMenu={(e) => { const target = e.target as HTMLTextAreaElement; const selStart = target.selectionStart; const selEnd = target.selectionEnd; const selectedText = target.value.substring(selStart, selEnd); if (selectedText.trim()) { e.preventDefault(); setMenu({ isOpen: true, x: e.clientX, y: e.clientY, type: 'text', text: selectedText, chunkIndex: idx, selectionStart: selStart, selectionEnd: selEnd, cardId: '', cardContent: '' }); } else { setMenu(prev => ({ ...prev, isOpen: false })); } }} onInput={(e) => { const target = e.target as HTMLTextAreaElement; target.style.height = 'auto'; target.style.height = target.scrollHeight + 'px'; }} css={css`background: transparent; border: none; outline: none; color: #e2e8f0; resize: none; overflow: hidden; padding: 0; min-height: 30px; &:focus { box-shadow: none; }`} ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }} />
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
        </Box>, document.body
      )}

      {menu.isOpen && createPortal(
        <Box css={contextMenuCSS} style={{ top: menu.y, left: menu.x }} onMouseDown={(e) => e.stopPropagation()}>
          {menu.type === 'text' ? (
            <>
              <Box className="menu-item" onClick={handleConvertToCard}>Преобразовать в карту</Box>
              <Box className="menu-item" onClick={() => { navigator.clipboard.writeText(menu.text); setMenu({ ...menu, isOpen: false }); }}>Копировать</Box>
            </>
          ) : (
            <Box className="menu-item" onClick={handleAttachToGraph}>Прикрепить к графу</Box>
          )}
        </Box>, document.body
      )}
    </>
  );
}