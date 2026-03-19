/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState
} from 'react';
import {
  HStack,
  Spacer,
} from "@chakra-ui/react";
import {
  Clip
} from '../clip';
import {
  getGroupTp,
  getPreviewStyle,
  md2sh,
  Sh,
  type GroupTp,
  type PreviewTp,
} from "./utility";
import { match } from "../../utility";



export const cardStyle = css`
font-size: 12px;
display: flex;
flex-direction: column;
background-color: color-mix(in srgb, #555 5%, transparent);

.chakra-stack{
  scrollbar-width: none;
}
[role="textbox"] {
  outline: none;
  border: none;
  tab-index: 0;
  display: flex;
  flex-direction: column;
}
.sh_string{
  height: 20px;
  border-bottom: 1px solid color-mix(in srgb, #555 25%, transparent);
  border-style: dotted;
}
.option {
  padding: 0px 4px;
  border-radius: 3px;
  opacity: 0.3;

  min-width: fit-content;
  overflow: hidden;
  white-space: nowrap;
}
.option: hover {
  background-color: color-mix(in srgb, #555 55%, transparent);
}
.selectedOption {
  opacity: 1.0;
  background-color: color-mix(in srgb, #555 25%, transparent);
}
`;



export declare type shCardProps = {
  id: string,      // id to edit content in backend
  content: string, // content itself
  tp: PreviewTp,   // how to preview group type
}



export const Card = forwardRef(({
  // id,
  content,
  tp,
}: shCardProps, ref: any) => {
  const [c,setC]=useState(content);
  const [isEdit,setIsEdit]=useState(false);
  const [option,setOption]=useState(0) as any;

  const inputRef=React.createRef() as any;
  const previewStyle = getPreviewStyle(tp)
  const groupTp: GroupTp = getGroupTp(c);

  const onBlurCb = ()=>{
    setC([...inputRef.current.children]
        .map((ch: any)=>ch.innerText)
        .filter((t: string)=>t!=='\n')
        .join('\n'))
    setIsEdit(v=>!v);
  }

  const fwdParts = groupTp==='multiple_bwd'? c.split('===').map((_:any,i)=>`${i+1}`): c.split('===').map((n:any)=>n.split('---')[0].trim())

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

  useEffect(()=>{
    if (isEdit){
      inputRef.current.innerHTML=md2sh(c);
      inputRef.current.focus();
    }
  },[isEdit,c])

  useImperativeHandle(ref,()=>({
    focus: async()=>await setIsEdit(true),
  }));

  return (
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
        />
      ):(
        <>
          <HStack gap={0}>
            {groupTp!=="multiple_fwd"&&(
              <HStack
                gap={'2px'}
                minW={0}
                overflowX={'auto'}
                onClick={async (e:any)=>{
                  e.stopPropagation();
                  e.preventDefault();
                }}
              >
              {fwdParts.map((f:any,i:number)=>{
                return (
                  <div
                    key={i}
                    onClick={()=>setOption(i)}
                    className={i===option?'selectedOption option':'option'}
                  >
                    <Sh value={f}/>
                  </div>
                )
              })}
              </HStack>
            )}

            <Spacer/>
            <Clip
              value={c}
              props={{
                variant: 'ghost',
                size: undefined,
                h: '20px',
                maxW: '20px',
                minW:'20px',
              }}
            />
          </HStack>
          <Sh value={innerC}/>
        </>
      )}
    </div>
  )
});
