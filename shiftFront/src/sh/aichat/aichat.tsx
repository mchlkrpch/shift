/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import { ID } from "appwrite";
import { useEffect, useRef, useState } from "react";
import ollama from 'ollama/browser';
import { GoogleGenAI } from '@google/genai';
import { MdClose } from "react-icons/md";
import { createPortal } from "react-dom";
import { Card } from "../card/card";
import { REMOTE_GPT_MODEL, RemoteGPTOptGroup, sendToRemoteGPT } from "./remoteGPT";
import { createIcon, HStack, Kbd, Spacer, Spinner, Text, Textarea } from "@chakra-ui/react";
import { useGraphCtx } from "../../App";



export const EnterIcon = createIcon({
  displayName: 'EnterIcon',
  viewBox: '0 0 24 24',
  path: (
    <path
      d="M20 7V8.2C20 9.88016 20 10.7202 19.673 11.362C19.3854 11.9265 18.9265 12.3854 18.362 12.673C17.7202 13 16.8802 13 15.2 13H4M4 13L8 9M4 13L8 17"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  ),
});



const contextMenuCSS = css`
width: 100%;
display: flex;
flex-direction: column;
padding: 5px 0px;
height: 100%;

.menu-item {
  padding: 6px 12px;
  font-size: 12px;
  color: #e2e8f0;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.1s;
}


.context-menu {
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
}

.menu-item:hover {
  background: color-mix(in srgb, var(--chakra-colors-blue-500) 50%, transparent);
}

.promt-field {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  font-size: 12px;
  flex: 1; /* ДОБАВЛЕНО: Растягиваем поле на свободное пространство */
  min-height: 0;
}

.promt-field input {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  color: white;
  font-size: 13px;
  padding: 8px 0;

  &::placeholder {
    color: color-mix(in srgb, white 30%, transparent);
  }
}




.image-carousel {
  width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
  display: flex;
  gap: 12px;
  padding-bottom: 4px;
  flex-shrink: 0;

  &::-webkit-scrollbar {
    display: none;
  }
}
.image-card {
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 10px;
  padding: 6px 8px;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: fit-content;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #333;
  }
}

.image-card .info {
  display: flex;
  flex-direction: column;
  max-width: 120px;
}

.image-card .preview {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  overflow: hidden;
  background: #111;
  display: flex;
  justify-content: center;
  align-items: center;

  img {
    max-width: 100%;
    max-height: 100%;
    object-fit: cover;
  }
}

.image-card .name {
  font-size: 12px;
  color: white;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.image-card .tokens {
  font-size: 11px;
  color: #9ca3af;
}

.image-card .remove {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  min-width: 24px;
  height: 24px;
  color: #9ca3af;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.2s, color 0.2s;
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }
}




.controls {
  display: flex;
  margin-top: 8px;

  margin-top: auto;
  flex-shrink: 0;

  gap: 6px;
  font-size: 9px;
  color: #9ca3af;
  align-items: center;

  width: 100%;
}

.tools-corousel-wrapper {
  position: relative;
  width: 100%;
  padding: 0;
  
}

.controls .tools-corousel-wrapper::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  
  box-shadow: 
    inset -20px 0 4px -4px rgba(18, 18, 22, 1);
  pointer-events: none; 
}

.controls .tools-corousel {
  overflow-x: auto;
  display: flex;
  position: relative;
  scrollbar-width: none;
}

.controls .select {
  background-color: #1e1e1e;
}
.controls optgroup {
  background-color: #1e1e1e;
  // background-color: transparent;
}

.controls .button-frame {
  display: flex;
  padding: 6px 12px;

  font-size: 13px;
  font-weight: 600;

  background-color: color-mix(in srgb, white, transparent 92%);
  border-radius: 8px;
  cursor: pointer;

  transition: background-color 0.2s;
  align-items: center;

  border: none;
  outline: none;
  color: inherit;

  gap: 5px;
  min-width: fit-content;

  &:hover {
    background-color: color-mix(in srgb, white, transparent 85%);
  }
}

[data-run="true"] {
  color: white !important;
  background-color: color-mix(in srgb, #0d99ff 70%, transparent) !important;
  &:hover {
    background-color: color-mix(in srgb, #0d99ff 80%, transparent) !important;
  }
}
`;


const modalOverlayCSS = css`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(5px);
  z-index: 10000;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const modalContentCSS = css`
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
`;

const closeButtonCSS = css`
  position: absolute;
  top: -40px;
  right: -40px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  cursor: pointer;
  padding: 8px;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

const previewImageCSS = css`
  max-width: 100%;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
`;

const historyWindowCSS = css`
  position: fixed;
  background: rgba(30, 30, 36, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  z-index: 9997;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(20px);
  display: flex;
  flex-direction: column;
  transition: opacity 0.15s ease-in-out;
`;

const historyHeaderCSS = css`
  height: 30px;
  background: rgba(0, 0, 0, 0.3);
  padding: 0 12px;
  cursor: grab;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  gap: 8px;
`;

const historyTitleCSS = css`
  font-size: 12px;
  font-weight: 600;
  color: white;
  pointer-events: none;
  flex: 1;
`;

const historyCloseButtonCSS = css`
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  height: 20px;
  min-width: 20px;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 14px;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
`;

const historyContentCSS = css`
  position: relative;
  flex: 1;
  padding: 8px;
  overflow: hidden;
  display: flex;
`;

const historyScrollCSS = css`
  flex: 1;
  padding: 8px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  scrollbar-width: thin;
  font-family: 'Roboto Mono', monospace;
  font-size: 13px;
  line-height: 1.6;
`;

const aiNoteCSS = css`
  background: transparent;
  border: none;
  outline: none;
  color: #e2e8f0;
  resize: none;
  overflow-y: auto;
  padding: 0;
  min-height: 30px;
  width: 100%;
  font-family: 'Roboto Mono', monospace;
  font-size: 13px;
  line-height: 1.6;

  &:focus {
    box-shadow: none;
  }
`;

const cardContainerCSS = css`
  border-left: 3px solid var(--chakra-colors-blue-500);
  background: rgba(255, 255, 255, 0.05);
  margin: 8px 0;
  padding: 8px;
  border-radius: 4px;
  cursor: grab;
`;

const resizeHandleCSS = css`
  position: absolute;
  z-index: 100;
`;

export const ADDITION_FORMAT_PROMT = `
ВАЖНО! напиши ответ, используя только Katex-функции
Не используй в форматировании ответа заголовки ВООБЩЕ! БЕЗ '#'-заголовков
НЕ используй линий "---" в форматировании ответа!
Не используй квадратные скобки в форматировании математических формул.
Используй только **, _, __, $математика вся в одинарных долларах$!

`



const GEMINI_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const genAI = new GoogleGenAI({apiKey: GEMINI_API_KEY});

const getContextForAi = (ns: any) => {
  if (!ns) return "";
  let result = 'ВЫПОЛНИ ВСЕ ИНСТРУКЦИИ СНИЗУ! НЕ ЗАКЛЮЧАЙ ЗАМЕНЫ В ДОЛЛАРЫ ($)\n';

  Object.keys(ns).map((k:any)=>{
    result += `ЗАМЕНИ "${ns[k].split('@@@')[0]}" В СВОЕМ ИТОГОВОМ ОТВЕТЕ НА "<id=${k}:0>"\n`
  })
  result += '\n'
  return result.trim();
};

const ResizeHandle = ({ cursor, top, left, right, bottom, w, h, onDown }: any) => (
  <div
    css={resizeHandleCSS}
    style={{
      cursor,
      top,
      left,
      right,
      bottom,
      width: w,
      height: h,
    }}
    onPointerDown={onDown}
  />
);

export function ChatNN() {
  const [prompt, setPrompt] = useState('');
  const [historyText, setHistoryText] = useState('');

  const {blocks} = useGraphCtx();

  
  const nsDict: Record<string, string> = {};
  const traverseNs = (blocks: any[]) => {
    blocks.forEach(b => {
      nsDict[b.id] = b.metainfo?.content || b.metainfo?.title || '';
      if (b.children) traverseNs(b.children);
    });
  };
  traverseNs(blocks);
  // console.log('ns', nsDict)
  // const graphContext = getContextForAi(nsDict);
  // console.log('graphContext', graphContext)

  const [pastedImages, setPastedImages] = useState<{ url: string, base64: string, file: File, tokens: number }[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [model, setModel] = useState(REMOTE_GPT_MODEL);
  const [useContext, setUseContext] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [generateCardsMode, setGenerateCardsMode] = useState(false);
  const [menu, setMenu] = useState<{ 
    isOpen: boolean, x: number, y: number, text: string,
    type: 'text' | 'card', chunkIndex: number, selectionStart: number, selectionEnd: number,
    cardId: string, cardContent: string
  }>({
    isOpen: false, x: 0, y: 0, text: '',
    type: 'text', chunkIndex: -1, selectionStart: 0, selectionEnd: 0, cardId: '', cardContent: ''
  });

  useEffect(() => {
    if (model === REMOTE_GPT_MODEL) {
      // openRemoteGPTWindow();
    }
  }, []); 

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

  const outputRef = useRef<HTMLTextAreaElement>(null) as any;

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

    if (isLoading) return;
    setIsLoading(true);

    let finalPrompt = prompt;
    if (useContext) {
      const promtGraphContext = getContextForAi(nsDict);
      // const graphContext = JSON.stringify(nsDict)
      if (promtGraphContext) {
        finalPrompt = `\n${promtGraphContext}\n${finalPrompt}`;
      }
    }

    let sendCallback: any = null;
    
    if (model === 'qwen2.5vl:7b') {
      sendCallback = async()=>{
        const message: any = { role: 'user', content: finalPrompt || "Опиши изображения" };
        if (pastedImages.length > 0) {
          message.images = pastedImages.map((img: any) => img.base64.split(',')[1]);
        }

        const response = await ollama.chat({ model: model, messages: [message] });
        return response.message.content;
      }
    } else if (model === REMOTE_GPT_MODEL) {
      sendCallback = async () => {
        return await sendToRemoteGPT(ADDITION_FORMAT_PROMT+finalPrompt);
      }
    } else {
      sendCallback = async()=>{
        let contentsToPass: any = finalPrompt;
        if (pastedImages.length > 0) {
          contentsToPass = [
            finalPrompt || "Опиши изображения",
            ...pastedImages.map((img: any) => ({ inlineData: { data: img.base64.split(',')[1], mimeType: img.file.type } }))
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

      window.dispatchEvent(new CustomEvent('ai-response-received', { 
        detail: { 
          content: newAnswer,
          prompt: finalPrompt 
        } 
      }));
    } catch (error) {
      console.error("Ошибка:", error);
      setHistoryText(prev => prev + '\n\n[Ошибка]: Не удалось получить ответ.');
    } finally {
      setIsLoading(false);
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
      <div css={contextMenuCSS}>
        <div className="promt-field">
          <Textarea
            overflowY={'auto'}
            maxH={'var(--chat-textarea-max-h, 300px)'}
            h={'var(--chat-textarea-height, auto)'}
            flex={1}
            minH={'40px'} // Минимальная высота, чтобы не схлопывалось
            bgColor={'transparent'}
            outline={'none'}
            border={'none'}
            scrollbarWidth={'thin'}
            scrollbarColor={'color-mix(in srgb, white 40%, transparent) transparent'}
            resize={'none'}
            value={prompt}
            fieldSizing={'content'}
            onChange={(e) => setPrompt(e.target.value)} 
            onPaste={handlePaste}
            onKeyDown={(e) => { 
              if (e.key === 'Enter' && e.ctrlKey && !isLoading) handleSend();
            }}
            placeholder={model === REMOTE_GPT_MODEL ? "Press Ctrl+Enter to copy & open ChatGPT" : "Ask AI (Ctrl + Enter)"}
            disabled={isLoading}
          />
        </div>

        {pastedImages.length > 0 && (
          <div className='image-carousel'>
            {pastedImages.map((img, idx) => (
              <div key={idx} className="image-card" onClick={() => setPreviewImage(img.url)}>
                <img className='preview' src={img.url} alt="pasted" />
                <div className='info'>
                  <div className='name'>{img.file.name || `img_${idx + 1}`}</div>
                  <div className='tokens'>{img.tokens.toLocaleString()} tkns</div>
                </div>
                <button className='remove' onClick={(e) => { e.stopPropagation(); removeImage(idx); }} aria-label="Remove">
                  <MdClose />
                </button>
              </div>
            ))}
          </div>
        )}
        
        <div className="controls">
          <HStack
            className='tools-corousel'
          >
            <select className="button-frame select"
              value={model}
              onChange={(e) => {
                const val = e.target.value;
                setModel(val);
              }}
            >
              <optgroup label="Cloud Models">
                <option value="gemini-3.6-flash">gemini-3.6-flash</option>
              </optgroup>
              <optgroup label="Local Models">
                <option value="qwen2.5vl:7b">qwen2.5vl:7b (Ollama)</option>
              </optgroup>
              <RemoteGPTOptGroup />
            </select>

            <label className="button-frame">
              <input type="checkbox" checked={useContext} onChange={(e) => setUseContext(e.target.checked)} /> 
              course ctx
            </label>
            <label className="button-frame">
              <input type="checkbox" checked={generateCardsMode} onChange={(e) => setGenerateCardsMode(e.target.checked)} /> 
              json out
            </label>
          </HStack>

          <Spacer />

          {/* <button className="button-frame" data-run={"true"} onClick={handleSend}>run <LuChevronRight/></button> */}
          <button 
            className="button-frame" 
            data-run={String(!isLoading)} 
            onClick={handleSend}
            disabled={isLoading}
            style={{
              opacity: isLoading ? 0.6 : 1,
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
          >
            {isLoading ? (
              <>
                <Spinner size="sm" color="white" />
                processing...
              </>
            ) : (
              <>
                run
                <Kbd
                  p={'0px 1px'}
                  colorPalette={'blue'}
                  variant={'plain'}
                  opacity={0.5}
                >
                  <Text opacity={0.5}>|</Text>
                  ctrl
                  +
                  <EnterIcon w={'12px'}/>
                </Kbd>
                {/* + */}
              </>
            )}
          </button>
        </div>
      </div>

      {previewImage && createPortal(
        <div css={modalOverlayCSS} onClick={() => setPreviewImage(null)}>
          <div css={modalContentCSS} onClick={(e) => e.stopPropagation()}>
            <button 
              css={closeButtonCSS}
              onClick={() => setPreviewImage(null)}
              aria-label="Close Preview"
            >
              <MdClose size={24} />
            </button>
            <img css={previewImageCSS} src={previewImage} alt="Preview" />
          </div>
        </div>, 
        document.body
      )}

      {isHistoryOpen && createPortal(
        <div 
          css={historyWindowCSS}
          style={{
            top: rect.y,
            left: rect.x,
            width: `${rect.w}px`,
            height: `${rect.h}px`,
            opacity: isDraggingCard ? 0 : 1,
            pointerEvents: isDraggingCard ? 'none' : 'auto',
          }}
        >
          <div css={historyHeaderCSS} onPointerDown={(e) => handlePointerDownDrag(e, 'move')}>
            <div css={historyTitleCSS}>AI Note History</div>
            <button css={historyCloseButtonCSS} onClick={() => setIsHistoryOpen(false)} aria-label="Close">
              ✕
            </button>
          </div>
          <div css={historyContentCSS}>
            <div ref={outputRef} css={historyScrollCSS}>
              {getParsedHistory(historyText).map((part: any, idx: number) => {
                if (part.type === 'card') {
                  return (
                    <div 
                      key={idx} 
                      css={cardContainerCSS}
                      draggable 
                      onDragStart={(e) => { 
                        e.dataTransfer.effectAllowed = 'move'; 
                        e.dataTransfer.setData('application/json', JSON.stringify({ type: 'ai_card', id: part.id, content: part.content })); 
                        setTimeout(() => setIsDraggingCard(true), 0); 
                      }} 
                      onDragEnd={() => { 
                        setIsDraggingCard(false); 
                        setIsHistoryOpen(false); 
                      }} 
                      onContextMenu={(e) => { 
                        e.preventDefault(); 
                        e.stopPropagation(); 
                        setMenu({ 
                          isOpen: true, 
                          x: e.clientX, 
                          y: e.clientY, 
                          type: 'card', 
                          cardId: part.id, 
                          cardContent: part.content, 
                          chunkIndex: idx, 
                          selectionStart: 0, 
                          selectionEnd: 0, 
                          text: '' 
                        }); 
                      }}
                    >
                      <Card
                        id={part.id}
                        content={part.content}
                        options={{twoSides: false, stats: false}}
                      />
                    </div>
                  );
                } else {
                  return (
                    <textarea
                      key={idx}
                      id={`history-chunk-${idx}`}
                      css={aiNoteCSS}
                      value={part.content} 
                      onChange={(e) => updateTextChunk(idx, e.target.value)}
                      placeholder={idx === 0 ? "Текст можно свободно редактировать..." : ""}
                      onKeyDown={(e:any) => {
                        const target = e.target as HTMLTextAreaElement;
                        if (e.key === 'Backspace' && target.selectionStart === 0 && target.selectionEnd === 0) {
                          if (idx >= 2) {
                            e.preventDefault();
                            const parts = getParsedHistory(historyText);
                            parts.splice(idx - 1, 1);
                            setHistoryText(parts.map((p: any) => p.type === 'card' ? p.raw : p.content).join(''));
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
                        if (e.key === 'Delete' && target.selectionStart === target.value.length && target.selectionEnd === target.value.length) {
                          const parts = getParsedHistory(historyText);
                          if (idx < parts.length - 2) {
                            e.preventDefault();
                            parts.splice(idx + 1, 1);
                            setHistoryText(parts.map((p: any) => p.type === 'card' ? p.raw : p.content).join(''));
                          }
                        }
                      }}
                      onContextMenu={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        const selStart = target.selectionStart;
                        const selEnd = target.selectionEnd;
                        const selectedText = target.value.substring(selStart, selEnd);
                        if (selectedText.trim()) {
                          e.preventDefault();
                          setMenu({
                            isOpen: true,
                            x: e.clientX, y: e.clientY,
                            type: 'text', text: selectedText,
                            chunkIndex: idx, selectionStart: selStart,
                            selectionEnd: selEnd, cardId: '', cardContent: ''
                          });
                        } else {
                          setMenu(prev => ({ ...prev, isOpen: false }));
                        }
                      }}
                      onInput={(e:any) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = target.scrollHeight + 'px';
                      }}
                      ref={(el:any) => {
                        if (el) {
                          el.style.height = 'auto';
                          el.style.height = el.scrollHeight + 'px';
                        }
                      }}
                    />
                  );
                }
              })}
            </div>
          </div>

          <ResizeHandle cursor="ew-resize" top={'-10px'} bottom={0} left={'-10px'} w="10px" onDown={(e: any) => handlePointerDownDrag(e, 'w')} />
          <ResizeHandle cursor="ew-resize" top={'-10px'} bottom={0} right={'-10px'} w="10px" onDown={(e: any) => handlePointerDownDrag(e, 'e')} />
          <ResizeHandle cursor="ns-resize" left={0} right={0} top={'-10px'} h="10px" onDown={(e: any) => handlePointerDownDrag(e, 'n')} />
          <ResizeHandle cursor="ns-resize" left={0} right={0} bottom={'-10px'} h="10px" onDown={(e: any) => handlePointerDownDrag(e, 's')} />
          <ResizeHandle cursor="nwse-resize" top={'-10px'} left={'-10px'} w="10px" h="10px" onDown={(e: any) => handlePointerDownDrag(e, 'nw')} />
          <ResizeHandle cursor="nesw-resize" top={'-10px'} right={'-10px'} w="10px" h="10px" onDown={(e: any) => handlePointerDownDrag(e, 'ne')} />
          <ResizeHandle cursor="nesw-resize" bottom={'-10px'} left={'-10px'} w="10px" h="10px" onDown={(e: any) => handlePointerDownDrag(e, 'sw')} />
          <ResizeHandle cursor="nwse-resize" bottom={'-10px'} right={'-10px'} w="10px" h="10px" onDown={(e: any) => handlePointerDownDrag(e, 'se')} />
        </div>, 
        document.body
      )}

      {menu.isOpen && createPortal(
        <div className="context-menu" style={{ top: menu.y, left: menu.x }} onMouseDown={(e) => e.stopPropagation()}>
          {menu.type === 'text' ? (
            <>
              <div className="menu-item" onClick={handleConvertToCard}>Преобразовать в карту</div>
              <div className="menu-item" onClick={() => { navigator.clipboard.writeText(menu.text); setMenu({ ...menu, isOpen: false }); }}>Копировать</div>
            </>
          ) : (
            <div className="menu-item" onClick={handleAttachToGraph}>Прикрепить к графу</div>
          )}
        </div>, 
        document.body
      )}
    </>
  );
}