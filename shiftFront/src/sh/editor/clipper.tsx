/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import React, { useState, useEffect } from "react";
import { Box, Button, Input, Spinner } from "@chakra-ui/react";
import { GraphCtx } from "../../App";
import { Card } from "../card/card";
import { LuArrowRightFromLine } from "react-icons/lu";

const clipperCSS = css`
display: flex;
flex-direction: column;
height: 100%;
width: 100%;
overflow: hidden;
max-width: 600px;

.header {
  padding: 10px;
  display: flex;
  gap: 10px;
  align-items: center;
  flex-shrink: 0;
}

.scroll-container {
  flex: 1;
  min-height: 0;
  overflow-y: auto;

  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--chakra-colors-bg-emphasized) 100%, transparent) transparent;

  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0px,
    black 20px,
    black calc(100% - 40px),
    transparent 100%
  );

  mask-image: linear-gradient(
    to bottom,
    transparent 0px,
    black 20px,
    black calc(100% - 40px),
    transparent 100%
  );

  padding-bottom: 40px; 
}

.content-wrapper {
  position: relative;
  min-height: 100%;
}

.content-area {
  display: flex;
  font-family: 'Segoe UI', Tahoma, sans-serif;
  font-size: 16px;
  line-height: 1.6;
  outline: none;
  max-height: 0;
  min-height: 100%;
  flex-direction: column; 
}

.content-area svg, 
.content-area figure, 
.content-area table {
  max-width: 100% !important; 
  height: auto !important;    
  overflow-x: auto;           
}
.content-area figure {
  overflow: hidden;
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
`;

const cardArrayCSS=css`
.card-wrapper {
  --title-weight: 300;
  --title-fs: 11px;

  font-size: var(--title-fs);
}
`

// --- Вспомогательный компонент для управления массивом карт ---
const CardArray = ({ cards, setCards, options }: any) => {
  const updateCardContent = (id: string, currentContent: string, newBlocksToInsert: any[]) => {
    setCards((prev: any[]) => {
      const index = prev.findIndex(c => c.id === id);
      if (index === -1) return prev;

      let newCards = [...prev];
      
      newCards[index] = { ...newCards[index], content: currentContent };

      if (newBlocksToInsert && newBlocksToInsert.length > 0) {
        const parsedBlocks = newBlocksToInsert.map((b: any) => ({
          id: b.id,
          content: b.metainfo.content
        }));
        newCards.splice(index + 1, 0, ...parsedBlocks);
      }

      return newCards.filter(c => c.content.trim() !== "");
    });
  };

  const mockGraphCtx = {
    ns: cards.reduce((acc: any, c: any) => ({ ...acc, [c.id]: c.content }), {}),
    updateCardContent,
  };

  return (
    // @ts-expect-error
    <GraphCtx.Provider value={mockGraphCtx}>
      <Box display="flex" flexDirection="column" gap="15px" w="100%"
        css={cardArrayCSS}
      >
        <Box minH={'50px'}/>
        {cards.map((c: any) => (
          <Box
            className='card-wrapper'
            backgroundColor={'color-mix(in srgb, var(--chakra-colors-bg-emphasized) 40%, transparent)'}
            border={'1px solid color-mix(in srgb, var(--chakra-colors-bg-emphasized) 80%, transparent)'}
            borderRadius={'8px'}
            key={c.id}
          >
            <Card
              id={c.id}
              content={c.content}
              options={options}
            />
          </Box>
        ))}
        <Box minH={'50px'}/>
      </Box>
    </GraphCtx.Provider>
  );
};

export function VisualWebClipper({ onClose, onExport }: any) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState<{ id: string, content: string }[]>([]);

  const [menu, setMenu] = useState<{ visible: boolean, x: number, y: number, range: Range | null }>({
    visible: false, x: 0, y: 0, range: null
  });
  
  useEffect(() => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      return;
    }
    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch("http://localhost:3001/api/parse-page", {
          method: "POST", 
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: trimmedUrl })
        });
        const data = await res.json();
        if (data.blocks) {
          setCards([{ id: `clip_${Date.now()}`, content: data.blocks.join('\n') }]);
        }
      } catch (e) { 
        console.error(e); 
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [url]);

  const handleMouseUp = (e: React.MouseEvent) => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setMenu({ visible: true, x: e.clientX, y: rect.bottom + 10, range: range.cloneRange() });
    } else {
      setMenu(prev => ({ ...prev, visible: false }));
    }
  };

  const insertSplitter = (position: 'before' | 'after' | 'both') => {
    if (!menu.range) return;
    const selection = window.getSelection(); selection?.removeAllRanges();
    
    const createHR = () => { 
      const hr = document.createElement('hr'); 
      hr.className = 'clipper-split'; 
      hr.contentEditable = 'false'; 
      return hr; 
    };

    if (position === 'before' || position === 'both') {
      const rangeStart = menu.range.cloneRange(); rangeStart.collapse(true); rangeStart.insertNode(createHR());
    }
    if (position === 'after' || position === 'both') {
      const rangeEnd = menu.range.cloneRange(); rangeEnd.collapse(false); rangeEnd.insertNode(createHR());
    }
    setMenu({ visible: false, x: 0, y: 0, range: null });
  };

  const handleExport = () => {
    const chunks = cards.map(c => c.content.trim()).filter(c => c.length > 0);
    onExport(chunks);
    onClose();
  };

  return (
    <div css={clipperCSS}>
      <div className="header">
        <Input 
          size="sm"
          h={'24px'}
          borderRadius={'8px'}
          fontSize={'12px'}
          outline={'none'}
          bg={'var(--chakra-colors-bg-emphasized)'}
          border="none"
          placeholder="Вставьте ссылку..." 
          value={url} onChange={(e:any)=>{
            setUrl(e.target.value);
          }}
        />
        <Button variant={'subtle'}
          size="sm" colorScheme={'blue'} onClick={handleExport}
          // @ts-expect-error
          isDisabled={cards.length === 0}
          h={'24px'}
          w={'fit-content'}
          p={0}
        >
          <LuArrowRightFromLine />
        </Button>
      </div>

      <div className="scroll-container">
        <div className="content-wrapper"
          style={{
            display:'flex', height: '100%',
            width: '100%', justifyContent:'center',
            alignItems:'center', flexDirection: 'column',
          }}>
          <div className="content-area" onMouseUp={handleMouseUp}>
            {loading && <Spinner ml={'auto'} mr={'auto'} mt={'auto'} mb={'auto'} />}
            {cards.length > 0 && (
              <CardArray 
                cards={cards} 
                setCards={setCards} 
                options={{ twoSides: true }} 
              />
            )}
          </div>
        </div>
      </div>

      {menu.visible && (
        <div className="selection-menu" style={{ top: menu.y, left: menu.x }}>
          <button onClick={() => {}}>Переписать с ИИ</button>
          <button onClick={() => insertSplitter('before')}>Разделить ДО</button>
          <button onClick={() => insertSplitter('after')}>Разделить ПОСЛЕ</button>
          <button onClick={() => insertSplitter('both')}>Разделить ДО, ПОСЛЕ</button>
        </div>
      )}
    </div>
  );
}