/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import React, {
	useRef,
	useState,
	useEffect,
	useMemo,
	useCallback,
	forwardRef,
	useImperativeHandle,
	memo,
	useLayoutEffect
} from 'react';
import { 
  Box, 
  Menu,
	Portal,
	Spacer,
	Spinner
} from "@chakra-ui/react";
import {
	LuBook,
	LuBookDashed,
	LuChevronDown,
	LuChevronRight,
	LuChevronUp,
	LuFileCode,
	LuSend,
} from "react-icons/lu";
// import { MdClose } from "react-icons/md";
import { Card, CardCtx } from "../../card/card";
import { GraphCtx, useGraphCtx } from "../../../App";
import { ContextMenu } from "../contextMenu";
import { REMOTE_GPT_MODEL, sendToRemoteGPT } from "../../aichat/aichat";
import { genId, getBlockInfoFromNode, useKeyDown } from "./unifiedHooks";
import { convertBlocksToUnifiedFormat, createOffsetWalker, extractContent, useDragDrop, type DomBlock } from "./unifiedUtils";
import { SuggestionAIChat } from "./suggestion";

export const editorCSS = css`
position: relative;
width: 100%;
height: 100%;
min-height: var(--tv-min-height);
outline: none;
font-family: 'Roboto Mono', monospace;
line-height: 1.6;
white-space: pre-wrap;
overflow-y: auto;
scrollbar-width: thin;
padding: 0;

display: flex;
flex-direction: column;
gap: 3px;

.ctrl-buttons-overlay {
  position: absolute;
    display: none;
  align-items: center;
  gap: 4px;
  z-index: 100;
    width: 100%;
  pointer-events: auto;
  padding: 2px;
}

&.ctrl-active .tv-block-wrapper[data-focused="true"] .ctrl-buttons-overlay {
  display: flex;
}

.ctrl-button {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 3px;
  background: color-mix(in srgb, var(--chakra-colors-bg-inverted) 8%, var(--chakra-colors-bg));
  transition: all 0.15s;
  font-size: 12px;
}

.ctrl-button:hover {
  background: color-mix(in srgb, var(--chakra-colors-blue-500) 20%, transparent);
  color: var(--chakra-colors-blue-500);
}

.tv-block-wrapper {
	display: block;
	position: relative;
	width: 100%;
}

.block-gutter {
  position: absolute;
  left: -40px;
  top: 0;          /* Изменили с 4px на 0 */
  bottom: 0;       /* Растянули на весь блок */
  width: 30px;
  text-align: right;
  font-size: 11px;
  color: color-mix(in srgb, var(--chakra-colors-gray-500) 60%, transparent);
  user-select: none;
  pointer-events: none;
  font-family: 'Roboto Mono', monospace;
  transition: color 0.1s ease;
}

// .tv-block-wrapper[data-focused="true"] > .block-gutter {
//   color: var(--chakra-colors-blue-400);
// }
.tv-block-wrapper[data-focused="true"] > .block-gutter {
  /* Подсветка контролируется построчно в коде */
}

.tv-group {
	padding: 2px 0px;
	font-weight: 500;
	width: fit-content;
	max-width: 100%;
}

.tv-group-toggle {
    cursor: pointer;
    user-select: none;
    color: var(--chakra-colors-gray-500);
    display: flex;
    align-items: center;
    justify-content: center;
}
.tv-group-toggle:hover {
    color: #0d99ff;
}

.tv-block {
    width: 100%;
    min-width: 0;
    padding: 3px;
    font-weight: 400;
    border-radius: 6px;
    outline: none;
    gap: 0;
}

.tv-group-badge {
    width: fit-content;
    border-radius: 4px;
    padding: 2px 4px;
    height: 100%;
    background-color: color-mix(in srgb, var(--chakra-colors-bg-inverted) 5%, transparent);
}

.tv-group-badge[contenteditable="true"]:hover {
    background-color: color-mix(in srgb, var(--chakra-colors-bg-inverted) 10%, transparent);
}

.tv-block-wrapper[data-is-last-in-group="true"] {
  margin-bottom: 6px;
}

.inlineCell {
  display: inline-block;
  width: fit-content;
  height: fit-content;
  padding: 0px 2px;
  border-radius: 4px;
  color: var(--chakra-colors-blue-500);
  user-select: all;
}

.tv-block[data-placeholder]:empty::before {
  content: attr(data-placeholder);
  opacity: 0.35;
  pointer-events: none;
}

.tv-ai-chat-card {
	margin-right: 8px;
	margin-bottom: 8px;
	border-radius: 8px;
	padding: 0px;
	display: flex;
	flex-direction: column;
	gap: 2px;
	z-index: 10;
}


.tv-ai-chat-card .tv-block-wrapper {
	border: none;
}

.tv-ai-chat-card .tv-block:hover {}

.tv-ai-chat-card .tv-block {
	box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
	background-color: color-mix(in srgb, var(--chakra-colors-bg-inverted) 20%, var(--chakra-colors-bg)) !import;
}

.tv-ai-chat-card .item {
	box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
	background-color: color-mix(in srgb, var(--chakra-colors-bg-inverted) 12%, var(--chakra-colors-bg));
	height:25px;
	width: fit-content;
	min-width: 25px;
	border-radius: 20px;
	padding: 0;
}
`;

export const addCSS=css`
[data-part="content"] {
  width: 150px;
  min-width: 150px !important;
}

[data-part="item"] {
  font-size: 11px;
  padding: 2px;
  width: 100%;
  padding-left: 6px;
}
`;

const nestedTreeOverflowFixCSS = css`
  overflow: visible !important;
`;


export const menuCSS = css`
z-index: 99;
backdrop-filter: blur(20px);
background-color: var(--chakra-colors-bg);
border: 1.5px solid color-mix(in srgb, var(--chakra-colors-bg-inverted) 10%, var(--chakra-colors-bg));
border-radius: 5px;
box-shadow: 0 2px 10px var(--chakra-colors-bg);
display: flex;

gap: 5px;
padding: 3px !important;

font-weight: 400;
scrollbar-width: thin;
scrollbar-color: color-mix(in srgb, var(--chakra-colors-bg-inverted) 10%, var(--chakra-colors-bg)) transparent;

.menuFrame{
	z-index: 99;
}

.menuFrame .tip {font-size: 11px; opacity: 0.3; font-weight: 400; }
.item { width: 100%; font-size: 11px; display: flex; align-items: center; gap: 4px; padding: 2px; border-radius: 5px; transition: background 0.1s ease; }
`;



// Добавьте этот компонент поверх UnifiedTreeView
// Предполагается, что снаружи по сети приходят курсоры в таком формате:
// { userId: '1', name: 'Ivan', color: '#ff0000', blockId: 'blk-123', offset: 5 }

export const CollaboratorCursors = memo(({ editorRef, cursors }: { editorRef: any, cursors: any[] }) => {
	const [positions, setPositions] = useState<any[]>([]);

	useLayoutEffect(() => {
		const editor = editorRef.current;
		if (!editor || !cursors || cursors.length === 0) {
			setPositions([]);
			return;
		}

		const updatePositions = () => {
			const editorRect = editor.getBoundingClientRect();
			const newPositions = cursors.map(cursor => {
				const blockWrapper = editor.querySelector(`[data-id="${cursor.blockId}"]`);
				if (!blockWrapper) return null;

				const textContainer = blockWrapper.querySelector('.tv-block, .tv-group');
				if (!textContainer) return null;

				try {
					// createOffsetWalker у вас уже определен в файле
					const walker = createOffsetWalker(textContainer);
					const { node, offset } = walker.findOffset(cursor.offset);

					if (!node) return null;

					const range = document.createRange();
					range.setStart(node, offset);
					range.collapse(true);
					const rect = range.getBoundingClientRect();

					// Координаты относительно контейнера редактора
					return {
						...cursor,
						top: rect.top - editorRect.top + editor.scrollTop,
						left: rect.left - editorRect.left + editor.scrollLeft,
						height: rect.height > 0 ? rect.height : 16 // Фолбэк высоты каретки
					};
				} catch (e) {
					return null;
				}
			}).filter(Boolean);

			setPositions(newPositions);
		};

		// Обновляем при маунте и изменениях
		updatePositions();

		// Следим за скроллом и ресайзом для моментальной перерисовки курсоров
		const observer = new ResizeObserver(updatePositions);
		observer.observe(editor);
		editor.addEventListener('scroll', updatePositions, { passive: true });
		// Опционально: таймер для подстраховки при быстрых изменениях DOM
		const interval = setInterval(updatePositions, 200);

		return () => {
			observer.disconnect();
			editor.removeEventListener('scroll', updatePositions);
			clearInterval(interval);
		};
	}, [cursors, editorRef]);

	return (
		<div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 10 }}>
			{positions.map(p => (
				<div key={p.userId} style={{
					position: 'absolute', top: p.top, left: p.left,
					height: p.height, width: '2px', backgroundColor: p.color,
					transition: 'all 0.1s linear' // Плавное движение
				}}>
					<div style={{
						position: 'absolute', top: '-14px', left: 0,
						backgroundColor: p.color, color: 'white', fontSize: '10px',
						padding: '0 4px', borderRadius: '4px', whiteSpace: 'nowrap'
					}}>
						{p.name}
					</div>
				</div>
			))}
		</div>
	);
});


const TvBlock = React.memo(({
  block,
  index,
  isHidden,
  isCollapsed,
  isLastInGroup,
  isUnderSuggestion,
  depthPadding,
	readOnly,
  toggleGroup,
  formatEditText,
  fontSize,
  onCtrlButtonClick,
  rootPath,
}: any) => {
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const [isLoading, _setIsLoading] = useState(false);
	const closeMenuTimeoutRef = useRef<any>(null);
	const [model, setModel] = useState(REMOTE_GPT_MODEL);
	const [useContext, setUseContext] = useState(false);

	const lineCount = useMemo(() => {
    if (!block.text) return 1;
    return block.text.split('\n').length;
  }, [block.text]);

	const handleMenuEnter = () => {
    if (closeMenuTimeoutRef.current) clearTimeout(closeMenuTimeoutRef.current);
    setIsMenuOpen(true);
  };

  const handleMenuLeave = () => {
    closeMenuTimeoutRef.current = setTimeout(() => {
      setIsMenuOpen(false);
    }, 150);
  };

  if (block.isSpinner) {
    return (
			<div 
				className="tv-block-wrapper" 
				data-index={index} 
				data-id={block.id} 
				data-parent-id={block.parentId || ""} 
				data-is-spinner="true" 
				data-role={block.role}
				style={{
					display: isHidden ? 'none' : 'flex',
					fontSize: `${fontSize}px`,
					position: 'relative',
					zIndex: isUnderSuggestion ? 2 : 1,
					boxShadow: isUnderSuggestion ? '0 -24px 24px 8px var(--chakra-colors-bg)' : 'none',
					borderRadius: '8px',
				}}
			>
				<div className="tv-block" contentEditable={false} style={{
					paddingLeft: `${depthPadding + 6}px`,
					backgroundColor: 'color-mix(in srgb, var(--chakra-colors-bg-inverted) 5%, var(--chakra-colors-bg))',
					// borderLeft: 'none', 
					display: 'flex', alignItems: 'center', minHeight: '28px',
					margin: '0', borderRadius: '6px'
				}}>
					<Spinner size="xs" color="gray.400" />
					<span style={{ opacity: 0.5, fontSize: '11px', marginLeft: '8px' }}>Думаю...</span>
				</div>
			</div>
    );
  }

  const blockBg = block.isGroup ? 'transparent' : 'color-mix(in srgb, var(--chakra-colors-bg-inverted) 5%, var(--chakra-colors-bg))';
  const blockMargin = '0';

  return (
    <div
      className="tv-block-wrapper"
      data-index={index}
      data-id={block.id}
      data-is-group={block.isGroup ? "true" : undefined}
      data-parent-id={block.parentId || ""}
      data-raw-text={block.text}
      data-hidden={isHidden ? "true" : undefined}
			data-line-count={lineCount}
      data-rendered={block.isRendered ? "true" : undefined}
      data-is-last-in-group={isLastInGroup ? "true" : undefined}
      data-role={block.role} 
      style={{
				display: isHidden ? 'none' : 'flex', fontSize: `${fontSize}px`,
				position: 'relative', // 👇 НОВЫЕ СТИЛИ
				zIndex: isUnderSuggestion ? 2 : 1,
				boxShadow: isUnderSuggestion ? '0 -24px 24px 8px color-mix(in srgb, var(--chakra-colors-bg) 50%, transparent)' : 'none',
				borderRadius: '8px',
			}}
    >
			<div className="block-gutter" contentEditable={false} />

      <div
        className="ctrl-buttons-overlay"
        contentEditable={false}
        style={{ bottom: '0', transform: 'translateY(-50%)' }}
        onPointerDown={(e) => e.preventDefault()}
      >
        <div
          className="ctrl-button"
          style={{ marginLeft: `${depthPadding}px` }}
          onClick={() => onCtrlButtonClick?.('up', block)}
          title="Move up"
        >
					<Menu.Root
						open={isMenuOpen} 
						onOpenChange={(e) => setIsMenuOpen(e.open)}
						positioning={{ placement: "top-start" }}
					>
						<Menu.Trigger asChild>
							<button 
								className="button-frame add-button"
								disabled={isLoading}
								onMouseEnter={handleMenuEnter}
								onMouseLeave={handleMenuLeave}
								onClick={(e) => e.preventDefault()}
								style={{
									borderRadius:'10px',
									height: '20px',
									width: '20px',
									display: 'flex',
									justifyContent: 'center',
									alignItems: 'center',
									outline: 'none',
									marginTop: '5px',
								}}
							>
								{isMenuOpen? <LuChevronDown />:<LuChevronUp/>}
							</button>
						</Menu.Trigger>
						<Portal>
							<Menu.Positioner style={{ zIndex: 10000 }}
								css={addCSS}
							>
								<Menu.Content
									onMouseEnter={handleMenuEnter}
									onMouseLeave={handleMenuLeave}
									style={{
										border: '1px solid var(--chakra-colors-bg-emphasized)',
										borderRadius: '6px',
										padding: '4px',
										boxShadow: '0 6px 10px color-mix(in srgb, var(-chakra-colors-bg-inverted) 20%, transparent)',
										backdropFilter: 'blur(10px)',
										minWidth: '220px',
										outline: 'none',
										fontSize: '12px',
									}}
								>                  
									<Menu.Item 
										value="gemini-3.6-flash" 
										onClick={() => { setModel("gemini-3.6-flash"); setIsMenuOpen(false); }}
										className="menu-item"
										style={{ display: 'flex', alignItems: 'center' }}
									>
										<Box w={'10px'}>
											{model === "gemini-3.6-flash" && "✓"}
										</Box>
										gemini-3.6-flash
									</Menu.Item>

									<Menu.Item 
										value="qwen2.5vl:7b" 
										onClick={() => { setModel("qwen2.5vl:7b"); setIsMenuOpen(false); }}
										className="menu-item"
										style={{ display: 'flex', alignItems: 'center' }}
									>
										<Box w={'10px'}>
											{model === "qwen2.5vl:7b" && "✓"}
										</Box>
										qwen2.5vl:7b
									</Menu.Item>

									<Menu.Item 
										value={REMOTE_GPT_MODEL} 
										onClick={() => { setModel(REMOTE_GPT_MODEL); setIsMenuOpen(false); }}
										className="menu-item"
										style={{ display: 'flex', alignItems: 'center' }}
									>
										<Box w={'10px'}>
											{model === REMOTE_GPT_MODEL && "✓  "}
										</Box>
										ChatGPT
									</Menu.Item>

									<div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />

									<Menu.Item 
										value="use-context"
										onClick={(e) => {
											e.preventDefault();
											setUseContext(!useContext);
										}}
										className="menu-item"
										style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
									>
										{useContext ? <LuBook color="var(--chakra-colors-blue-400)" /> : <LuBookDashed />}
										<span style={{ color: useContext ? 'var(--chakra-colors-blue-400)' : 'inherit' }}>
											Контекст
										</span>
									</Menu.Item>
								</Menu.Content>
							</Menu.Positioner>
						</Portal>
					</Menu.Root>
        </div>
        <Spacer/>
        <div className="ctrl-button" onClick={() => onCtrlButtonClick?.('send', block)} title="Send to AI">
          <LuSend />
        </div>
        <div className="ctrl-button" onClick={() => onCtrlButtonClick?.('parse', block)} title="Parse content">
          <LuFileCode />
        </div>
      </div>

			{block.isGroup && !block.isRendered && (
				<div 
					contentEditable={false} 
					className="tv-group-toggle"
					style={{ marginLeft: `${depthPadding + 8}px` }}
					onPointerDown={(e) => { 
						e.preventDefault(); 
						// Alt+клик — рекурсивно свернуть/развернуть все вложенные группы
						toggleGroup(block.id, e.altKey); 
					}}
					title="Клик — свернуть группу. Alt+клик — свернуть рекурсивно вместе с вложенными группами"
				>
					{isCollapsed ? <LuChevronRight /> : <LuChevronDown />}
				</div>
			)}

      {block.isRendered ? (
        <div 
          className={block.isGroup ? 'tv-group' : 'tv-block'} 
          style={{
            paddingLeft: `${depthPadding + 6}px`,
            backgroundColor: 'transparent',
            margin: blockMargin,
			'--title-weight': block.isGroup? '500' : 'none',
			'--title-fs': block.isGroup? `${fontSize+3}px` : `${fontSize}px`,
          } as any}
        >
          <Card
            id={block.id}
            content={block.text}
            options={{
              twoSides: false,
              open: true,
              stats: false,
              padding: '0px',
              fontSize: `${fontSize}px`,
              rootPath: rootPath,
              readonly: true,
            }}
            focus={false}
          />
        </div>
      ) : (
        <div 
          className={`${block.isGroup ? 'tv-group tv-group-badge' : 'tv-block'}`}
          style={{
            paddingLeft: `${depthPadding + 6}px`,
            backgroundColor: blockBg,
						border: !block.isGroup? '1px solid color-mix(in srgb, var(--chakra-colors-bg-inverted) 6.5%, var(--chakra-colors-bg))': '',
            margin: blockMargin,
          }}
          contentEditable={!readOnly}
          suppressContentEditableWarning={true}
          dangerouslySetInnerHTML={{ __html: formatEditText(block.text) }}
        />
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.block.text === nextProps.block.text &&
    prevProps.block.isRendered === nextProps.block.isRendered &&
    prevProps.block.isGroup === nextProps.block.isGroup &&
    prevProps.block.parentId === nextProps.block.parentId &&
    prevProps.index === nextProps.index &&
    prevProps.isHidden === nextProps.isHidden &&
    prevProps.isCollapsed === nextProps.isCollapsed &&
    prevProps.isLastInGroup === nextProps.isLastInGroup &&
		prevProps.isUnderSuggestion === nextProps.isUnderSuggestion &&
    prevProps.depthPadding === nextProps.depthPadding &&
    prevProps.fontSize === nextProps.fontSize
  );
});







const extractDOMContent = (node: Node): string => {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement;
    if (el.tagName === 'IMG') {
        return `<img src="${el.getAttribute('src')}" style="${el.getAttribute('style')}" />`;
    }
    if (el.classList.contains('inlineQuiz')) {
			const input = el.querySelector('input');
			const type = el.getAttribute('data-type') || 'exact';
			const answer = input ? input.value : el.getAttribute('data-answer');
			return `<quiz=${type}:${answer}>`;
		}
    if (el.classList.contains('inlineCell') || el.classList.contains('card_inline_link')) {
        const parts = el.id.split(':');
        return parts.length === 2 ? `<id=${parts[0]}:${parts[1]}>` : `<id=${el.id}>`;
    }
    if (el.tagName === 'BR') return '\n';
    let inner = Array.from(el.childNodes).map(extractDOMContent).join('');
    if (el.tagName === 'DIV' || el.tagName === 'P') return '\n' + inner;
    return inner;
  }
  return '';
};









export const UnifiedTreeView = forwardRef(({
	initialContent, initialBlocks, fontSize=10,
	onSave, onChange, onGenerateAI,
	bottomPadding="50vh",
	readOnly,
	mainTree,
}: any, ref) => {
  const gCtx = useGraphCtx() as any;
  const { ns: baseNs } = gCtx || { ns: {} };
	
  const parentCardCtx = React.useContext(CardCtx);
  const cardCtx = useMemo(() => {
    if (parentCardCtx) return parentCardCtx;
    return {
      path: [], setPath: () => [],
      c: '', setC: () => {}
    };
  }, [parentCardCtx]);
  const rootPath = cardCtx.path;

  const editorRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const el = editorRef.current;
		if (!el) return;
		// Сохраняем оригинальные методы
		const originalRemoveChild = el.removeChild.bind(el);
		const originalInsertBefore = el.insertBefore.bind(el);
		// Переопределяем removeChild: если браузер УЖЕ удалил узел, 
		// React просто получит узел обратно, и краш (NotFoundError) не произойдет.
		el.removeChild = (node: Node|any) => {
			if (node.parentNode === el) {
				return originalRemoveChild(node);
			}
			return node; // Молча возвращаем узел, удовлетворяя React
		};
		// Переопределяем insertBefore на случай, если опорный узел был удален браузером
		el.insertBefore = (node: Node|any, refNode: Node | null) => {
			if (refNode && refNode.parentNode !== el) {
				return el.appendChild(node); // Если опорного узла нет, добавляем в конец
			}
			return originalInsertBefore(node, refNode);
		};
		return () => {
			// Восстанавливаем оригинальные методы при размонтировании
			el.removeChild = originalRemoveChild;
			el.insertBefore = originalInsertBefore;
		};
	}, []);



  const [blocks, setBlocks] = useState<DomBlock[]>([]);
	const localNsOverrides = useMemo(() => {
    const map: Record<string, string> = {};
    blocks.forEach(b => {
      if (!(b as any).isAIChatContainer && !(b as any).isSpinner && b.text) {
        map[b.id] = b.text;
      }
    });
    return map;
  }, [blocks]);
	const ns = useMemo(() => ({ ...(baseNs || {}), ...localNsOverrides }), [baseNs, localNsOverrides]);
	const mergedGCtx = useMemo(() => {
    if (!gCtx) return gCtx;
    return { ...gCtx, ns };
  }, [gCtx, ns]);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [mentionMenu, setMentionMenu] = useState<{ isOpen: boolean, query: string, x: number, y: number, range: Range | null }>({ isOpen: false, query: '', x: 0, y: 0, range: null });
  const previousContentRef = useRef<Map<string, string>>(new Map());
  const activeWrapperRef = useRef<HTMLElement | null>(null);
	const collapsedGroupsRef = useRef(collapsedGroups);
	const [aiHighlightRects, setAiHighlightRects] = useState<{top: number, left: number, width: number, height: number}[]>([]);
	useEffect(() => { collapsedGroupsRef.current = collapsedGroups; }, [collapsedGroups]);
	const pendingSelectionRef = useRef<{
		range: Range;
		anchorNode: Node | null;
		anchorOffset: number;
		focusNode: Node | null;
		focusOffset: number;
	} | null>(null);

	const savedSelectionRef = useRef<{
		range: Range;
		anchorNode: Node | null;
		anchorOffset: number;
		focusNode: Node | null;
		focusOffset: number;
	} | null>(null);

	const activeSuggestionIdRef = useRef<string | null>(null);
  // const minigraphIdsRef = useRef<string[]>([]);
  // const minigraphListenersRef = useRef<Array<() => void>>([]);
  // const onChangeRef = useRef(onChange);
	const minigraphIdsRef = useRef<string[]>([]);
  const minigraphListenersRef = useRef<Array<() => void>>([]);
  const [quizMenu, setQuizMenu] = useState<{ isOpen: boolean, x: number, y: number, node: HTMLElement | null }>({ isOpen: false, x: 0, y: 0, node: null });
  const quizMenuItems = [
     { id: 'exact', el: 'Посимвольный', onClick: () => {
         if (quizMenu.node) {
            quizMenu.node.setAttribute('data-type', 'exact');
            setBlocks([...syncDOMToState()]);
         }
     }},
     { id: 'ai', el: 'ИИ-проверка', onClick: () => {
         if (quizMenu.node) {
            quizMenu.node.setAttribute('data-type', 'ai');
            setBlocks([...syncDOMToState()]);
         }
     }}
  ];
  const onChangeRef = useRef(onChange);


  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    if (onChangeRef.current) onChangeRef.current(blocks);
  }, [blocks]);


	useEffect(() => {
		const onSelChange = () => {
			if (!editorRef.current) { pendingSelectionRef.current = null; return; }
			const sel = window.getSelection();
			if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
				pendingSelectionRef.current = null;
				return;
			}
			const range = sel.getRangeAt(0);
			const container = range.commonAncestorContainer;
			const containerEl = container.nodeType === Node.ELEMENT_NODE
				? (container as Element)
				: container.parentElement;

			if (!containerEl) { pendingSelectionRef.current = null; return; }

			const nearestEditor = containerEl.closest('.tv-editor-root');
			if (nearestEditor !== editorRef.current) {
				pendingSelectionRef.current = null;
				return;
			}
			if (containerEl.closest('.inlineCell, .card_inline_link')) {
				pendingSelectionRef.current = null;
				return;
			}
			if (!sel.toString().trim()) {
				pendingSelectionRef.current = null;
				return;
			}

			// Запоминаем именно anchor/focus, а не только границы Range —
			// это позволяет знать, с какого конца выделения "смотрит" каретка.
			pendingSelectionRef.current = {
				range: range.cloneRange(),
				anchorNode: sel.anchorNode,
				anchorOffset: sel.anchorOffset,
				focusNode: sel.focusNode,
				focusOffset: sel.focusOffset,
			};
		};
		document.addEventListener('selectionchange', onSelChange);
		return () => document.removeEventListener('selectionchange', onSelChange);
	}, []);

  const formatEditText = useCallback((text: string) => {
    if (!text) return '<br>';
    const parts = text.split(/(<id=[^>]*>|<quiz=[^:]+:[^>]*>)/);
    let html = '';
    parts.forEach(part => {
      if (part.startsWith('<id=') && part.endsWith('>')) {
        const fullId = part.slice(4, -1);
        const cardId = fullId.split(':')[0];
        let fwdText = 'Unknown';
        if (ns && ns[cardId]) {
          fwdText = ns[cardId].split('\n')[0] || 'empty';
        }
        fwdText = fwdText.replace(/^#+\s*/, '').trim();
        const displayText = fwdText.length > 20 ? fwdText.substring(0, 20) + '...' : fwdText;
        html += `<span class="inlineCell card_inline_link" id="${fullId}" contenteditable="false">${displayText}</span>`;
      } else if (part.startsWith('<quiz=') && part.endsWith('>')) {
         const match = part.match(/<quiz=([^:]+):([^>]*)>/);
         if (match) {
            const type = match[1];
            const answer = match[2];
            html += `<span class="inlineQuiz" data-type="${type}" data-answer="${answer}" contenteditable="false" style="display:inline-flex; align-items:center; border:1px solid color-mix(in srgb, var(--chakra-colors-fg) 20%, transparent); border-radius:4px; padding:2px; margin: 0 4px;">
              <input class="quiz-answer-input" type="text" value="${answer}" style="border:none; outline:none; background:transparent; width: 60px; font-size: inherit; color: var(--chakra-colors-fg);" placeholder="Ответ..." />
              <span class="quiz-type-toggle" style="cursor:pointer; font-size:10px; padding:0 4px; opacity: 0.5;">▼</span>
            </span>`;
         }
      } else {
        html += part
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br>');
      }
    });
    return html;
  }, [ns]);

  const computedBlocks = useMemo(() => {
    const blockMap = new Map(blocks.map(b => [b.id, b]));
    return blocks.map(block => {
      let depth = 0;
      let curr = block.parentId;
      let groupIds = [];
      while (curr && blockMap.has(curr)) {
        depth++;
        groupIds.push(curr);
        curr = blockMap.get(curr)?.parentId;
      }
      return { ...block, depth, groupIds };
    });
  }, [blocks]);

	const syncDOMToState = (): DomBlock[] => {
		if (!editorRef.current) return blocks;
		const newBlocks: DomBlock[] = [];
		const wrappers = Array.from(editorRef.current.querySelectorAll('.tv-block-wrapper'));
		wrappers.forEach((wrapper) => {
      if (wrapper.closest('.tv-editor-root') !== editorRef.current) return;
			if (wrapper.closest('[data-ephemeral="true"]')) return;
			const isAIChatContainer = wrapper.hasAttribute('data-is-ai-chat');
			const id = wrapper.getAttribute('data-id') || `blk-${Date.now()}-${Math.random()}`;
      const parentId = wrapper.getAttribute('data-parent-id') || undefined;
			if (isAIChatContainer) {
				const chatData = JSON.parse(wrapper.getAttribute('data-chat-messages') || '[]');
				// Считываем сохраненный offsetTop
				const offsetAttr = wrapper.getAttribute('data-offset-top');
				const customOffsetTop = offsetAttr ? parseFloat(offsetAttr) : undefined;
				const rectsAttr = wrapper.getAttribute('data-highlight-rects');
				const highlightRects = rectsAttr ? JSON.parse(rectsAttr) : undefined;
				// Считываем данные для режима "insert link"
				const selectedTextAttr = wrapper.getAttribute('data-selected-text');
				const selectedText = selectedTextAttr ? selectedTextAttr : undefined;
				const sourceBlockIdAttr = wrapper.getAttribute('data-source-block-id');
				const sourceBlockId = sourceBlockIdAttr ? sourceBlockIdAttr : undefined;
				newBlocks.push({ 
					id, text: '', isRendered: false, isAIChatContainer: true, 
					chatMessages: chatData, parentId, customOffsetTop, highlightRects,
					selectedText, sourceBlockId,
				} as any);
				return;
			}
			const role = wrapper.getAttribute('data-role') || undefined;
			const isSpinner = wrapper.hasAttribute('data-is-spinner');
			if (isSpinner) {
				newBlocks.push({ id, text: '', isRendered: false, isSpinner: true, role, parentId });
				return;
			}
			const isRendered = wrapper.hasAttribute('data-rendered');
			const isHidden = wrapper.hasAttribute('data-hidden');
			const isGroup = wrapper.hasAttribute('data-is-group');
			let text = '';
			if (isRendered || isHidden) {
				text = wrapper.getAttribute('data-raw-text') || '';
			} else {
				const tvBlock = wrapper.querySelector('.tv-block, .tv-group') as HTMLElement;
				if (tvBlock) {
					text = Array.from(tvBlock.childNodes).map(extractDOMContent).join('').replace(/^\n+/, '').replace(/\n$/, '');
				}
			}
			newBlocks.push({ id, text, isRendered, isGroup, parentId, role });
		});
		if (newBlocks.length === 0) newBlocks.push({ id: `blk-${Date.now()}`, text: '', isRendered: false });
		return newBlocks;
	};
	// const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // const handleInput = (_e: React.FormEvent) => {
  //   if (!editorRef.current) return;
	// 	const target = _e.target as HTMLElement;
	// 	if (target.closest('.tv-editor-root') !== editorRef.current) return;
	// 	if (target.closest('.chat-input-area')) return;
	// 	if (target.closest('[data-ephemeral="true"]')) return;
  //   const wrappers = editorRef.current.querySelectorAll('.tv-block-wrapper');
  //   let needsSync = false;
  //   wrappers.forEach((wrapper) => {
  //     if (wrapper.closest('.tv-editor-root') !== editorRef.current) return;
  //     if (wrapper.hasAttribute('data-is-ai-chat')) return;
  //     const id = wrapper.getAttribute('data-id');
  //     if (!id) return;
  //     const isRendered = wrapper.hasAttribute('data-rendered');
  //     if (isRendered) return;
  //     const tvBlock = wrapper.querySelector('.tv-block, .tv-group') as HTMLElement;
  //     if (!tvBlock) return;
  //     const currentText = tvBlock.innerText.trim();
  //     const previousText = previousContentRef.current.get(id) || '';
  //     if (previousText && !currentText) needsSync = true;
  //     previousContentRef.current.set(id, currentText);
	// 		if (previousText && currentText !== previousText) needsSync = true;
  //   	previousContentRef.current.set(id, currentText);
  //   });
  //   if (needsSync) setBlocks([...syncDOMToState()]);

	// 	if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
	// 	typingTimeoutRef.current = setTimeout(() => {
	// 		saveHistorySnapshot();
	// 	}, 1000);
  // };
	const handleInput = (_e: React.FormEvent) => {
    if (!editorRef.current) return;
    const target = _e.target as HTMLElement;
    if (target.closest('.tv-editor-root') !== editorRef.current) return;
    if (target.closest('.chat-input-area')) return;
    if (target.closest('[data-ephemeral="true"]')) return;
    
    const wrappers = editorRef.current.querySelectorAll('.tv-block-wrapper');
    let needsSync = false;
    
    wrappers.forEach((wrapper) => {
      if (wrapper.closest('.tv-editor-root') !== editorRef.current) return;
      if (wrapper.hasAttribute('data-is-ai-chat')) return;
      
      const id = wrapper.getAttribute('data-id');
      if (!id) return;
      
      const isRendered = wrapper.hasAttribute('data-rendered');
      if (isRendered) return;
      
      const tvBlock = wrapper.querySelector('.tv-block, .tv-group') as HTMLElement;
      if (!tvBlock) return;
      
      const currentText = tvBlock.innerText.trim();
      const previousText = previousContentRef.current.get(id) || '';
      
      // ИСПРАВЛЕНИЕ ЗДЕСЬ: Возвращаем оригинальное условие!
      // Синхронизируем стейт только если блок БЫЛ не пустым, а СТАЛ пустым.
      // Это предотвращает ре-рендер компонента на каждый символ или Ctrl+Backspace
      if (previousText && !currentText) {
          needsSync = true;
      }
      
      previousContentRef.current.set(id, currentText);
    });
    
    if (needsSync) {
        setBlocks([...syncDOMToState()]);
    }
  };

  const setCursor = (blockIndex: number, offset: number) => {
    const blockEl = document.querySelector(
			`[data-index="${blockIndex}"] .tv-block, [data-index="${blockIndex}"] .tv-group`
		) as HTMLElement;
    if (!blockEl) return;
    blockEl.focus();
    const range = document.createRange();
    const s = window.getSelection();
    if (offset === -1) {
      range.selectNodeContents(blockEl);
      range.collapse(false);
    } else {
      const walker = createOffsetWalker(blockEl);
      const { node, offset: nodeOffset } = walker.findOffset(offset);
      if (node) {
        try {
          range.setStart(node, nodeOffset);
          range.collapse(true);
        } catch (e) {
          range.selectNodeContents(blockEl);
          range.collapse(false);
        }
      } else {
        range.selectNodeContents(blockEl);
        range.collapse(false);
      }
    }
    s?.removeAllRanges();
    s?.addRange(range);
  };

  const insertMention = useCallback((item: { id: string, text: string }) => {
		console.log("Выбрана карточка из меню '/'!");
    console.log("ID карточки:", item.id);
    console.log("Тег, который запишется в текст:", `<id=${item.id}>`);
    const sel = window.getSelection();
    if (!sel || !mentionMenu.range) return;
    let r;
    if (sel.rangeCount > 0 && sel.getRangeAt(0).startContainer === mentionMenu.range.startContainer) {
      r = sel.getRangeAt(0).cloneRange();
      r.setStart(r.startContainer, Math.max(0, r.startOffset - mentionMenu.query.length - 1));
    } else {
      r = document.createRange();
      const startNode = mentionMenu.range.startContainer;
      const startOffset = mentionMenu.range.startOffset;
      r.setStart(startNode, Math.max(0, startOffset - 1));
      r.setEnd(startNode, Math.min(startNode.textContent?.length || 0, startOffset + mentionMenu.query.length));
    }
    r.deleteContents();
    const el = document.createElement('span');
    el.className = 'inlineCell';
    el.contentEditable = 'false';
    el.id = item.id;
    el.innerText = item.text.length > 20 ? item.text.substring(0, 20) + '...' : item.text;
    r.insertNode(el);
    const space = document.createTextNode('\u00A0');
    el.after(space);
    r.setStartAfter(space);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
    setMentionMenu(prev => ({ ...prev, isOpen: false, query: '' }));
  }, [mentionMenu]);

  // ─── ГЛОБАЛЬНАЯ ИСТОРИЯ (UNDO / REDO) ──────────────────────────────────────────
	// ─── ГЛОБАЛЬНАЯ ИСТОРИЯ (UNDO / REDO) ──────────────────────────────────────────
	const historyRef = useRef<{
		past: { blocks: DomBlock[], cursor: { index: number, offset: number } | null }[],
		future: { blocks: DomBlock[], cursor: { index: number, offset: number } | null }[]
	}>({ past: [], future: [] });

	const saveHistorySnapshot = useCallback(() => {
		const currentBlocks = syncDOMToStateRef.current();
		const stringified = JSON.stringify(currentBlocks);
		
		// Защита от дубликатов: не сохраняем, если состояние визуально не поменялось
		if (historyRef.current.past.length > 0) {
			const last = historyRef.current.past[historyRef.current.past.length - 1];
			if (JSON.stringify(last.blocks) === stringified) {
				return;
			}
		}

		// Получаем позицию курсора, чтобы после Undo вернуть его на место
		let cursor = null;
		const sel = window.getSelection();
		if (sel && sel.rangeCount > 0 && editorRef.current) {
			const range = sel.getRangeAt(0);
			const info = getBlockInfoFromNode(range.startContainer, range.startOffset, editorRef.current);
			if (info) cursor = { index: info.blockIndex, offset: info.offset };
		}

		historyRef.current.past.push({
			blocks: JSON.parse(stringified), // Глубокая копия
			cursor
		});
		
		historyRef.current.future = []; // Очищаем Redo при новом действии
		
		if (historyRef.current.past.length > 50) {
			historyRef.current.past.shift();
		}
	}, []);

	const undoRef = useRef(() => {
		if (historyRef.current.past.length === 0) return;
		const currentBlocks = syncDOMToStateRef.current();
		
		historyRef.current.future.push({
			blocks: JSON.parse(JSON.stringify(currentBlocks)),
			cursor: null
		});

		const previousState = historyRef.current.past.pop()!;
		setBlocks(previousState.blocks);
		if (previousState.cursor) {
			requestAnimationFrame(() => {
				setCursor(previousState.cursor!.index, previousState.cursor!.offset);
			});
		}
	});

	const redoRef = useRef(() => {
		if (historyRef.current.future.length === 0) return;
		const currentBlocks = syncDOMToStateRef.current();
		
		historyRef.current.past.push({
			blocks: JSON.parse(JSON.stringify(currentBlocks)),
			cursor: null
		});

		const nextState = historyRef.current.future.pop()!;
		setBlocks(nextState.blocks);
		if (nextState.cursor) {
			requestAnimationFrame(() => {
				setCursor(nextState.cursor!.index, nextState.cursor!.offset);
			});
		}
	});

  // Очищенный handleInput (без таймера истории)

	const mentionMenuItems = useMemo(() => {
    const q = mentionMenu.query.toLowerCase();
    const opts = [] as any;
    // 1. Вычисляем ID текущего блока, в котором вызвано меню
    let activeBlockId: string | null = null;
    if (mentionMenu.range) {
      const node = mentionMenu.range.startContainer;
      const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
      const wrapper = el?.closest('.tv-block-wrapper');
      if (wrapper) {
        activeBlockId = wrapper.getAttribute('data-id');
      }
    }
    Object.keys(ns).forEach(nid => {
      // 2. Исключаем текущий блок из выдачи, чтобы не сослаться на самого себя
      if (nid === activeBlockId) return;
      const cardContent = ns[nid] || '';
      let fwdText = cardContent.split('\n')[0] || 'empty';
      // 3. Убираем "сырые" теги <id=...> и # из текста, чтобы меню выглядело красиво (как на вашем скриншоте)
      fwdText = fwdText.replace(/<id=[^>]*>/g, '').replace(/^#+\s*/, '').trim();
      if (fwdText.toLowerCase().includes(q) || nid.toLowerCase().includes(q)) {
        opts.push({
          id: nid,
          el: fwdText,
          onClick: () => insertMention({ id: nid, text: fwdText })
        });
      }
    });
    if (opts.length === 0) {
      opts.push({ id: 'no-results', el: <div style={{opacity:0.5}}>no cards match</div>, disabled: true });
    }
    
    opts.unshift({
      id: 'insert-quiz',
      el: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--chakra-colors-green-500)' }}>
            <LuBookDashed /> <span>Ввод текста с проверкой</span>
        </div>
      ),
      onClick: () => {
          const sel = window.getSelection();
          if (!sel || !mentionMenu.range) return;
          let r;
          if (sel.rangeCount > 0 && sel.getRangeAt(0).startContainer === mentionMenu.range.startContainer) {
            r = sel.getRangeAt(0).cloneRange();
            r.setStart(r.startContainer, Math.max(0, r.startOffset - mentionMenu.query.length - 1));
          } else {
            r = document.createRange();
            const startNode = mentionMenu.range.startContainer;
            const startOffset = mentionMenu.range.startOffset;
            r.setStart(startNode, Math.max(0, startOffset - 1));
            r.setEnd(startNode, Math.min(startNode.textContent?.length || 0, startOffset + mentionMenu.query.length));
          }
          r.deleteContents();
          
          const wrapper = document.createElement('span');
          wrapper.innerHTML = `<span class="inlineQuiz" data-type="exact" data-answer="" contenteditable="false" style="display:inline-flex; align-items:center; border:1px solid color-mix(in srgb, var(--chakra-colors-fg) 20%, transparent); border-radius:4px; padding:2px; margin: 0 4px;"><input class="quiz-answer-input" type="text" value="" style="border:none; outline:none; background:transparent; width: 60px; font-size: inherit; color: var(--chakra-colors-fg);" placeholder="Ответ..." /><span class="quiz-type-toggle" style="cursor:pointer; font-size:10px; padding:0 4px; opacity: 0.5;">▼</span></span>`;
          const el = wrapper.firstChild as HTMLElement;
          
          r.insertNode(el);
          const space = document.createTextNode('\u00A0');
          el.after(space);
          r.setStartAfter(space);
          r.collapse(true);
          sel.removeAllRanges();
          sel.addRange(r);
          setMentionMenu(prev => ({ ...prev, isOpen: false, query: '' }));
          setTimeout(() => el.querySelector('input')?.focus(), 50);
      }
    });
    
    return opts;
  }, [ns, mentionMenu.query, mentionMenu.range, insertMention]);


	const insertAIBlocks = useCallback((
		afterIndex: number, initialPrompt?: string, customOffsetTop?: number,
		highlightRects?: any, selectedText?: string, forcedId?: string) => {
		const sourceBlock = blocks[afterIndex];
		if (!sourceBlock) return null;

		// const chatBlockId = forcedId || `chat-${Date.now()}`;
		const chatBlockId = forcedId || genId('chat');

		const initialMessages = [
			{ id: `msg-${Date.now()}`, role: 'user', text: initialPrompt || '', isRendered: false }
		];

		const chatBlock = {
			id: chatBlockId,
			text: '',
			isRendered: false,
			isAIChatContainer: true,
			parentId: sourceBlock?.parentId,
			chatMessages: initialMessages,
			customOffsetTop,
			highlightRects,
			selectedText,
			sourceBlockId: sourceBlock.id,
		} as any;

		setBlocks(prev => {
			const filteredBlocks = prev.filter(b => !b.isAIChatContainer);
			const newSourceIndex = filteredBlocks.findIndex(b => b.id === sourceBlock.id);
			const next = [...filteredBlocks];
			if (newSourceIndex !== -1) {
				next.splice(newSourceIndex + 1, 0, chatBlock);
			} else {
				next.push(chatBlock);
			}
			return next;
		});

		setTimeout(() => {
			const chatEl = document.querySelector(`[data-id="${chatBlockId}"]`);
			if (chatEl) {
				const firstBlock = chatEl.querySelector('.tv-block, .tv-group') as HTMLElement;
				if (firstBlock) {
					firstBlock.focus();
					const range = document.createRange();
					range.selectNodeContents(firstBlock);
					range.collapse(false);
					const sel = window.getSelection();
					sel?.removeAllRanges();
					sel?.addRange(range);
				}
			}
		}, 100);

		return chatBlockId;
	}, [blocks]);
	
	const syncDOMToStateRef  = useRef(syncDOMToState);
	const setBlocksRef       = useRef(setBlocks);
	const onSaveRef          = useRef(onSave);
	const convertBlocksRef   = useRef(convertBlocksToUnifiedFormat);
	useEffect(() => { syncDOMToStateRef.current  = syncDOMToState;  });
	useEffect(() => { setBlocksRef.current       = setBlocks;       });
	useEffect(() => { onSaveRef.current          = onSave;          });
	useEffect(() => { convertBlocksRef.current   = convertBlocksToUnifiedFormat; });

	const insertAIBlocksRef = useRef(insertAIBlocks) as any;
	useEffect(() => { insertAIBlocksRef.current = insertAIBlocks; }, [insertAIBlocks]);
	useEffect(() => {
  const handleGlobalKeyDown = (e: KeyboardEvent) => {
    if (!editorRef.current) return;
    // ── Открытие suggestion по Alt ──────────────────────────────
    if (e.key === 'Alt' && !e.repeat) {
      const pending = pendingSelectionRef.current;
      if (!pending || activeSuggestionIdRef.current) return;
      const range = pending.range;
      const container = range.commonAncestorContainer;
      const containerEl = container.nodeType === Node.ELEMENT_NODE
        ? (container as Element)
        : container.parentElement;
      if (!containerEl || containerEl.closest('.tv-editor-root') !== editorRef.current) return;
      const selectedText = range.toString();
      if (!selectedText.trim()) return;
      const blockInfo = getBlockInfoFromNode(range.startContainer, range.startOffset, editorRef.current);
      if (!blockInfo) return;

      e.preventDefault();
      e.stopImmediatePropagation();

      const editorRect = editorRef.current.getBoundingClientRect();
      const clientRects = Array.from(range.getClientRects()).filter(r => r.width > 2);
      const relativeRects = clientRects.map(rect => ({
        top: rect.top - editorRect.top + editorRef.current!.scrollTop,
        left: rect.left - editorRect.left + editorRef.current!.scrollLeft,
        width: rect.width,
        height: rect.height,
      }));
      let offsetTop = 8;
      try {
        const rect = range.getBoundingClientRect();
        const node = range.startContainer;
        const blockWrapper = node.nodeType === Node.ELEMENT_NODE
          ? (node as Element).closest('.tv-block-wrapper')
          : node.parentElement?.closest('.tv-block-wrapper');
        if (blockWrapper) {
          const blockRect = blockWrapper.getBoundingClientRect();
          offsetTop = Math.min(8, rect.bottom - blockRect.bottom + 8);
        }
      } catch (err) {}
      // ГЛАВНЫЙ ФИКС: сохраняем anchor/focus, а не только range
      savedSelectionRef.current = {
        range: range.cloneRange(),
        anchorNode: pending.anchorNode,
        anchorOffset: pending.anchorOffset,
        focusNode: pending.focusNode,
        focusOffset: pending.focusOffset,
      };
      const chatBlockId = `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      activeSuggestionIdRef.current = chatBlockId;
      insertAIBlocksRef.current(blockInfo.blockIndex, '', offsetTop, relativeRects, selectedText, chatBlockId);
      window.getSelection()?.removeAllRanges();
      pendingSelectionRef.current = null;
      return;
    }

    // ── Закрытие suggestion по Escape ───────────────────────────
    if (e.key === 'Escape' && activeSuggestionIdRef.current) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const blockId = activeSuggestionIdRef.current;
      activeSuggestionIdRef.current = null;
      setBlocks(prev => prev.filter(b => b.id !== blockId));
      setAiHighlightRects([]);
      const saved = savedSelectionRef.current;
      savedSelectionRef.current = null;
      if (saved) {
        setTimeout(() => {
          try {
            editorRef.current?.focus();
            const s = window.getSelection();
            s?.removeAllRanges();
            // ⬇️ ГЛАВНЫЙ ФИКС: восстанавливаем направленное выделение
            if (s && saved.anchorNode && saved.focusNode) {
              s.setBaseAndExtent(saved.anchorNode, saved.anchorOffset, saved.focusNode, saved.focusOffset);
            } else if (s) {
              s.addRange(saved.range);
            }
          } catch (err) {
            try {
              const s = window.getSelection();
              s?.removeAllRanges();
              s?.addRange(saved.range);
            } catch (e2) {}
          }
        }, 0);
      }
    }
  };

  document.addEventListener('keydown', handleGlobalKeyDown, true);
  return () => document.removeEventListener('keydown', handleGlobalKeyDown, true);
}, []);

	const mentionMenuRef = useRef({
		isOpen:        mentionMenu.isOpen,
		query:         mentionMenu.query,
		setOpen:       (v: boolean) => setMentionMenu(p => ({ ...p, isOpen: v })),
		appendQuery:   (c: string)  => setMentionMenu(p => ({ ...p, query: p.query + c })),
		backspaceQuery:()           => setMentionMenu(p => ({ ...p, query: p.query.slice(0, -1) })),
		openAt:        (range: Range) => {
			const rect = range.getBoundingClientRect();
			setMentionMenu({ isOpen: true, query: '', x: rect.left, y: rect.bottom + 5, range });
		},
	});
	useEffect(() => {
		mentionMenuRef.current.isOpen = mentionMenu.isOpen;
		mentionMenuRef.current.query  = mentionMenu.query;
	}, [mentionMenu.isOpen, mentionMenu.query]);

	const { handleKeyDown, handleKeyUp } = useKeyDown({
		editorRef,
		syncDOMToStateRef,
		setBlocksRef,
		onSaveRef,
		convertBlocksRef,
		mentionMenuRef,
		insertAIBlocksRef,
		collapsedGroupsRef,
		saveHistorySnapshot,
		undoRef,
		redoRef,
	});


  const toggleGroup = useCallback((id: string) => {
		setBlocks(syncDOMToStateRef.current());
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

	// ─── drop actions ──────────────────────────────────────────────────────────────────────
	useEffect(() => { syncDOMToStateRef.current = syncDOMToState; });
	useEffect(() => { setBlocksRef.current      = setBlocks;      });
	const { dropIndicator, handleDragOver, handleDrop, handleDragLeave } = useDragDrop({
		editorRef,
		syncDOMToStateRef,
		setBlocksRef,
	});

	// ─── effects & render & handle ──────────────────────────────────────────────────────────────────────
	const hasInitialized = useRef(false);
	useEffect(() => {
		if (!hasInitialized.current && blocks.length > 0 && blocks[0].text !== '') {
			hasInitialized.current = true;
		}
		if (hasInitialized.current) return;
		if (initialBlocks && initialBlocks.length > 0) {
			hasInitialized.current = true;
			setBlocks(initialBlocks);
		} else if (initialContent) {
			hasInitialized.current = true;
			const rawChunks = initialContent.split(/\n?~~~\n?/);
			const groupStack: Array<{ id: string; depth: number }> = [];
			const parsedBlocks = rawChunks.map((chunk:any, i:any) => {
				let text = chunk.trim();
				if (!text) return null;
				const depthMatch = text.match(/^(>+)\s/);
				const depth = depthMatch ? depthMatch[1].length : 0;
				const cleanText = text.replace(/^>+\s*/, '');
				const id = `blk-${Date.now()}-${i}-${Math.random()}`;
				let isGroup = false;
				let parentId = undefined;
				while (groupStack.length > 0 && groupStack[groupStack.length - 1].depth >= depth) {
					groupStack.pop();
				}
				if (groupStack.length > 0) {
					parentId = groupStack[groupStack.length - 1].id;
				}
				if (cleanText.startsWith('# ')) {
					isGroup = true;
					text = cleanText.replace(/^#\s*/, '');
					groupStack.push({ id, depth });
				} else {
					text = cleanText;
				}
				return { id, text, isRendered: false, isGroup, parentId };
			}).filter(Boolean) as DomBlock[];
			setBlocks(parsedBlocks.length > 0 ? parsedBlocks : [{ id: `blk-${Date.now()}`, text: '', isRendered: false }]);
		}
	}, [initialBlocks, initialContent, blocks]);

	useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    let frameId = null as any;

    const syncLineNumbers = () => {
      const wrappers = Array.from(editor.querySelectorAll('.tv-block-wrapper')).filter(
        (w) => w.closest('.tv-editor-root') === editor
      ) as any;
      let currentLineNumber = 1; 
      const updates = [];

      for (let i = 0; i < wrappers.length; i++) {
        const wrapper = wrappers[i];
        const gutter = wrapper.querySelector('.block-gutter');

        if (wrapper.hasAttribute('data-is-ai-chat') || wrapper.hasAttribute('data-is-spinner')) {
          if (gutter) updates.push({ gutter, html: '', display: 'none' });
          continue;
        }

        const lineCount = parseInt(wrapper.getAttribute('data-line-count') || '1', 10);

        if (wrapper.style.display === 'none' || wrapper.hasAttribute('data-hidden')) {
          if (gutter) updates.push({ gutter, html: '', display: 'none' });
          currentLineNumber += lineCount;
          continue; 
        }

        let actualLines = 1;

        if (gutter) {
          let container = wrapper.querySelector('[role="textbox"]'); 
          if (container) {
            const parent = container.parentElement;
            if (parent && parent.style.display === 'none') container = null;
          }
          if (!container) {
            container = wrapper.querySelector('.tv-block:not(.tv-group-badge)'); 
            if (!container) container = wrapper.querySelector('.tv-group');
          }

          let html = '';
          let isEditing = false;
          
          if (container) {
            isEditing = container.getAttribute('role') === 'textbox' || (container as HTMLElement).isContentEditable;
            
            const wrapperRect = wrapper.getBoundingClientRect();
            const offsets = [] as number[];
            
            let isNewLine = true;
            let pendingEmptyLine = true; // Хранит статус "ожидается ли новая пустая строка в конце"

            // Жестко привязываемся к узлам текста и <br>
            const walk = (node: any) => {
              if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent || '';
                if (text.length > 0) {
                  for (let idx = 0; idx < text.length; idx++) {
                    if (isNewLine) {
                      try {
                        const range = document.createRange();
                        range.setStart(node, idx);
                        range.setEnd(node, Math.min(idx + 1, text.length));
                        let rects = range.getClientRects();
                        if (rects.length === 0) {
                          range.selectNodeContents(node);
                          rects = range.getClientRects();
                        }
                        if (rects.length > 0) {
                          const t = rects[0].top - wrapperRect.top;
                          // Защита от дублей, разница должна быть более 8 пикселей
                          if (offsets.length === 0 || t > offsets[offsets.length - 1] + 8) {
                            offsets.push(t);
                          }
                        }
                      } catch(e) {}
                      isNewLine = false;
                      pendingEmptyLine = false; // Текст завершил пустую строку
                    }
                    if (text[idx] === '\n') {
                      isNewLine = true;
                      pendingEmptyLine = true; // За \n должна следовать новая пустая строка
                    }
                  }
                }
              } else if (node.nodeType === Node.ELEMENT_NODE) {
                const tag = node.tagName;
                const cl = node.classList;
                
                if (cl && (cl.contains('resizer-handle') || cl.contains('cropper-overlay') || cl.contains('ctrl-buttons-overlay') || cl.contains('block-gutter'))) return;
                
                const isInlineWidget = cl && (cl.contains('inlineCell') || cl.contains('inlineQuiz') || tag === 'IMG');
                
                if (tag === 'BR') {
                  if (isNewLine) {
                    try {
                      const range = document.createRange();
                      range.selectNode(node);
                      const rects = range.getClientRects();
                      if (rects.length > 0) {
                        const t = rects[0].top - wrapperRect.top;
                        if (offsets.length === 0 || t > offsets[offsets.length - 1] + 8) {
                          offsets.push(t);
                        }
                      }
                    } catch(e) {}
                  }
                  isNewLine = true;
                  pendingEmptyLine = true; // Тег <br> инициирует новую логическую строку
                } else if (isInlineWidget) {
                  if (isNewLine) {
                    try {
                      const rect = node.getBoundingClientRect();
                      const t = rect.top - wrapperRect.top;
                      if (offsets.length === 0 || t > offsets[offsets.length - 1] + 8) {
                        offsets.push(t);
                      }
                    } catch(e) {}
                    isNewLine = false;
                    pendingEmptyLine = false; // Виджет - это контент, строка не пустая
                  }
                } else {
                  const isBlock = /^(DIV|P|LI|H[1-6])$/.test(tag);
                  if (isBlock) isNewLine = true;
                  
                  for (let child of node.childNodes) {
                    walk(child);
                  }
                  
                  if (isBlock) isNewLine = true;
                }
              }
            };

            walk(container);

            // Если блок завершился на \n или <br> (через Shift+Enter), создаем координаты для пустой строки курсора
            if (pendingEmptyLine) {
                try {
                    const range = document.createRange();
                    range.selectNodeContents(container);
                    range.collapse(false);
                    const rects = range.getClientRects();
                    if (rects.length > 0) {
                        const t = rects[0].top - wrapperRect.top;
                        if (offsets.length === 0 || t > offsets[offsets.length - 1] + 8) {
                            offsets.push(t);
                        }
                    } else {
                        if (offsets.length > 0) {
                            // Фолбэк для старых браузеров (примерно высота одной строки)
                            offsets.push(offsets[offsets.length - 1] + 20);
                        }
                    }
                } catch(e) {}
            }

            if (offsets.length === 0) offsets.push(4); 
            
            let cursorLineIndex = -1;
            
            if (isEditing) {
              try {
                const sel = window.getSelection();
                if (sel && sel.rangeCount > 0) {
                  const range = sel.getRangeAt(0);
                  if (container.contains(range.commonAncestorContainer) || container === range.commonAncestorContainer) {
                    let cursorTop = null as any;
                    const cursorRect = range.getBoundingClientRect();
                    
                    if (cursorRect.top > 0 || cursorRect.bottom > 0) {
                        cursorTop = cursorRect.top - wrapperRect.top;
                    } else {
                        const cursorRects = range.getClientRects();
                        if (cursorRects.length > 0 && (cursorRects[0].top > 0 || cursorRects[0].bottom > 0)) {
                            cursorTop = cursorRects[0].top - wrapperRect.top;
                        } else {
                            const sc = range.startContainer;
                            const so = range.startOffset;
                            let targetNode = null;

                            if (sc.nodeType === Node.ELEMENT_NODE) {
                                targetNode = sc.childNodes[so] || sc.childNodes[so - 1];
                            } else if (sc.nodeType === Node.TEXT_NODE) {
                                targetNode = sc;
                            }

                            if (targetNode) {
                                const r2 = document.createRange();
                                try {
                                    if (targetNode.nodeType === Node.ELEMENT_NODE && ['BR', 'IMG', 'INPUT'].includes((targetNode as Element).tagName)) {
                                        r2.selectNode(targetNode);
                                    } else {
                                        r2.selectNodeContents(targetNode);
                                    }
                                    const cr = r2.getBoundingClientRect();
                                    if (cr.top > 0 || cr.bottom > 0) {
                                        cursorTop = cr.top - wrapperRect.top;
                                    }
                                } catch (e) {
                                    if (targetNode.nodeType === Node.ELEMENT_NODE) {
                                        try {
                                            const cr2 = (targetNode as Element).getBoundingClientRect();
                                            if (cr2.top > 0 || cr2.bottom > 0) {
                                                cursorTop = cr2.top - wrapperRect.top;
                                            }
                                        } catch (e2) {}
                                    }
                                }
                            }
                        }
                    }
                    
                    if (cursorTop !== null) {
                        let activeIdx = 0;
                        // Находим, к какой ЛОГИЧЕСКОЙ строке относится курсор
                        for (let k = 0; k < offsets.length; k++) {
                            if (cursorTop >= offsets[k] - 10) {
                                activeIdx = k;
                            }
                        }
                        cursorLineIndex = activeIdx;
                    }
                  }
                }
              } catch (e) {}
            }

            actualLines = offsets.length; // Финальное количество жестких логических строк
            
            for (let j = 0; j < offsets.length; j++) {
              const isCursorLine = j === cursorLineIndex;
              const colorStyle = isCursorLine ? `color: var(--chakra-colors-blue-400); font-weight: 500;` : '';
              html += `<div style="position: absolute; top: ${offsets[j]}px; right: 0; line-height: 1.6; ${colorStyle}">${currentLineNumber + j}</div>`;
            }
          }
          updates.push({ gutter, html, display: 'block' });
          
          currentLineNumber += isEditing ? actualLines : lineCount;
        } else {
          currentLineNumber += lineCount;
        }
      }

      for (let i = 0; i < updates.length; i++) {
        const { gutter, html, display } = updates[i];
        if (gutter.style.display !== display) gutter.style.display = display;
        if (html !== undefined && gutter.innerHTML !== html) gutter.innerHTML = html;
      }
    };

    syncLineNumbers();

    const queueSync = () => {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(syncLineNumbers);
    };

    const observer = new MutationObserver(queueSync);

    observer.observe(editor, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true, 
      attributeFilter: ['style', 'data-hidden', 'data-line-count'] 
    });
    
    document.addEventListener('selectionchange', queueSync);

    return () => {
      observer.disconnect();
      document.removeEventListener('selectionchange', queueSync);
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [fontSize]);

	useEffect(() => {
		const handleSelectionChange = () => {
			if (!editorRef.current) return;
			const sel = window.getSelection();
			if (!sel || sel.rangeCount === 0) return;
			const node = sel.getRangeAt(0).startContainer;
			const container = node.nodeType === Node.ELEMENT_NODE
				? (node as Element)
				: node.parentElement;

			if (!container || !editorRef.current.contains(container)) return;
			const wrapper = container.closest('.tv-block-wrapper') as HTMLElement | null;
			if (wrapper && wrapper !== activeWrapperRef.current) {
				activeWrapperRef.current?.removeAttribute('data-focused');
				wrapper.setAttribute('data-focused', 'true');
				activeWrapperRef.current = wrapper;
			}
			if (wrapper && wrapper !== activeWrapperRef.current) {
				// if (activeWrapperRef.current) {
				// 	saveHistorySnapshot();
				// }
				activeWrapperRef.current?.removeAttribute('data-focused');
				wrapper.setAttribute('data-focused', 'true');
				activeWrapperRef.current = wrapper;
			}
		};
		document.addEventListener('selectionchange', handleSelectionChange);
		return () => document.removeEventListener('selectionchange', handleSelectionChange);
	}, [saveHistorySnapshot]);


	useEffect(() => {
		const clear = () => editorRef.current?.classList.remove('ctrl-active');
		window.addEventListener('blur', clear);
		return () => window.removeEventListener('blur', clear);
	}, []);

	useImperativeHandle(ref, () => ({
		getContent: () => {
			const currentBlocks = syncDOMToState();
			return convertBlocksToUnifiedFormat(currentBlocks);
		},
		getBlocks: () => {
			return syncDOMToState();
		},
		addBlocks: (newBlocks: DomBlock[]) => {
			const current = syncDOMToState();
			setBlocks([...current, ...newBlocks]);
		},
		updateBlock: (id: string, updates: Partial<DomBlock>) => {
			setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
		},
		getMinigraphIds: () => minigraphIdsRef.current,
		subscribeMinigraphIds: (cb: () => void) => {
			minigraphListenersRef.current.push(cb);
			return () => { minigraphListenersRef.current = minigraphListenersRef.current.filter(x => x !== cb); }
		},
		clearMinigraphIds: () => {
			minigraphIdsRef.current = [];
			minigraphListenersRef.current.forEach(cb => cb());
		}
	}));


  return (
		<GraphCtx.Provider value={mergedGCtx}>
			<Box position="relative" w="100%" h="100%" display="flex" flexDirection="row">
				<ContextMenu
					isOpen={mentionMenu.isOpen}
					x={mentionMenu.x}
					y={mentionMenu.y}
					items={mentionMenuItems}
					onClose={() => setMentionMenu(prev => ({ ...prev, isOpen: false }))}
				/>
				
				<ContextMenu 
					isOpen={quizMenu.isOpen}
					x={quizMenu.x}
					y={quizMenu.y}
					items={quizMenuItems}
					onClose={() => setQuizMenu(prev => ({ ...prev, isOpen: false }))}
				/>

				<div
					ref={editorRef}
					className="tv-editor-root"
					style={{
						// padding: mainTree? '50px 30px':'0px',
						padding: mainTree ? '50px 30px 50px 50px' : '0px 0px 0px 45px', 
					}}
					contentEditable={true}
					suppressContentEditableWarning={true}
					css={mainTree ? editorCSS : [editorCSS, nestedTreeOverflowFixCSS]}
					onMouseDown={() => {setAiHighlightRects([])}}
					onPointerDown={(e) => {
						const target = e.target as HTMLElement;
						if (target.closest('.quiz-type-toggle')) {
							e.preventDefault();
							e.stopPropagation();
							const rect = target.getBoundingClientRect();
							const quizSpan = target.closest('.inlineQuiz') as HTMLElement;
							setQuizMenu({ isOpen: true, x: rect.left, y: rect.bottom, node: quizSpan });
							return;
						}
					}}
					onKeyDown={(e) => {
						e.stopPropagation();
						if (e.ctrlKey && e.key === 'Enter') {
							e.preventDefault();
							const sel = window.getSelection();
							if (!sel || sel.rangeCount === 0) return;
							const node = sel.getRangeAt(0).startContainer;
							const wrapper = node.nodeType === Node.ELEMENT_NODE
								? (node as Element).closest('.tv-block-wrapper')
								: node.parentElement?.closest('.tv-block-wrapper');
							if (!wrapper) return;
							const blockId = wrapper.getAttribute('data-id');
							if (!blockId) return;
							const currentBlocks = syncDOMToState();
							const blockIndex = currentBlocks.findIndex(b => b.id === blockId);
							if (blockIndex === -1) return;
							const text = currentBlocks[blockIndex].text;
							const spinnerId = `spinner-${Date.now()}`;
							const emptyId = `empty-${Date.now()}`;
							const targetBlock = currentBlocks[blockIndex];
							const parentId = targetBlock.parentId;
							const newSpinner = { id: spinnerId, text: '', isRendered: false, isSpinner: true, role: 'ai', parentId };
							const newEmpty = { id: emptyId, text: '', isRendered: false, parentId, role: 'user' };
							currentBlocks.splice(blockIndex + 1, 0, newSpinner, newEmpty);
							setBlocks([...currentBlocks]);
							if (onGenerateAI) {
								onGenerateAI(text, spinnerId, emptyId, blockIndex);
							} else {
								(async () => {
									try {
										const answer = await sendToRemoteGPT(text);
										setBlocks(prev => prev.map(b => b.id === spinnerId ? { ...b, isSpinner: false, text: answer, isRendered: true, role: 'ai' } : b));
									} catch(err) {
										setBlocks(prev => prev.map(b => b.id === spinnerId ? { ...b, isSpinner: false, text: '[Ошибка при запросе к ИИ]', role: 'ai' } : b));
									}
								})();
							}
							setTimeout(() => setCursor(blockIndex + 2, -1), 100);
							return;
						}
						handleKeyDown(e);
					}}
					onKeyUp={(e) => {
						e.stopPropagation();
						if (handleKeyUp) handleKeyUp(e);
					}}
					onInput={(e) => {
						e.stopPropagation();
						handleInput(e);
					}}
					onPointerDown={(e) => {
							const target = e.target as HTMLElement;
							if (target.closest('.quiz-type-toggle')) {
									e.preventDefault();
									e.stopPropagation(); // Не даем событию уйти в document и моментально закрыть меню
									const rect = target.getBoundingClientRect();
									const quizSpan = target.closest('.inlineQuiz') as HTMLElement;
									setQuizMenu({ isOpen: true, x: rect.left, y: rect.bottom, node: quizSpan });
									return;
							}
					}}
					onClick={(e) => {
						const target = e.target as HTMLElement;
						// Игнорируем клики по стрелочкам сворачивания, чтобы не конфликтовать с ними
						if (target.closest('.tv-group-toggle')) return;
						if (e.altKey) {
							const wrapper = target.closest('.tv-block-wrapper');
							if (wrapper) {
								const id = wrapper.getAttribute('data-id');
								if (id) {
									e.preventDefault();
									e.stopPropagation();
									const current = minigraphIdsRef.current;
									if (current.includes(id)) {
										minigraphIdsRef.current = current.filter(x => x !== id);
									} else {
										minigraphIdsRef.current = [...current, id];
									}
									minigraphListenersRef.current.forEach(cb => cb());
								}
							}
						}
					}}
					onDragOver={handleDragOver}
					onDrop={(e) => {
						e.stopPropagation();
						handleDrop(e);
					}}
					onDragLeave={handleDragLeave}
					onBlur={(e) => { 
						if (!editorRef.current?.contains(e.relatedTarget as Node)) {
							const currentBlocks = syncDOMToState();
							const formattedContent = convertBlocksToUnifiedFormat(currentBlocks);
							if (onSave) onSave(formattedContent); 
						}
					}}
				>
					<svg width="0" height="0" style={{
						position: 'absolute', pointerEvents: 'none',
					}}>
							<filter id="gooey-selection">
									<feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
									<feColorMatrix in="blur" mode="matrix" values="
											1 0 0 0 0  
											0 1 0 0 0  
											0 0 1 0 0  
											0 0 0 19 -9" result="gooey" />
							</filter>
					</svg>



					{computedBlocks.map(block => {
							if (!block.isAIChatContainer || !block.highlightRects || block.highlightRects.length === 0) return null;
							
							return (
									<div key={`hi-grp-${block.id}`} style={{
											position: 'absolute', top: 0, left: 0, zIndex: 2, pointerEvents: 'none',
											filter: 'url(#gooey-selection)', opacity: 0.35,
									}}>
											{block.highlightRects.map((rect: any, idx: number) => (
													<div key={`hi-${block.id}-${idx}`} data-ephemeral="true" style={{
															position: 'absolute',
															top: rect.top - 2, left: rect.left - 4,
															width: rect.width + 8, height: rect.height + 4,
															backgroundColor: '#3b82f6', 
													}} />
											))}
									</div>
							);
					})}



					{aiHighlightRects.length > 0 && (
						<div style={{
							position: 'absolute', top: 0, left: 0, zIndex: 0, pointerEvents: 'none',
							filter: 'url(#gooey-selection)',
							opacity: 0.35,
						}}>
							{aiHighlightRects.map((rect, idx) => (
								<div
									key={`ai-hi-${idx}`}
									data-ephemeral="true"
									style={{
										position: 'absolute',
										top: rect.top - 2,
										left: rect.left - 4,
										width: rect.width + 8, 
										height: rect.height + 4,
										backgroundColor: '#3b82f6',
									}}
								/>
							))}
						</div>
					)}



					{dropIndicator && (
						<div
							contentEditable={false}
							style={{
								position: 'absolute',
								top: dropIndicator.top,
								left: dropIndicator.left,
								width: `${dropIndicator.width}px`,
								height: '2px',
								backgroundColor: '#ff4b4b',
								boxShadow: '0 0 6px #ff4b4b',
								pointerEvents: 'none',
								zIndex: 1000,
							}}
						/>
					)}


					{mainTree && <Box mt={bottomPadding} />}

					{computedBlocks.map((block, i) => {
						const isHidden = block.groupIds.some((id:any) => collapsedGroups.has(id));
						const depthPadding = block.depth * 28; 
						const isCollapsed = collapsedGroups.has(block.id);
						const isLastInGroup = block.parentId && (
							i === computedBlocks.length - 1 || 
							computedBlocks[i + 1].parentId !== block.parentId
						);
						const isUnderSuggestion = i > 0 && computedBlocks[i - 1].isAIChatContainer; 
						if (block.isAIChatContainer) {
							return (
								<SuggestionAIChat
									key={block.id}
									block={block}
									index={i}
									isHidden={isHidden}
									depthPadding={depthPadding}
									fontSize={fontSize}
									gCtx={gCtx}
									onUpdate={(msgs: any) => {
										setBlocks((prev: DomBlock[]) => prev.map(b => b.id === block.id ? { ...b, chatMessages: msgs } : b));
									}}
									onAttach={(msgs: any, options?: any) => {
										if (activeSuggestionIdRef.current === block.id) {
											activeSuggestionIdRef.current = null;
											savedSelectionRef.current = null;
										}
										// ─── Режим "Insert Link" ───────────────────────────────
										if (options?.insertLink) {
											const topBlock = (msgs && msgs.length > 0) ? msgs[0] : null;
											const topText = topBlock?.text || '';
											const combinedText = `${options.selectedText || ''}\n@@@\n${topText}`;
											// ГЛАВНЫЙ ФИКС: переиспользуем ID самого верхнего блока
											// suggestion-дерева, а не создаём новый — чтобы <id=...>
											// в тексте и id реального блока совпадали.
											const newBlockId = topBlock?.id || `blk-${Date.now()}-${Math.random()}`;
											setBlocks((prev: DomBlock[]) => {
												const idx = prev.findIndex(b => b.id === block.id);
												if (idx === -1) return prev;
												let next = [...prev];
												next.splice(idx, 1, {
													id: newBlockId,
													text: combinedText,
													isRendered: false,
													isGroup: false,
													parentId: block.parentId,
												} as DomBlock);
												if (options.sourceBlockId && options.selectedText) {
													next = next.map(b => {
														if (
															b.id === options.sourceBlockId &&
															typeof b.text === 'string' &&
															b.text.includes(options.selectedText)
														) {
															return { ...b, text: b.text.replace(options.selectedText, `<id=${newBlockId}>`) };
														}
														return b;
													});
												}

												return next;
											});
											setAiHighlightRects([]);
											return;
										}



										// 1. Создаем карту для генерации новых уникальных ID для каждого блока
										const idMap = new Map();
										msgs.forEach((m: any) => idMap.set(m.id, `blk-${Date.now()}-${Math.random()}`));
										// 2. Формируем новые блоки, сохраняя их внутреннюю иерархию
										const newBlocks: DomBlock[] = msgs
											.filter((m: any) => !m.isSpinner)
											.map((m: any) => {
												// Если у блока был родитель внутри чата, берем его новый ID.
												// Если блок был корневым в чате, привязываем его к родителю контейнера.
												const newParentId = idMap.has(m.parentId) 
													? idMap.get(m.parentId) 
													: block.parentId;
												return {
													id: idMap.get(m.id),
													text: m.text,
													isRendered: m.isRendered,
													isGroup: m.isGroup,
													parentId: newParentId
												};
											});
										// 3. Вставляем сгенерированное дерево в основной стейт
										setBlocks((prev: DomBlock[]) => {
												const idx = prev.findIndex(b => b.id === block.id);
												if (idx === -1) return prev;
												const next = [...prev];
												// Удаляем сам блок AI-чата (1 элемент) и вставляем на его место всё дерево
												next.splice(idx, 1, ...newBlocks);
												return next;
										});
										// Убираем фоновые выделения
										setAiHighlightRects([]); 
								}}
									onCancel={() => {
										if (activeSuggestionIdRef.current === block.id) {
											activeSuggestionIdRef.current = null;
											savedSelectionRef.current = null;
										}
										setAiHighlightRects([]);
										setBlocks((prev: DomBlock[]) => prev.filter(b => b.id !== block.id));
									}}
								/>
							);
						}



						return (
							<React.Fragment key={block.id}>
								<TvBlock
									key={block.id}
									block={block}
									index={i}
									isHidden={isHidden}
									isCollapsed={isCollapsed}
									isLastInGroup={isLastInGroup}
									isUnderSuggestion={isUnderSuggestion}
									depthPadding={depthPadding}
									toggleGroup={toggleGroup}
									formatEditText={formatEditText}
									fontSize={fontSize}
									rootPath={rootPath}
									readOnly={readOnly}
									onCtrlButtonClick={(action: string, targetBlock: DomBlock) => {
										if (action === 'up' || action === 'down') {
											setBlocks(prev => {
												const direction = action === 'up' ? -1 : 1;
												const startIndex = prev.findIndex(b => b.id === targetBlock.id);
												if (startIndex === -1) return prev;
												// 1. Хелпер: проверяем, является ли блок потомком группы
												const isDescendant = (child: DomBlock, parentId: string) => {
													let curr = child.parentId;
													while (curr) {
														if (curr === parentId) return true;
														const parent = prev.find(b => b.id === curr);
														curr = parent ? parent.parentId : undefined;
													}
													return false;
												};
												// 2. Находим конец "чанка" (группа + все её потомки)
												const rootId = prev[startIndex].id;
												let endIndex = startIndex;
												for (let i = startIndex + 1; i < prev.length; i++) {
													if (isDescendant(prev[i], rootId)) endIndex = i;
													else break;
												}
												const chunkA = prev.slice(startIndex, endIndex + 1);
												if (direction === -1) {
													// === ДВИЖЕНИЕ ВВЕРХ ===
													if (startIndex === 0) return prev;
													let bEnd = startIndex - 1;
													let bStart = bEnd;
													// Если над нами свернутая группа, находим её начало (корень)
													let currId = prev[bEnd].parentId;
													while (currId) {
														if (collapsedGroups.has(currId)) {
															bStart = prev.findIndex(b => b.id === currId);
														}
														const p = prev.find(b => b.id === currId);
														currId = p ? p.parentId : undefined;
													}
													const chunkB = prev.slice(bStart, bEnd + 1);
													// Наследуем parentId от места, куда встаем
													const newChunkA = [...chunkA];
													newChunkA[0] = { ...newChunkA[0], parentId: prev[bStart].parentId };
													return [...prev.slice(0, bStart), ...newChunkA, ...chunkB, ...prev.slice(endIndex + 1)];
												} else {
													// === ДВИЖЕНИЕ ВНИЗ ===
													if (endIndex === prev.length - 1) return prev;
													let bStart = endIndex + 1;
													let bEnd = bStart;
													// Если под нами свернутая группа, перепрыгиваем через всех её потомков
													if (prev[bStart].isGroup && collapsedGroups.has(prev[bStart].id)) {
														const nextRootId = prev[bStart].id;
														for (let i = bStart + 1; i < prev.length; i++) {
															if (isDescendant(prev[i], nextRootId)) bEnd = i;
															else break;
														}
													}
													const chunkB = prev.slice(bStart, bEnd + 1);
													const newChunkA = [...chunkA];
													newChunkA[0] = { ...newChunkA[0], parentId: prev[bStart].parentId };
													return [...prev.slice(0, startIndex), ...chunkB, ...newChunkA, ...prev.slice(bEnd + 1)];
												}
											});
										} else if (action === 'send') {
											const idx = blocks.findIndex(b => b.id === targetBlock.id);
											if (idx !== -1) insertAIBlocks(idx, '');
										} else if (action === 'parse') {
											setBlocks(prev => prev.map(b => b.id === targetBlock.id ? { ...b, isRendered: !b.isRendered } : b));
										}
									}}
								/>
							</React.Fragment>
						);
					})}

					{mainTree && <Box mb={bottomPadding} />}
				</div>
			</Box>
		</GraphCtx.Provider>
  );
});