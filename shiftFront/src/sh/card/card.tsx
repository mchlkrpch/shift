/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  Accordion,
  Box,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbRoot,
  BreadcrumbSeparator,
  HStack,
  IconButton,
  Separator,
  Spacer,
  Text,
} from "@chakra-ui/react";
import {
  Clip
} from '../clip';
import {
  getGroupTp,
  OPTION_SPLIT_SYM,
  Sh,
  SIDE_SPLIT_SYM,
  type GroupTp,
} from "./utility";
import { match } from "../../utility";
import { GraphCtx, useGraphCtx } from "../../App";
import { renderToString } from "react-dom/server";
import { Cell } from "./cell";
import '@xyflow/react/dist/style.css';
import { IoMdHeart, IoMdHeartEmpty } from "react-icons/io";
import { FaRegCommentAlt } from "react-icons/fa";
import { createPortal } from 'react-dom';
import { FaChevronRight } from 'react-icons/fa';
import { LuChevronLeft, LuDot, LuScan } from 'react-icons/lu';


export const dropMenuCSS=css`
//////////////////////////////////////////////////////
// Special sym dropped menu style
// when you press special key in textbox you will see
// options to insert inside your's card code
//////////////////////////////////////////////////////

.menuFrame{
  position: fixed;
  backdrop-filter:blur(20px);
  background-color: color-mix(in srgb, #223 60%, transparent);
  border: 1px solid color-mix(in srgb, #666 60%, transparent);
  border-radius: 5px;
  padding: 5px;
  max-height: 200px;
  overflow-y: auto;
  min-width: 150px;

  display: flex;
  flex-direction: column;
  gap: 5px;

  font-weight: 400;
  z-index: 12000;
}

.menuFrame .tip{
  font-size: 11px;
  opacity: 0.3;
  font-weight: 400;
}

.item {
  width: 100%;
  font-size:12px;
  display:flex;
  align-items:center;
  gap: 8px;
  border-radius: 3px;
  cursor: pointer;
}
`


export const contentCSS = css`
position: relative;

width: 100%;


.chakra-stack{
  scrollbar-width: none;
}[role="textbox"]{
  outline: none;
  border: none;
  tab-index: 0;
  display: block;
  flex-direction: column;
  font-family: Roboto mono;
  overflow-x: hidden;
  white-space: pre-wrap;
  contain: content;
  scrollbar-width: none;
}

[data-scope="accordion"]{
  border-bottom: none;
  padding: 0;
}

.sh_string{
  border-bottom: 1px solid color-mix(in srgb, #555 25%, transparent);
  border-style: dotted;
  width: fit-content;
  height: fit-content;
  white-space: pre-wrap;
  word-break: break-word;

  width: 100%;
  height: auto;
}

.selectedOption{
  opacity: 1.0;
  text-decoration: underline;
}

.inlineCell{
  display: inline-block;
	width: fit-content;
	height: fit-content;
  padding: 0px 2px;
  border-radius: 4px;
  color: var(--chakra-colors-blue-500);
}


.pale{
  display: flex;
  opacity: 0.4;
}
.pale:hover{
  opacity: 1.0;
}


//////////////////////////////////////////////////////
// card content 
//////////////////////////////////////////////////////

.cardContent{
  gap: 0;
  border-radius: 0;
  padding: 0;
  alignItems: start;
}

.editor{
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
  width: 100%;
}


//////////////////////////////////////////////////////
// card stats
//////////////////////////////////////////////////////

.cardStats {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 0px 5px;
}


.statButton {
  font-size: 16px;
  font-weight: 600;
  padding-right: 2px;
  height: 23px;
  gap: 4px;
}

.buttonIcon{
  width: 13px;
  height: 13px;
}



//////////////////////////////////////////////////////
// breadcrumb 
//////////////////////////////////////////////////////

.card_inline_link:hover{
  text-decoration: underline;
  cursor: pointer;
}

.chakra-breadcrumb__list {
  gap: 4px;
  font-size: 10px;
  font-weight: 300;
  display:flex;
  flex-direction: row;
}

.chakra-breadcrumb__link {
  gap: 4px;
}


//////////////////////////////////////////////////////
// options switcher
//////////////////////////////////////////////////////

.optionsTrigger{
  width: 100%;
  gap: 0;
}
`;

// ============================================================================
// CONTEXT MENU (Custom Dropdown Logic)
// ============================================================================

export interface MenuItem {
	id?: string;
	el?: React.ReactNode | 'separator';
	children?: MenuItem[];
	onClick?: (e: React.MouseEvent<HTMLDivElement> | any, data?: any) => void;
	disabled?: boolean;
	danger?: boolean;
	shortcut?: string | React.ReactNode;
	data?: any;
}

export interface MenuProps{
	isOpen: boolean;
	x: number;
	y: number;
	items: MenuItem[];
	onClose: () => void;
	onAction?: (itemId: string, data?: any) => void;
	width?: number;
	zIndex?: number;
}

export const useContextMenu = () => {
	const[menu, setMenu] = useState<any>({ isOpen: false, x: 0, y: 0 });

	const open = useCallback((e: any) => {
		e.preventDefault();
		setMenu({ isOpen: true, x: e.clientX, y: e.clientY });
	},[]);

	const close = useCallback(() => {
		setMenu((prev: any) => ({ ...prev, isOpen: false }));
	},[]);

	return {
		menu, open, close,
		props: {
			isOpen: menu.isOpen,
			x: menu.x,
			y: menu.y,
			onClose: close,
		},
	};
};

const normalizeItems = (menuItems: MenuItem[], prefix = 'item-'): MenuItem[] => {
	return menuItems.map((item, index) => {
		const id = item.id ?? `${prefix}${index}`;
		return {
			...item,
			id,
			children: item.children ? normalizeItems(item.children, `${id}-`) : undefined,
		};
	});
};

export const ContextMenu = React.forwardRef(({
	isOpen,
	x,
	y,
	items,
	onClose,
	onAction,
}:any,ref:any)=>{
	const menuRef = useRef<HTMLDivElement>(null);
	const[pt,setPt] = useState<string[]>([]);
	const[focusedIndex, setFocusedIndex] = useState<number>(0);
	const normalizedItems = useMemo(() => normalizeItems(items), [items]);

	useImperativeHandle(ref,()=>({
		setPath:(pt:any)=>setPt(pt),
	}))

	const currentItems = useMemo(() => {
		let current = normalizedItems;
		for (const id of pt) {
			const parent = current.find((i) => i.id === id);
			if (parent?.children) current = parent.children;
			else break;
		}
		return current;
	}, [normalizedItems, pt]);

	useEffect(() => {
		let first = 0;
		while (first < currentItems.length && (currentItems[first].el === 'separator' || currentItems[first].disabled)) {
			first++;
		}
		setFocusedIndex(first < currentItems.length ? first : 0);
	}, [pt, currentItems]);

	useEffect(() => {
		if (!isOpen) return;
		const handler = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				onClose();
				setPt([]);
			}
		};
		document.addEventListener('mousedown', handler);
		return () => document.removeEventListener('mousedown', handler);
	}, [isOpen, onClose]);

	useEffect(() => {
		if (!isOpen) return;
		const onKey = (e: KeyboardEvent) => {
			const activeTag = document.activeElement?.tagName.toLowerCase();
			const isInput =['input', 'textarea', 'select'].includes(activeTag || '');

			if (e.key === 'Escape') {
				if (pt.length > 0) {
					setPt((prev) => prev.slice(0, -1));
				} else {
					onClose();
				}
				return;
			}

			if (e.key === 'ArrowDown') {
				e.preventDefault();
				let next = focusedIndex + 1;
				while (next < currentItems.length && (currentItems[next].el === 'separator' || currentItems[next].disabled)) {
					next++;
				}
				if (next < currentItems.length) setFocusedIndex(next);
			} else if (e.key === 'ArrowUp') {
				e.preventDefault();
				let prev = focusedIndex - 1;
				while (prev >= 0 && (currentItems[prev].el === 'separator' || currentItems[prev].disabled)) {
					prev--;
				}
				if (prev >= 0) setFocusedIndex(prev);
			} else if (e.key === 'ArrowRight' && !isInput) {
				e.preventDefault();
				const item = currentItems[focusedIndex];
				if (item?.children && item.children.length > 0) {
					setPt((prev) => [...prev, item.id!]);
				}
			} else if (e.key === 'ArrowLeft' && !isInput) {
				e.preventDefault();
				if (pt.length > 0) {
					setPt((prev) => prev.slice(0, -1));
				}
			} else if (e.key === 'Enter' && !isInput) {
				e.preventDefault();
				const item = currentItems[focusedIndex];
				if (item && item.el !== 'separator' && !item.disabled) {
					if (item.children && item.children.length > 0) {
						setPt((prev) =>[...prev, item.id!]);
					} else {
						item.onClick?.(e, item.data);
						if (item.id) {
							onAction?.(item.id, item.data);
						}
						onClose();
						setPt([]);
					}
				}
			}
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	},[isOpen, pt, focusedIndex, currentItems, onClose, onAction]);

	if (!isOpen) return null;

	const getActiveItem = (): MenuItem | null => {
		if (pt.length===0) {
			return null;
		}
		let current = normalizedItems;
		let activeItem: MenuItem | null = null;
		for (const id of pt) {
			activeItem = current.find((i) => i.id === id) || null;
			if (activeItem?.children) current = activeItem.children;
		}
		return activeItem;
	};

	const handleItemClick = (e: React.MouseEvent<HTMLDivElement>, item: MenuItem) => {
		if (item.disabled || item.el === 'separator') return;
		if (item.children && item.children.length > 0) {
			setPt((prev) => [...prev, item.id!]);
			return;
		}
		const target = e.target as HTMLElement;
		const tagName = target.tagName.toLowerCase();
		if (['input', 'textarea', 'select', 'button'].includes(tagName)) {
			return;
		}

		item.onClick?.(e, item.data);
		if (item.id) {
			onAction?.(item.id, item.data);
		}
		onClose();
		setPt([]);
	};

	const renderMenuItem = (x:MenuItem, index: number) => {
		if (x.el==='separator'){
			return (<Separator key={x.id} borderColor={'color-mix(in srgb, var(--chakra-colors-fg) 30%, transparent)'}/>);
		}

		const hasChildren = !!x.children?.length;
		const isFocused = index === focusedIndex;
		const bgColor=x.danger
			? 'rgba(220, 38, 38, 0.2)'
			: 'color-mix(in srgb, blue 50%, transparent)';

		return (
			<div
				key={x.id}
				onClick={(e) => handleItemClick(e, x)}
				onMouseEnter={() => {
					if (!x.disabled) {
						setFocusedIndex(index);
					}
				}}
				className={'item'}
				style={{
					padding:x.disabled?'0px':'4px 6px',
					color:x.danger?'#fc8181':'inherit',
					background:isFocused&&!x.disabled? bgColor:'transparent',
				}}
			>
				{x.el}
				<Spacer/>
				{hasChildren&&<FaChevronRight size={10} opacity={.6}/>}
				{x.shortcut && (
				<span css={css`font-size: 10px; opacity: 0.5; margin-left: auto;`}>
					{x.shortcut}
				</span>)}
			</div>
		);
	};

	const activeParentItem = getActiveItem();

	return createPortal(
		<span ref={menuRef} css={dropMenuCSS}>
			<Box className='menuFrame' top={y} left={x}>
				<HStack className={'tip'} gap={'2px'}>
					{activeParentItem&&(<LuChevronLeft size={'12px'}/>)}
					{activeParentItem ? activeParentItem.el : 'cards to mention'}
				</HStack>
				{currentItems.map((x:any,i:number)=>renderMenuItem(x,i))}
			</Box>
		</span>,document.body
	);
})


const CardPath:any=({path}:any)=>{
  // path to subcard that previewed inside complex term
  const {ns}=useGraphCtx()as any;
  const {setPath, setC}=useCardCtx()as any;
  return(
    <BreadcrumbRoot>
    <BreadcrumbList>
      {path.map((t:any,i:number)=>(
        <BreadcrumbLink key={t+'_link'} onClick={(e:any)=>{
            e.stopPropagation();
            setPath(path.slice(0,i+1));
            setC(ns[t])
          }}>
          <Card id={t} content={ns[t]} options={{stats:false,inner:true}} focus={false}/>
          {i!==path.length-1&&(<BreadcrumbSeparator key={'sep'+t}>/</BreadcrumbSeparator>)}
        </BreadcrumbLink>))}
    </BreadcrumbList>
    </BreadcrumbRoot>
  )
}




interface CardCtxI{
  path: any[],setPath:(p:any[])=>any[],
  c:string,setC:(t:string)=>void,
};

export const CardCtx = createContext<CardCtxI|null>(null);
export const useCardCtx=()=>{
  const ctx = useContext(CardCtx);
  if (!ctx) {
    throw new Error('use graph context');
  }
  return ctx;
}

export declare type shCardProps = {
  id: string,      // id to edit content in backend
  content: string, // content itself
  options: any,    // how to preview group type
  focus?: boolean,
}

import { ID } from "appwrite";

const resolveCardId = (explicitId: string, _fallbackContent: string): string => {
  if (explicitId && explicitId.trim()) {
    return explicitId.trim();
  }
  return ID.unique();
};

export const Card = forwardRef(({
  id,
  content,
  options,
  focus=false,
}: shCardProps, ref: any) => {
  // Card to display content either as code or visual card
  if (content === undefined) return <></>;

  const gCtx=useGraphCtx()as any;
  const{ns,updateCardContent}=gCtx;
  // content to displays
  const [c,setC]=useState(content||'empty');
  // if hovered - display upper tools
  const [hovered,setHovered]=useState(false);
  // if edit mode - editable div
  const [isEdit,setIsEdit]=useState(focus);
  // cur displayed option among all possiblilities 
  const [option,setOption]=useState(0) as any;
  // path of inner term (within parent term)
  const[path,setPath]=useState([id]) as any;
  // if not hide - display opposite side of card
  const[hide,setHide]=useState(options.open?false:true) as any;
  // current zoom of card's content (sz in px)
  const [fontSize,setFontSize]=useState(options.fontSize?options.fontSize:12) as any;
  // const [visualize,setVisualize]=useState(false) as any;
  const [like,setLike]=useState(12) as any;
  // ref of editable div
  const inputRef=useRef(null) as any;
  const groupTp: GroupTp = getGroupTp(c);
  // ctx of the card
  const cardCtx = useMemo(()=>({
    path:path,setPath:setPath,
    c:c,setC:setC,
  }),[path,c,setPath,setC]);
  const[mentionMenu, setMentionMenu] = useState<{isOpen:boolean,query:string,
    x:number, y:number, range:Range|null}>({isOpen:false,query:'', x:0,y:0, range:null});

  const insertMention = useCallback((item: {id: string, text: string}) => {
    const sel = window.getSelection();
    if (!sel || !mentionMenu.range) return;
    sel.removeAllRanges();
    sel.addRange(mentionMenu.range);
    // delete '/', request text
    const r = mentionMenu.range;
    r.setStart(r.startContainer, Math.max(0, r.startOffset - mentionMenu.query.length - 1));
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
  },[mentionMenu]);

  const mentionMenuItems = useMemo(() => {
    const q = mentionMenu.query.toLowerCase();
    const opts: MenuItem[] =[];
    Object.keys(ns).forEach(nid => {
      const cardContent = ns[nid] || '';
      const fwdText = cardContent.split('\n')[0] || 'empty';
      
      if (fwdText.toLowerCase().includes(q) || nid.toLowerCase().includes(q)) {
        const cardOpts = cardContent.split(OPTION_SPLIT_SYM);
        
        if (cardOpts.length > 1) {
          // Если есть варианты выбора, делаем вложенное меню
          opts.push({
            id: nid,
            el: fwdText,
            children: cardOpts.map((optStr: any, i: number) => {
              const optFwd = optStr.split(SIDE_SPLIT_SYM)[0].trim();
              const optText = optFwd.split('\n')[0] || `Option ${i + 1}`;
              return {
                id: `${nid}:${i}`,
                el: optText,
                onClick: () => insertMention({ id: `${nid}:${i}`, text: optText })
              };
            })
          });
        } else {
          // Прямая вставка для обычной карточки
          opts.push({
            id: nid,
            el: fwdText,
            onClick: () => insertMention({ id: nid, text: fwdText })
          });
        }
      }
    });

    if (opts.length === 0) {
      opts.push({ id: 'no-results', el: <Text className='tip'>no cards match</Text>, disabled: true });
    }

    return opts;
  }, [ns, mentionMenu.query, insertMention]);


  // list[str]: of forward sides of card-group
  const fwdParts = groupTp==='multiple_bwd'? c
    ?.split(RegExp(`${OPTION_SPLIT_SYM}`))
    .map((_:any,i)=>`${i+1}`)
    : c
    ?.split(RegExp(`${OPTION_SPLIT_SYM}`))
    .map((n:any)=>n
      .split(SIDE_SPLIT_SYM)[0]
      .trim())


  // str: of cur card inside card-group
  const innerC: string = match(groupTp, {
    'single': c,
    'multiple_fwd': fwdParts.join(' / ')
      + `\n${SIDE_SPLIT_SYM}\n`
      + c
        .split(OPTION_SPLIT_SYM)[0]
        .split(SIDE_SPLIT_SYM)
        .slice(1),
    'multiple_bwd': c
      .split(OPTION_SPLIT_SYM)[0]
      .split(SIDE_SPLIT_SYM)[0]
      + '\n@@@\n'
      + c
        .split(OPTION_SPLIT_SYM)[option]
        .split(SIDE_SPLIT_SYM)
        .slice(1)
        .join(''),
    'multiple': c.split(OPTION_SPLIT_SYM)[option],
  })


  // str: cur backward side of the card
  let bwd_content:string = (hide===false||options.twoSides===true)
    ? (innerC||'').split('@@@').slice(1).join('')
    : '';

  const isHTML_set = useRef(false);

  const onBlurCb = async () => {
    const newC: string = [...inputRef.current.children]
      .map((ch: any) => {
        if (ch.children.length >= 1) {
          return [...ch.childNodes].map((n: any) => {
            if (n.id && n.className === 'inlineCell') {
              const parts = n.id.split(':');
              return parts.length === 2 ? `<id=${parts[0]}:${parts[1]}>` : `<id=${n.id}>`;
            }
            return n.nodeType === Node.TEXT_NODE ? n.textContent : n.textContent;
          }).join('');
        }
        return ch.innerText;
      })
      .join('\n');

    const chunks = newC.split('~~~');
    const currentCardContent = chunks[0];
    const currentCardId = path[path.length-1];

    // Парсим карточки, которые юзер хочет создать пачкой (через ~~~)
    const newBlocksToInsert: any[] = [];
    
    for (let i = 1; i < chunks.length; i++) {
      const chunk = chunks[i];
      const newlineIndex = chunk.indexOf('\n');
      let newId = '', newText = '';
      
      if (newlineIndex === -1) {
        newId = chunk;
      } else {
        newId = chunk.substring(0, newlineIndex).trim();
        newText = chunk.substring(newlineIndex + 1);
      }

      const finalId = resolveCardId(newId, newText);
      if (finalId) {
        // Формируем структуру блока для дерева
        newBlocksToInsert.push({ 
          id: finalId, 
          type: 'card', 
          metainfo: { content: newText } 
        });
      }
    }

    // 1. Обновляем локальный стейт (чтобы UI моргнул мгновенно)
    setC(currentCardContent);
    
    // 2. ОТПРАВЛЯЕМ ИЗМЕНЕНИЯ В ЦЕНТРАЛЬНОЕ ДЕРЕВО (Singular Source of Truth)
    if (updateCardContent) {
      updateCardContent(currentCardId, currentCardContent, newBlocksToInsert);
    } else {
      console.warn("updateCardContent is missing in GraphCtx!");
    }

    // 3. Вызываем внешний хук (если кто-то ждет новых ID)
    if (options.onCardsCreated && newBlocksToInsert.length > 0) {
      options.onCardsCreated(newBlocksToInsert.map(b => b.id));
    }

    if (options.twoSides === false) {
      setIsEdit(false);
    }
  };


  const localOnKeyDown = (e:React.KeyboardEvent) => {
    if (e.altKey && e.key === 'ArrowUp') {
      e.preventDefault();
      if (options.onMove) options.onMove(-1);
      return;
    }
    if (e.altKey && e.key === 'ArrowDown') {
      e.preventDefault();
      if (options.onMove) options.onMove(1);
      return;
    }
    if (e.key === 'Escape') {
      // console.log("ESc!")
      if (isEdit) {
        onBlurCb()
        setIsEdit(false);
      }
    }
    // Логика выпадающего меню '/'
    if (mentionMenu.isOpen) {
      if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
        // Мы предотвращаем дефолт, чтобы каретка в contentEditable не прыгала
        // и чтобы Enter не переносил строку, когда мы в меню.
        // Дальше глобальный листенер ContextMenu перехватит этот евент.
        e.preventDefault(); 
      } else if (e.key === 'Escape') {
        e.preventDefault();
        // Escape тоже перехватывается ContextMenu (чтобы подняться наверх), 
        // так что здесь мы просто стопаем нативный прыжок фокуса
      } else if (e.key === 'Backspace') {
        if (mentionMenu.query.length === 0) {
          setMentionMenu(prev => ({ ...prev, isOpen: false }));
        } else {
          setMentionMenu(prev => ({ ...prev, query: prev.query.slice(0, -1) }));
        }
      } else if (e.key.length === 1) { // Если введена буква/символ
        setMentionMenu(prev => ({ ...prev, query: prev.query + e.key }));
      }
    } else if (e.key === '/') {
      setTimeout(() => {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0).cloneRange();
          const rect = range.getBoundingClientRect();
          setMentionMenu({
            isOpen: true,
            query: '',
            x: rect.left,
            y: rect.bottom+5,
            range: range 
          });
        }
      }, 10);
    }
  };


  const OptionSwitcher:any=(<>
    {(groupTp!=="multiple_fwd")&&(
      <Accordion.Root collapsible defaultValue={[""]}
        mt={options.twoSides===true?'10px':0}
        onClick={async(e:any)=>{
          e.stopPropagation();
          e.preventDefault();
        }}
      >
        <Accordion.Item value={fwdParts[option]}>
          <Accordion.ItemTrigger className='optionsTrigger'>
            {fwdParts.length>1&&(
              <Accordion.ItemIndicator mr={'5px'} >
                <Box
                  p={'0px'}
                >
                  {/* <Box w={'5px'} h={'5px'} bgColor={'whiteAlpha.300'} borderRadius={'5px'}/> */}
                  <LuScan size={'4px'} style={{height: '8px', minHeight: '8px', minWidth: '8px'}} opacity={0.3}/>
                </Box>
              </Accordion.ItemIndicator>
            )}
            <Box w={'100%'} fontWeight={600} onClick={(e:any)=>{
                e.stopPropagation()
                e.preventDefault()
                setHide((h:any)=>!h)
              }}
              onDoubleClick={()=>(
                setIsEdit(true)
              )}
              fontSize={`${fontSize}px`}
              >
              {path.length>1&&(
                <Box pl={'4px'} m={0}>
                  <CardPath path={path}/>
                </Box>)}
              <Sh value={fwdParts[option]||'empty'}/>
            </Box>
          </Accordion.ItemTrigger>

          <Accordion.ItemContent gap={0} p={0}>
          {fwdParts
            .map((f:any,i:number)=>(
            (i === option)
              ? (<span key={i}></span>)
              : (<Box
                  key={i}
                  onClick={()=>setOption(i)}
                  fontSize={`${fontSize}px`}
                  display={'flex'} flexDirection={'row'}
                  w={'100%'}
                  p={'2px 0px'}
                >
                <Box mr={'12px'} p={0} ml={'5px'} alignItems={'center'}>
                  <LuDot size={'4px'} style={{marginTop: '4px', height: '8px', minHeight: '8px', minWidth: '8px'}} opacity={0.2}/>
                </Box>

                <Accordion.ItemBody key={i} p={0} fontWeight={600}>
                  <Sh value={f}/>
                  {i !== fwdParts.length - 1 && (
                    <Separator/>
                  )}
                </Accordion.ItemBody>
              </Box>)
          ))}
          </Accordion.ItemContent>
        </Accordion.Item>
      </Accordion.Root>
    )}
  </>);


  // Editor card's code 
  const TextBox=<div
    ref={inputRef}
    role='textbox'
    contentEditable
    suppressContentEditableWarning={true}
    defaultValue={c}
    onBlur={onBlurCb}
    onKeyDown={localOnKeyDown}
    style={{
      width:'100%',
      marginTop: options.twoSides===true?'10px':0,
      flex: 1,
      padding: '0px 10px',
    }}/>

  
  const CardBody=(
    <div
      css={contentCSS}
      className={'editor'}
      onMouseEnter={()=>setHovered(true)}
      onMouseLeave={()=>setHovered(false)} 
      onClick={async ()=>{
        if (options.twoSides===false) {
          setIsEdit(true)
        }
      }}
      style={{
        fontSize:`${fontSize}px`,
        padding:options.padding||'0px',
        // ...options.style,
      }}>
      {/* Подключаем новый ContextMenu вместо ручной верстки */}
      <ContextMenu 
        isOpen={mentionMenu.isOpen}
        x={mentionMenu.x}
        y={mentionMenu.y}
        items={mentionMenuItems}
        onClose={() => setMentionMenu(prev => ({ ...prev, isOpen: false }))}
      />
      {/* Editable div + Card previewr */}
      {isEdit?(TextBox):(
        <HStack justifyContent={'stretch'} alignItems={'stretch'} w={'100%'} gap={0}>
          {/* If preview both edior and card at the same
          time preview through the vertical separator */}
          {options?.twoSides===true&&(<>
              {TextBox}
              <Separator orientation={'vertical'} h={'auto'} minH={'100%'} w={'1px'} />
          </>)}

          {/* Preview: card option switcher + backward preveiw if opened */}
          <Box flex={1} w={'50%'} minW={0} fontWeight={300} p={'0px'} fontSize={`${fontSize}px`}>
            {OptionSwitcher}
            <Sh value={bwd_content} />
          </Box>
        </HStack>
      )}
    </div>)


  const CardStats=<HStack className='cardStats' style={{opacity:hovered===true? 1:0}}>
    {(!isEdit)&&(
      <>
        <IconButton className={'statButton'} variant={'plain'}
          onClick={(e:any)=>{
            setLike((l:any)=>!l)
            e.stopPropagation();
          }}>
          {like?(<IoMdHeartEmpty className={'buttonIcon'}/>):(<IoMdHeart className={'buttonIcon'} />)}
          12k
        </IconButton>

        <IconButton className={'statButton'} variant={'plain'}>
          <FaRegCommentAlt style={{width:'13px',height:'13px'}}/> 38
        </IconButton>

        <Box className="pale">
          <Clip value={c}
            props={{
              variant:'ghost',
              h:'22px',maxW:'22px',minW:'22px',
              p:'5px',
              iconSz: '15px'}}
          />
        </Box>

        <Spacer/>

        <IconButton variant={'ghost'}
          onClick={(e:any)=>{
            setFontSize((sz:any)=>sz+1);
            e.stopPropagation();
          }}>+
        </IconButton>

        <IconButton className={'statButton'} variant={'ghost'}
          onClick={(e:any)=>{
            setFontSize((sz:any)=>Math.max(sz-1,10));
            e.stopPropagation();
          }}>-
        </IconButton>
      </>
    )}
  </HStack>


  useEffect(()=>{
    if ((isEdit||options?.twoSides === true) && !isHTML_set.current||focus) {
      isHTML_set.current = true; 
      const mergedTxt = `${c.split('\n').map((t:any)=>{
        return t === ''
          ? `<br>`
          : `<div class="sh_string"}>${t}</div>`;
      }).join('')}`;
      const html = mergedTxt
        .split(/(<id=[^>]*>)/)
        .map((n:any)=>(
          (n.slice(0,3)==='<id')
            ? renderToString(
              <GraphCtx.Provider value={gCtx}>
              <CardCtx.Provider value={cardCtx}>
              <Cell id={n.slice(4,n.length-1)}/>
              </CardCtx.Provider>
              </GraphCtx.Provider>)
            : n
        ))
        .join('');
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.innerHTML = html;
          if (isEdit||focus) {
            focus=false
            inputRef.current.focus();
            if (typeof window.getSelection !== "undefined" && typeof document.createRange !== "undefined") {
                const range = document.createRange();
                range.selectNodeContents(inputRef.current);
                range.collapse(false);
                const sel = window.getSelection();
                if (sel) {
                  sel.removeAllRanges();
                  sel.addRange(range);
                }
            }
          }
        }
      },0);
    }

    if (!isEdit && options?.twoSides !== true) {isHTML_set.current = false;}
  }, [isEdit, c, options?.twoSides, focus]);

  useEffect(()=>{
    if (focus) {
      const tryFocus = (attempts = 0) => {
        if (inputRef.current) {
          inputRef.current.focus();
        } else if (attempts < 15) {
          setTimeout(() => tryFocus(attempts + 1), 10);
        }
      }
      tryFocus();
    }
  },[inputRef])


  useImperativeHandle(ref,()=>({
    focus: async()=>await setIsEdit(true),
    getContent: ()=>c,
  }));

  // link inside card's code editor
  if (options?.inner===true) {
    const option = options?.option?options?.option:0; 
    return (<span className='card_inline_link'>{fwdParts[option]}</span>)
  }

  return (
    <CardCtx.Provider value={cardCtx}>
      {CardBody}
      {options?.showStats && CardStats}
    </CardCtx.Provider>
  )
});
