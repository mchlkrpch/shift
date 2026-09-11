/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import { useState, useRef, useEffect, useCallback } from "react";
import { Box, Button, Input, VStack, HStack, Text, Spinner } from "@chakra-ui/react";
import { MdClose } from "react-icons/md";

const clipperCSS = css`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;
  max-width: 600px;

  .header {
    padding: 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    gap: 10px;
    align-items: center;
    flex-shrink: 0;
  }

  .scroll-container {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .content-wrapper {
    position: relative;
    min-height: 100%;
  }

.content-area {
    padding: 20px 40px;
    color: white;
    font-family: 'Segoe UI', Tahoma, sans-serif;
    font-size: 16px;
    line-height: 1.6;
    outline: none;
    max-height: 0;
  }

  /* --- ДОБАВЛЕНО ДЛЯ ИНФОГРАФИК И ТАБЛИЦ --- */
  .content-area svg, 
  .content-area figure, 
  .content-area table {
    max-width: 100% !important; /* Жестко запрещаем вылезать за края */
    height: auto !important;    /* Сохраняем пропорции */
    overflow-x: auto;           /* Если таблица огромная, появится скролл внутри нее */
  }

  /* Если внутри инфографики есть абсолютно спозиционированный текст, 
     пытаемся скрыть то, что вылезло, чтобы не ломать весь UI */
  .content-area figure {
    overflow: hidden;
  }

  /* ИСПРАВЛЕНИЕ 2: Заставляем картинки вести себя адекватно в потоке текста */
  .content-area img {
    max-width: 100%;
    border-radius: 4px;
    cursor: pointer;
    transition: outline 0.1s;
    display: inline-block; /* Не дает offsetWidth растягиваться на весь экран */
    vertical-align: middle;
    margin: 5px 0;
  }

  hr.clipper-split {
    border: none;
    border-top: 2px solid color-mix(in srgb, white 5%, transparent);
    margin: 30px 0;
    position: relative;
    user-select: none;
  }
  hr.clipper-split::after {
    content: '✂️ Разрыв карточки (Backspace чтобы удалить)';
    position: absolute;
    top: -12px;
    left: 50%;
    transform: translateX(-50%);
    background: #1e1e24;
    color: #e53e3e;
    padding: 0 10px;
    font-size: 12px;
    font-weight: bold;
    border-radius: 10px;
    border: 1px solid #e53e3e;
  }

  .selection-menu {
    position: fixed;
    background: #2a2a35;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 6px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.5);
    display: flex;
    flex-direction: column;
    z-index: 10000;
    padding: 4px;
  }
  .selection-menu button {
    background: transparent;
    color: white;
    border: none;
    padding: 6px 12px;
    font-size: 12px;
    text-align: left;
    cursor: pointer;
    border-radius: 4px;
  }
  .selection-menu button:hover { background: rgba(13, 153, 255, 0.5); }

  .img-overlay {
    position: absolute;
    border: 2px dashed #0d99ff;
    pointer-events: none;
    z-index: 10;
    box-sizing: border-box;
  }
  .resize-handle {
    position: absolute;
    background: #0d99ff;
    border: 2px solid white;
    pointer-events: auto;
  }
  .resize-handle.se {
    width: 14px; height: 14px;
    right: -7px; bottom: -7px;
    border-radius: 50%;
    cursor: nwse-resize;
  }
  .resize-handle.e {
    width: 10px; height: 24px;
    right: -5px; top: 50%; transform: translateY(-50%);
    border-radius: 4px;
    cursor: ew-resize;
  }
`;

export function VisualWebClipper({ onClose, onExport }: any) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [htmlContent, setHtmlContent] = useState<string>("");
  
  const editorRef = useRef<HTMLDivElement>(null);
  const lastHtmlRef = useRef<string>("");

  const [menu, setMenu] = useState<{ visible: boolean, x: number, y: number, range: Range | null }>({
    visible: false, x: 0, y: 0, range: null
  });

  const [activeImg, setActiveImg] = useState<HTMLImageElement | null>(null);
  const [imgRect, setImgRect] = useState({ top: 0, left: 0, width: 0, height: 0 });

  const fetchPage = async () => {
    if (!url) return;
    setLoading(true);
    try {
      const res = await fetch("http://localhost:3001/api/parse-page", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (data.blocks) {
        setHtmlContent(data.blocks.join('\n'));
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => {
    if (editorRef.current && htmlContent && htmlContent !== lastHtmlRef.current) {
      editorRef.current.innerHTML = htmlContent;
      lastHtmlRef.current = htmlContent;
      setActiveImg(null); 

      // ИСПРАВЛЕНИЕ 1: Жесткая очистка атрибутов и ограничение размера
      const images = editorRef.current.querySelectorAll('img');
      images.forEach(img => {
        // Удаляем любые атрибуты и инлайн-стили ширины/высоты, пришедшие с сайта
        img.removeAttribute('width');
        img.removeAttribute('height');
        img.style.removeProperty('width');
        img.style.removeProperty('height');

        const limitImageWidth = () => {
          if (img.naturalWidth > 400) {
            img.style.width = '400px';
          } else if (img.naturalWidth > 0) {
            // Если картинка меньше 400px, фиксируем её реальный размер
            img.style.width = `${img.naturalWidth}px`;
          }
          img.style.height = 'auto';
        };

        if (img.complete && img.naturalWidth) {
          limitImageWidth();
        } else {
          img.addEventListener('load', limitImageWidth, { once: true });
        }
      });
    }
  }, [htmlContent]);

  // ИСПРАВЛЕНИЕ 2: Точный расчет размеров рамки
  const updateImgRect = useCallback(() => {
    if (activeImg) {
      // getBoundingClientRect дает РЕАЛЬНУЮ визуальную ширину/высоту элемента,
      // в отличие от offsetWidth, который может включать невидимые отступы блочного контекста
      const rect = activeImg.getBoundingClientRect();
      setImgRect({
        top: activeImg.offsetTop,
        left: activeImg.offsetLeft,
        width: rect.width,
        height: rect.height,
      });
    }
  }, [activeImg]);

  useEffect(() => {
    updateImgRect();
    window.addEventListener('resize', updateImgRect);
    return () => window.removeEventListener('resize', updateImgRect);
  }, [activeImg, updateImgRect]);

  const handleMouseUp = (e: React.MouseEvent) => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setMenu({
        visible: true,
        x: e.clientX,
        y: rect.bottom + 10,
        range: range.cloneRange()
      });
    } else {
      setMenu(prev => ({ ...prev, visible: false }));
    }
  };

  const insertSplitter = (position: 'before' | 'after' | 'both') => {
    if (!menu.range) return;
    const selection = window.getSelection();
    selection?.removeAllRanges();

    const createHR = () => {
      const hr = document.createElement('hr');
      hr.className = 'clipper-split';
      hr.contentEditable = 'false';
      return hr;
    };

    if (position === 'before' || position === 'both') {
      const rangeStart = menu.range.cloneRange();
      rangeStart.collapse(true);
      rangeStart.insertNode(createHR());
    }
    if (position === 'after' || position === 'both') {
      const rangeEnd = menu.range.cloneRange();
      rangeEnd.collapse(false);
      rangeEnd.insertNode(createHR());
    }
    setMenu({ visible: false, x: 0, y: 0, range: null });
  };

  const handleEditorClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'IMG') {
      setActiveImg(e.target as HTMLImageElement);
    } else {
      setActiveImg(null);
    }
  };

  const handleDragResize = (e: React.PointerEvent, dir: 'e' | 'se') => {
    if (!activeImg) return;
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startW = activeImg.getBoundingClientRect().width; // Берем визуальную ширину

    const onMove = (moveEv: PointerEvent) => {
      const dx = moveEv.clientX - startX;
      activeImg.style.width = `${Math.max(50, startW + dx)}px`; // минимум 50px
      activeImg.style.height = 'auto'; // сохраняем пропорции
      updateImgRect(); // обновляем синюю рамку мгновенно
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleExport = () => {
    if (!editorRef.current) return;
    const finalHtml = editorRef.current.innerHTML;
    
    const chunks = finalHtml
      .split(/<hr[^>]*class="clipper-split"[^>]*>/gi)
      .map(chunk => chunk.trim())
      .filter(chunk => chunk.length > 0);

    onExport(chunks);
    onClose();
  };

  return (
    <div css={clipperCSS}>
      <div className="header">
        <Input 
          size="sm" bg="rgba(0,0,0,0.3)" border="none" color="white"
          placeholder="Вставьте ссылку..." 
          value={url} onChange={e => setUrl(e.target.value)} 
          onKeyDown={e => e.key === 'Enter' && fetchPage()}
        />
        <Button size="sm" colorScheme="blue" onClick={fetchPage} isLoading={loading}>
          Загрузить
        </Button>
        <Button size="sm" colorScheme="green" onClick={handleExport} isDisabled={!htmlContent}>
          Экспорт
        </Button>
        <Button size="sm" variant="ghost" color="white" onClick={onClose}><MdClose /></Button>
      </div>

      <div className="scroll-container">
        <div className="content-wrapper">
          <div 
            ref={editorRef}
            className="content-area"
            contentEditable={true}
            suppressContentEditableWarning={true}
            onMouseUp={handleMouseUp}
            onClick={handleEditorClick}
          />
          
          {/* Рамка и ручки поверх активной картинки */}
          {activeImg && (
            <div className="img-overlay" style={{ top: imgRect.top, left: imgRect.left, width: imgRect.width, height: imgRect.height }}>
              <div className="resize-handle e" onPointerDown={(e) => handleDragResize(e, 'e')} title="Растянуть по ширине" />
              <div className="resize-handle se" onPointerDown={(e) => handleDragResize(e, 'se')} title="Растянуть" />
            </div>
          )}
        </div>
      </div>

      {menu.visible && (
        <div className="selection-menu" style={{ top: menu.y, left: menu.x }}>
          <button onClick={() => insertSplitter('before')}>Разделить ДО выделения</button>
          <button onClick={() => insertSplitter('after')}>Разделить ПОСЛЕ выделения</button>
          <button onClick={() => insertSplitter('both')}>Обернуть в карточку (И до, и после)</button>
        </div>
      )}
    </div>
  );
}