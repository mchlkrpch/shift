/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";

import React, { useEffect, useState } from 'react';
import {
  HStack,
  Spacer,
} from "@chakra-ui/react";
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { Clip } from '../clip';
import { getGroupTp, getPreviewStyle, shComponents, shRemark, type GroupTp, type PreviewTp } from "./utility";

/*
==================================================
styling
main <div> style
==================================================
*/
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

// describe preview type
export declare type shCardProps = {
  id: string, // id to edit content in backend
  content: string, // content itself
  tp: PreviewTp, // how to preview group type
}

/*
==================================================
main component
==================================================
*/
export const Card = ({
  // id,
  content,
  tp,
}: shCardProps) => {
  const [c,setCurContent] = useState(content);
  const [isEdit,setIsEdit]=useState(false);
  const textareaRef=React.createRef() as any;
  const [option,setOption]=useState(0) as any;

  let groupTp: GroupTp = getGroupTp(c);

  let fronts = c.split('===').map((n:any)=>n.split('---')[0].trim())
  if (groupTp ==='multiple_bwd') {
    fronts=c.split('===').map((_:any,i)=>`${i+1}`);
  }

  let previewStyle = getPreviewStyle(tp)

  useEffect(()=>{
    if (isEdit){
      textareaRef.current.innerHTML=(
        `${c.split('\n').map((t:any)=>{
          if (t === '') {
            return (`<br>`);
          } else {
            return (`<div class="sh_string"}>${t}</div>`)
          }
        }).join('')}`
      )
      textareaRef.current.focus();
    }
  },[isEdit])

  return (
    <div css={cardStyle} style={previewStyle}
      onClick={async ()=>{
        await setIsEdit(true);
      }}
    >
      {isEdit?(
        <div
          role='textbox'
					contentEditable
					suppressContentEditableWarning={true}
          ref={textareaRef}
          defaultValue={c}
          onBlur={()=>{
            console.log(textareaRef.current.children);
            let txt = '';
            let chldrn = textareaRef.current.children;
            for (let i = 0; i < chldrn.length; i++) {
              if (chldrn[i].innerText !== '\n') {
                txt += chldrn[i].innerText;
              }
              if (i !== chldrn.length-1) {
                txt += '\n';
              }
            }
            setCurContent(txt)
            setIsEdit(v=>!v);
          }}
        />
      ):(
        <>
          {groupTp!=="multiple_fwd"&&(
            <HStack mb={'10px'}>
              <HStack
                gap={'2px'}
                maxW={'250px'}
                overflowX={'auto'}
                onClick={async (e:any)=>{
                  e.stopPropagation();
                  e.preventDefault();
                }}
              >
                {fronts.map((f:any,i:number)=>(
                  <div
                    key={i} onClick={()=>setOption(i)}
                    className={i===option?'selectedOption option':'option'}
                  >
                    <ReactMarkdown
                      remarkPlugins={[shRemark]}
                      rehypePlugins={[rehypeRaw,rehypeKatex]}
                      components={shComponents}
                    >
                      {f}
                    </ReactMarkdown>
                  </div>
                ))}
              </HStack>
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
          )}

          {groupTp==='multiple'&&(
            <ReactMarkdown
              remarkPlugins={[shRemark]}
              rehypePlugins={[rehypeRaw,rehypeKatex]}
              components={shComponents}
            >
              {c.split('===')[option]}
            </ReactMarkdown>
          )}

          {groupTp==='multiple_fwd'&&(
            <ReactMarkdown
              remarkPlugins={[shRemark]}
              rehypePlugins={[rehypeRaw,rehypeKatex]}
              components={shComponents}
            >
              {
                fronts.join(' / ')
                + '\n---\n'
                + c.split('===')[0].split('---').slice(1)
              }
            </ReactMarkdown>
          )}

          {groupTp==='multiple_bwd'&&(
            <ReactMarkdown
              remarkPlugins={[shRemark]}
              rehypePlugins={[rehypeRaw,rehypeKatex]}
              components={shComponents}
            >
              {
                c.split('===')[0].split('---')[0]
                + '\n---\n'
                + c.split('===')[option]
                  .split('---')
                  .slice(1)
                  .join('')
              }
            </ReactMarkdown>
          )}
        </>
      )}
    </div>
  )
}