/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import {
  createContext,
  forwardRef,
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


export const contentCSS = css`
position: relative;

//////////////////////////////////////////////////////
// Special sym dropped menu style
// when you press special key in textbox you will see
// options to insert inside your's card code
//////////////////////////////////////////////////////

.menuFrame {
  position: fixed;
  backdrop-filter:blur(10px);
  background-color: color-mix(in srgb, #333 60%, transparent);
  border: 1px solid color-mix(in srgb, #666 60%, transparent);
  border-radius: 5px;
  padding: 5px;
  max-height: 200px;
  overflow-y: auto;
  min-width: 150px;
}

.menuFrame tip{
 opacity: .3;
 font-weight: 400;
 font-size: 11px;
}




.chakra-stack{
  scrollbar-width: none;
}

[role="textbox"]{
  outline: none;
  border: none;
  tab-index: 0;
  // display: flex;
  display: block;
  flex-direction: column;
  font-family: Roboto mono;
  // overflow-x: auto;
  overflow-x: hidden;
  // white-space: nowrap;
  white-space: pre-wrap;
  contain: content;
  scrollbar-width: none;
}

[data-scope="accordion"]{
  border-bottom: none;
  padding: 0;
}

.sh_string{
  // height: 20px;
  border-bottom: 1px solid color-mix(in srgb, #555 25%, transparent);
  border-style: dotted;
  // overflow: hidden;
  width: fit-content;
  height: fit-content;
  // white-space: nowrap;
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
  // background-color: color-mix(in srgb, var(--chakra-colors-blue-500) 15%, transparent);
  // border: 1px solid color-mix(in srgb, var(--chakra-colors-blue-500) 5%, transparent);
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

export const Card = forwardRef(({
  id,
  content,
  options,
  focus=false,
}: shCardProps, ref: any) => {
  // Card to display content either as code or visual card
  if (content === undefined) return <></>;

  const gCtx=useGraphCtx()as any;
  const{ns,setNs}=gCtx;
  // content to displays
  const [c,setC]=useState(content||'empty');
  // if hovered - display upper tools
  const [hovered,setHovered]=useState(false);
  // if edit mode - editable div
  const [isEdit,setIsEdit]=useState(focus?true:false);
  // cur displayed option among all possiblilities 
  const [option,setOption]=useState(0) as any;
  // path of inner term (within parent term)
  const [path,setPath]=useState([id]) as any;
  // if not hide - display opposite side of card
  const [hide,setHide]=useState(true) as any;
  // current zoom of card's content (sz in px)
  console.log('options',options)
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
  const [mentionMenu, setMentionMenu] = useState<{isOpen:boolean,query:string,
    x:number, y:number, range:Range|null}>({isOpen:false,query:'', x:0,y:0, range:null});
  const[mentionIndex, setMentionIndex] = useState(0);
  const mentionOptions = Object.keys(ns)
    .filter(nid => ns[nid]?.toLowerCase().includes(mentionMenu.query.toLowerCase()))
    .map(nid => ({ id: nid, text: ns[nid].split('\n')[0] || 'empty' }));

  const insertMention=(item: {id: string, text: string})=>{
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
    setMentionMenu({ isOpen: false, query: '', x: 0, y: 0, range: null });
  };

  const localOnKeyDown = (e: React.KeyboardEvent) => {
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
    // 2. Логика выпадающего меню '/'
    if (mentionMenu.isOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(i => Math.min(i + 1, mentionOptions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (mentionOptions.length > 0) insertMention(mentionOptions[mentionIndex]);
      } else if (e.key === 'Escape') {
        setMentionMenu(prev => ({ ...prev, isOpen: false }));
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
          setMentionIndex(0);
        }
      }, 10);
    }
  };


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
    ? innerC.split('@@@').slice(1).join('')
    : '';

  const isHTML_set = useRef(false);


  const onBlurCb=async()=>{
    console.log("on blur")
    const newC:string=[...inputRef.current.children]
      .map((ch: any)=>(
        (ch.children.length>=1)
          ? [...ch.childNodes]
              .map((n:any)=>(
                n.nodeType === Node.TEXT_NODE?(
                  n.textContent
                ):(n.className==='inlineCell')?(
                  `<id=${ch.children[0]?.id}>`
                ):n.textContent
              ))
              .join('')
          : ch.innerText
      ))
      .join('\n');
    await setC(newC)
    ns[path[path.length-1]]=newC;
    await setNs(ns);
    if (options.twoSides===false) {
      await setIsEdit(v=>!v);
    }
  }


  const OptionSwitcher:any=(<>
    {(groupTp!=="multiple_fwd")&&(
      <Accordion.Root collapsible defaultValue={[""]}
        mt={options.twoSides===true?'50px':0}
        onClick={async(e:any)=>{
          e.stopPropagation();
          e.preventDefault();
        }}
      >
        <Accordion.Item value={fwdParts[option]}>
          <Accordion.ItemTrigger className='optionsTrigger'>
            <Box w={'100%'} onClick={(e:any)=>{
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
              <Sh value={fwdParts[option]}/>
            </Box>

            {fwdParts.length>1&&(
              <Accordion.ItemIndicator mr={'5px'}/>
            )}
          </Accordion.ItemTrigger>

          <Accordion.ItemContent gap={0} p={0}>
          {fwdParts
            .map((f:any,i:number)=>(
            (i === option)
              ? (<span key={i}></span>)
              : (<Box key={i} p={0} onClick={()=>setOption(i)} fontSize={`${fontSize}px`}>
                <Accordion.ItemBody key={i} p={0}>
                  <Sh value={f}/>
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
      marginTop: options.twoSides===true?'50px':0,
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
        console.log('here?')
        if (options.twoSides===false) {
          setIsEdit(true)
        }
      }}
      style={{fontSize:`${fontSize}px`}}>
      {/* menu with auxilary menu of insertion */}
      {mentionMenu.isOpen&&createPortal(
        <span css={contentCSS}>
          <Box className='menuFrame' left={mentionMenu.x} top={mentionMenu.y}>
            {/* Show all options if options.length > 0
            otherwise show 'no cards...' message */}
            {mentionOptions.length===0
              ? (<Text className='tip'>no cards to mention</Text>)
              : (<Text className='tip'>cards to mention</Text>)}
            {/* Display options */}
            {mentionOptions.map((opt,i) => (
              <Box key={i} p={'2px 5px'} borderRadius="sm" fontSize="sm" mt={'3px'}
                  bg={i===mentionIndex? 'blue.600':'transparent'}
                  cursor="pointer" 
                  onMouseDown={(e:any)=>{
                    e.preventDefault();
                    insertMention(opt);
                  }}> 
                {opt.text}
              </Box>
            ))}
          </Box>
        </span>
        , document.body)}
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
          <Box flex={1} w={'50%'} minW={0} pl={'10px'} fontSize={`${fontSize}px`}>
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
          // Если ref еще null, пробуем снова через 10мс (до 15 попыток)
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
    return (<span className='card_inline_link'>{fwdParts[0]}</span>)
  }

  return (
    <CardCtx.Provider value={cardCtx}>
      {CardBody}
      {options?.showStats && CardStats}
    </CardCtx.Provider>
  )
});
