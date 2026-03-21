/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import React, {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState
} from 'react';
import {
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbRoot,
  BreadcrumbSeparator,
  HStack,
  IconButton,
  Spacer,
  VStack,
} from "@chakra-ui/react";
import {
  Clip
} from '../clip';
import {
  getGroupTp,
  getPreviewStyle,
  onKeyDownCb,
  OPTION_SPLIT_SYM,
  Sh,
  SIDE_SPLIT_SYM,
  type GroupTp,
  type PreviewTp,
} from "./utility";
import { match } from "../../utility";
import { GraphCtx, useGraphCtx } from "../../App";
import { renderToString } from "react-dom/server";
import { Cell } from "./cell";
import {
  LuChevronDown,
  LuChevronUp
} from "react-icons/lu";



export const cardStyle = css`
display: flex;
flex-direction: column;
background-color: color-mix(in srgb, #555 5%, transparent);

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
}
.sh_string{
  height: 20px;
  border-bottom: 1px solid color-mix(in srgb, #555 25%, transparent);
  border-style: dotted;
}
.option{
  padding: 0px 4px;
  border-radius: 3px;
  opacity: 0.3;
  min-width: fit-content;
  overflow: hidden;
  white-space: nowrap;
}
.option: hover{
  background-color: color-mix(in srgb, #555 55%, transparent);
}
.selectedOption{
  opacity: 1.0;
  background-color: color-mix(in srgb, #555 25%, transparent);
}
.optionsStack{
  gap: 2px;
  min-width: 0;
  overflow-x: auto;
}

.inlineCell{
  display: inline-block;
	width: fit-content;
	height: fit-content;
  // background-color: color-mix(in srgb, var(--chakra-colors-blue-500) 15%, transparent);
  padding: 0px 2px;
  border-radius: 4px;
  // border: 1px solid color-mix(in srgb, var(--chakra-colors-blue-500) 5%, transparent);
  color: var(--chakra-colors-blue-500);
}
.fit{
  display:flex;
  width:fit-content;
  height:fit-content;
  gap:4px;
}
.ref:hover{
  text-decoration: underline;
  cursor: pointer;
}
`;



const Path:any=({path}:any)=>{
  const { ns }=useGraphCtx()as any;
  const {
    setPath,
    setC,
  }=useCardCtx()as any;
  return(
    <BreadcrumbRoot>
    <BreadcrumbList gap={'4px'} fontSize={'10px'}>
    {path.map((t:any,i:number)=>(
      <span key={t}className='fit'>
        <BreadcrumbLink
          key={t}
          onClick={(e:any)=>{
            e.stopPropagation();
            setPath(path.slice(0,i+1));
            setC(ns[t])
          }}
        >
        <Card id={t}content={ns[t]}tp={'embed'}/>
        </BreadcrumbLink>

        {i!==path.length-1&&(
        <BreadcrumbSeparator key={'t'+t}>/</BreadcrumbSeparator>
        )}
      </span>
    ))}
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
  tp: PreviewTp,   // how to preview group type
}

export const Card = forwardRef(({
  id,
  content,
  tp,
}: shCardProps, ref: any) => {
  if (content === undefined) {
    return <></>;
  }
  const gCtx=useGraphCtx()as any;
  const{
    ns,
    setNs,
  }=gCtx;
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

  // ref of editable div
  const inputRef=React.createRef() as any;
  // dynamic styling of component
  const previewStyle = getPreviewStyle(tp);
  const groupTp: GroupTp = getGroupTp(c);

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

  const fwdParts = groupTp==='multiple_bwd'?c
      .split(RegExp(`${OPTION_SPLIT_SYM}`))
      .map((_:any,i)=>`${i+1}`)
    : c
      .split(RegExp(`${OPTION_SPLIT_SYM}`))
      .map((n:any)=>n
        .split(SIDE_SPLIT_SYM)[0]
        .trim())

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

  let hiddenInnerC:string = (hide===false)
    ? innerC.replace(RegExp(`${SIDE_SPLIT_SYM}`),'\n---\n')
    : innerC.split('@@@')[0];

  const cardCtx = useMemo(() => ({
    path:path,setPath:setPath,
    c:c,setC:setC,
  }), [path,c,setPath,setC]);

  useEffect(()=>{
    if (isEdit){
      const mergedTxt = `${c.split('\n').map((t:any)=>{
        return t === ''
          ? `<br>`
          : `<div class="sh_string"}>${t}</div>`;
      }).join('')}`;
      const html=mergedTxt
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
      inputRef.current.innerHTML=html;
      inputRef.current.focus();
    }
  },[isEdit,c,cardCtx])

  useImperativeHandle(ref,()=>({
    focus: async()=>await setIsEdit(true),
  }));

  if (tp==='embed') {
    return (<span className='ref'>
      {fwdParts[0]}
    </span>)
  }

  const UpperTools:any=(
    <HStack gap={'3px'}h={'30px'}>
      {hovered&&(
        <>
          {(groupTp!=="multiple_fwd"&&groupTp!=='single')&&(
            <HStack
              className={'optionsStack'}
              onClick={async(e:any)=>{
                e.stopPropagation();
                e.preventDefault();
              }}>
            {fwdParts.map((f:any,i:number)=>(
              <div key={i} onClick={()=>setOption(i)}
                className={i===option?'selectedOption option':'option'}>
                <Sh value={f}/>
              </div>
            ))}
            </HStack>
          )}
          <Spacer/>
          <Path path={path}/>
          <VStack h={'30px'}gap={0}>
            <IconButton
              fontSize={'16px'}
              variant={'ghost'} h={'15px'}minW={'22px'}
              onClick={(e:any)=>{
                setFontSize((sz:any)=>sz+1);
                e.stopPropagation();
              }}>
              <LuChevronUp
                style={{height:'17px',width:'17px'}}
              />
            </IconButton>
            <IconButton
              variant={'ghost'} h={'15px'}minW={'22px'}
              fontSize={'16px'}
              onClick={(e:any)=>{
                setFontSize((sz:any)=>Math.max(sz-1,10));
                e.stopPropagation();
              }}>
              <LuChevronDown
                style={{height:'17px',width:'17px'}}
              />
            </IconButton>
          </VStack>
          <IconButton
            variant={'ghost'} h={'30px'}minW={'30px'}
            onClick={(e:any)=>{
              setHide((h:any)=>!h);
              e.stopPropagation();
            }}
          >
            {hide===true?(
              <LuChevronDown/>
            ):(
              <LuChevronUp />
            )}
          </IconButton>
          <Clip
            value={c}
            props={{
              variant:'ghost',
              h:'30px',maxW:'20px',minW:'30px',
              p:'5px',
            }}
          />
        </>
      )}
    </HStack>);

  previewStyle.fontSize=`${fontSize}px`

  return (
    <CardCtx.Provider value={cardCtx}>
      <div css={cardStyle} style={previewStyle}
        onMouseEnter={()=>{
          setHovered(true);
        }}
        onMouseLeave={()=>{
          setHovered(false);
        }}
        onClick={async ()=>{
          await setIsEdit(true);
        }}
      >
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
            {UpperTools}
            <Sh value={hiddenInnerC}/>
          </>
        )}
      </div>
    </CardCtx.Provider>
  )
});
