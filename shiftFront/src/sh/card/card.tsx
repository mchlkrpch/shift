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
  VStack,
} from "@chakra-ui/react";
import {
  Clip
} from '../clip';
import {
  getGroupTp,
  onKeyDownCb,
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


export const contentCSS = css`
.chakra-stack{
  scrollbar-width: none;
}

[role="textbox"]{
  outline: none;
  border: none;
  tab-index: 0;
  display: flex;
  flex-direction: column;
  font-family: Roboto mono;
  overflow-x: auto;
  white-space: nowrap;
  contain: content;
  scrollbar-width: none;
}

[data-scope="accordion"]{
  border-bottom: none;
  padding: 0;
}

.sh_string{
  height: 20px;
  border-bottom: 1px solid color-mix(in srgb, #555 25%, transparent);
  border-style: dotted;
  overflow: hidden;
  width: fit-content;
  height: fit-content;
  white-space: nowrap;
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
          <Card id={t} content={ns[t]} options={{stats:false,inner:true}}/>
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
}

export const Card = forwardRef(({
  id,
  content,
  options,
}: shCardProps, ref: any) => {
  // Card to display content either as code or visual card
  if (content === undefined) return <></>;


  const gCtx=useGraphCtx()as any;
  const{ns,setNs}=gCtx;
  // content to displays
  const [c,setC]=useState(content);
  // if hovered - display upper tools
  const [hovered,setHovered]=useState(false);
  // if edit mode - editable div
  const [isEdit,setIsEdit]=useState(false);
  // cur displayed option among all possiblilities 
  const [option,setOption]=useState(0) as any;
  // path of inner term (within parent term)
  const [path,setPath]=useState([id]) as any;
  // if not hide - display opposite side of card
  const [hide,setHide]=useState(true) as any;
  // current zoom of card's content (sz in px)
  const [fontSize,setFontSize]=useState(12) as any;
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
  useImperativeHandle(ref,()=>({
    focus: async()=>await setIsEdit(true),
  }));


  // list[str]: of forward sides of card-group
  const fwdParts = groupTp==='multiple_bwd'? c
    .split(RegExp(`${OPTION_SPLIT_SYM}`))
    .map((_:any,i)=>`${i+1}`)
    : c
    .split(RegExp(`${OPTION_SPLIT_SYM}`))
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
  let bwd_content:string = (hide===false||options.textEdit===true)
    ? innerC.split('@@@').slice(1).join('')
    : '';

  const isHTML_set = useRef(false);

  useEffect(()=>{
    if ((isEdit||options?.textEdit === true) && !isHTML_set.current) {
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
          if (isEdit) {
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

    if (!isEdit && options?.textEdit !== true) {isHTML_set.current = false;}
  }, [isEdit, c, options?.textEdit]);


  const onBlurCb=async()=>{
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
    await setIsEdit(v=>!v);
  }


  const OptionSwitcher:any=(<>
      {(groupTp!=="multiple_fwd")&&(
      <Accordion.Root collapsible defaultValue={[""]}
        mt={options.textEdit===true?'50px':0}
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
              }}>
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
              : (<Box key={i} p={0} onClick={()=>setOption(i)}>
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

  
  const CardBody = <div className={'editor'}
    style={{fontSize:`${fontSize}px`}}
    onClick={async ()=>setIsEdit(true)}>
    {options?.textEdit===true?(
      <HStack justifyContent={'stretch'} alignItems={'stretch'} w={'100%'}>
        <Box flex={1} maxW={'50%'} w={'50%'} minW={0}>
          <div
            ref={inputRef}
            role='textbox'
            contentEditable
            suppressContentEditableWarning={true}
            defaultValue={c}
            onBlur={onBlurCb}
            onKeyDown={onKeyDownCb}
            style={{
              width: '100%',
              marginTop: options.textEdit===true?'50px':0,
            }}
          />
        </Box>
        <Separator orientation={'vertical'} h={'auto'} minH={'100%'} w={'1px'} />
        <Box flex={1} w={'50%'} minW={0} pl={'10px'}>
          {OptionSwitcher}
          <Box w={'100%'} overflowX={'auto'}>
            <Sh value={bwd_content}/>
          </Box>
        </Box>
      </HStack>
    ):(
      <>
        {isEdit?(
          <div
            ref={inputRef}
            role='textbox'
            contentEditable
            suppressContentEditableWarning={true}
            defaultValue={c}
            onBlur={onBlurCb}
            onKeyDown={onKeyDownCb}
          />
        ):(
          <>
            {OptionSwitcher}
            <Sh value={bwd_content}/>
          </>
        )}
      </>
    )}
  </div>


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


  // link inside card's code editor
  if (options?.inner===true) {
    return (<span className='card_inline_link'>{fwdParts[0]}</span>)
  }

  return (
    <CardCtx.Provider value={cardCtx}>
      <VStack
        css={contentCSS}
        className={'cardContent'}
        onMouseEnter={()=>setHovered(true)}
        onMouseLeave={()=>setHovered(false)}>
        {CardBody}
        {options?.showStats && CardStats}
      </VStack>
    </CardCtx.Provider>
  )
});
