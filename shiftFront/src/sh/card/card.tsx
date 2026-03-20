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
  Spacer,
} from "@chakra-ui/react";
import {
  Clip
} from '../clip';
import {
  getGroupTp,
  getPreviewStyle,
  onKeyDownCb,
  Sh,
  type GroupTp,
  type PreviewTp,
} from "./utility";
import { match } from "../../utility";
import { GraphCtx, useGraphCtx } from "../../App";
import { renderToString } from "react-dom/server";
import { Cell } from "./cell";



export const cardStyle = css`
font-size: 12px;
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
  background-color: color-mix(in srgb, var(--chakra-colors-blue-500) 15%, transparent);
  padding: 0px 2px;
  border-radius: 4px;
  border: 1px solid color-mix(in srgb, var(--chakra-colors-blue-500) 5%, transparent);
  color: var(--chakra-colors-blue-500);
}
.fit{
  display:flex;
  width:fit-content;
  height:fit-content;
  gap:4px;
}
`;



export declare type shCardProps = {
  id: string,      // id to edit content in backend
  content: string, // content itself
  tp: PreviewTp,   // how to preview group type
}

const Path:any=(
  {path}:any,
)=>{
  const {
    ns,
  }=useGraphCtx()as any;
  const {
    setPath,setC,
  }=useCardCtx()as any;
  return(
    <>
      <BreadcrumbRoot>
        <BreadcrumbList gap={'4px'} fontSize={'10px'}>
          {path.map((t:any,i:number)=>(
            <span key={t} className='fit'>
              <BreadcrumbLink
                key={t}
                onClick={(e:any)=>{
                  e.stopPropagation();
                  setPath(path.slice(0,i+1));
                  setC(ns[t])
                }}
              >
                <Card id={t}content={ns[t]} tp={'embed'}/>
              </BreadcrumbLink>
              {i!==path.length-1&&(
                <BreadcrumbSeparator key={'t'+t}>/</BreadcrumbSeparator>
              )}
            </span>
          ))}
        </BreadcrumbList>
      </BreadcrumbRoot>
    </>
  )
}

interface CardCtxI{
  path: any[],setPath:(p:any[])=>any[],
  c:string,setC:(t:string)=>void,
};

export const CardCtx = createContext<CardCtxI|null>(null);
export const useCardCtx = ()=>{
  const ctx = useContext(CardCtx);
  if (!ctx) {
    throw new Error('use graph context');
  }
  return ctx;
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
    ns,setNs,
  }=gCtx;
  const [c,setC]=useState(content);
  const [isEdit,setIsEdit]=useState(false);
  const [option,setOption]=useState(0) as any;
  const [path,setPath]=useState([id]) as any;

  const inputRef=React.createRef() as any;
  const previewStyle = getPreviewStyle(tp)
  const groupTp: GroupTp = getGroupTp(c);

  const onBlurCb=async()=>{
    const newC:string=[...inputRef.current.children]
      .map((ch: any)=>{
        if(ch.children.length>=1) {
          return [...ch.childNodes]
            .map((n:any)=>(
              n.nodeType === Node.TEXT_NODE?(
                n.textContent
              ):(n.className==='inlineCell')?(
                `<id=${ch.children[0]?.id}>`
              ):n.textContent
            ))
            .join('');
        }
        return ch.innerText;
      })
      .join('\n');
    await setC(newC)
    ns[path[path.length-1]]=newC;
    await setNs(ns);
    await setIsEdit(v=>!v);
  }

  const fwdParts = groupTp==='multiple_bwd'?c
      .split(/===/)
      .map((_:any,i)=>`${i+1}`)
    : c
      .split(/===/)
      .map((n:any)=>n
        .split('---')[0]
        .trim())

  const innerC: string = match(groupTp, {
    'single': c,
    'multiple_fwd': fwdParts.join(' / ')
      + '\n---\n'
      + c.split('===')[0].split('---').slice(1),
    'multiple_bwd': c.split('===')[0].split('---')[0]
      + '\n---\n'
      + c.split('===')[option]
        .split('---')
        .slice(1)
        .join(''),
    'multiple': c.split('===')[option],
  })

  const cardCtx = useMemo(() => ({
    path: path,
    setPath: setPath,
    c:c,
    setC: setC
  }), [path, c, setPath, setC]);

  useEffect(()=>{
    if (isEdit){
      const mergedTxt = `${c.split('\n').map((t:any)=>{
        return t === ''
          ? `<br>`
          : `<div class="sh_string"}>${t}</div>`;
      }).join('')}`;
      const html=mergedTxt
        .split(/(<id=[^>]*>)/)
        .map((n:any)=>{
          if (n.slice(0,3)==='<id') {
            return renderToString(
              <GraphCtx.Provider value={gCtx}>
                <CardCtx.Provider value={cardCtx}>
                  <Cell id={n.slice(4,n.length-1)}/>
                </CardCtx.Provider>
              </GraphCtx.Provider>
            )
          }
          return n;
        })
        .join('');
      inputRef.current.innerHTML=html;
      inputRef.current.focus();
    }
  },[isEdit,c,cardCtx])

  useImperativeHandle(ref,()=>({
    focus: async()=>await setIsEdit(true),
  }));

  if (tp==='embed') {
    return (<span onClick={()=>{}}>
      {fwdParts[0]}
    </span>)
  }

  const UpperTools:any=(
    <HStack gap={'3px'}>
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
      <Spacer/>
      <Clip
        value={c}
        props={{variant:'ghost',h:'20px',maxW:'20px',minW:'20px'}}
      />
    </HStack>);

  return (
    <CardCtx.Provider value={cardCtx}>
      <div css={cardStyle} style={previewStyle}
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
            <Sh value={innerC}/>
          </>
        )}
      </div>
    </CardCtx.Provider>
  )
});
