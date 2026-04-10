import React from 'react';
import ReactMarkdown, {
  type Components
} from 'react-markdown';
import {
  visit
} from 'unist-util-visit';
import type {
  Plugin
} from 'unified';
import type {
  Text,
  Root
} from 'mdast';
import {
  Cell
} from './cell';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import {
  createRoot
} from 'react-dom/client';
import { match } from '../../utility';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import { Box } from '@chakra-ui/react';
import { Clip } from '../clip';

export const SIDE_SPLIT_SYM: string = '@@@'
export const OPTION_SPLIT_SYM: string = '==='

export declare type GroupTp = 'single'|'multiple_fwd'|'multiple_bwd'|'multiple'|undefined;
export function getGroupTp(cnt: string) {
  if (!cnt) return undefined;
  let groupTp: GroupTp = undefined;
  let rows = cnt
    .split(OPTION_SPLIT_SYM)
    .map((n: any)=>n
      .split(RegExp(`(${SIDE_SPLIT_SYM})`, 'g'))
      .map((t:any)=>t.trim())
      .filter((t:string)=>t!==''));
  
  if (rows.length === 1) return 'single';
  groupTp = 'multiple_fwd';
  for (let i = 1; i < rows.length; ++i) {
    if (rows[i].length !== 1) {
      groupTp = undefined;
    }
  }
  if (groupTp !== undefined) {
    return groupTp;
  }
  groupTp = 'multiple_bwd';
  for (let i = 1; i < rows.length; ++i) {
    if (rows[i].length!==2||rows[i][0]!=='@@@') {
      groupTp = undefined;
    }
  }
  if (groupTp !== undefined) {
    return groupTp;
  }
  groupTp = 'multiple';
  return groupTp;
}

const CodeBlock = ({ node, inline, className, children, ...props }: any) => {
  const match = /language-(\w+)/.exec(className || '');
  const lang = match ? match[1] : 'text';
  const codeString = String(children).replace(/\n$/, '');
  if (!inline && match) {
    return (
      <Box
        position="relative"
        borderRadius="3px"
        overflow="hidden"
        backgroundColor={'color-mix(in srgb, black 20%, transparent)'}
        p={0}
      >
        <Box
          color={"gray.400"}
          p={'2px 4px'}
          fontSize="xs"
          display="flex"
          justifyContent="space-between"
        >
          <span>{lang}</span>
          <Clip
            value={codeString}
            props={{
              opacity: 0.5,
              variant: 'ghost',
              h:'20px',minW:'20px',
              p:'5px',
              iconSz: '15px',
            }}
          />
        </Box>
        <Box 
          as="pre"
          overflowX="auto"
          p={'4px'}
        >
          <code {...props}
          >
            {children}
          </code>
        </Box>
      </Box>
    );
  }
  return (
    <Box as="code" bg="gray.100" px={1} py={0.5} borderRadius="sm" fontSize="0.9em" {...props}>
      {children}
    </Box>
  );
};

const headingStyles: React.CSSProperties = {
  marginBottom: '0.4em',
  fontWeight: 600,
};
export const shComponents:Components={
  // Заголовки h1, h2, ... h6
  h1: ({ node, ...props }:any) => <h1 style={{ ...headingStyles, fontSize: '2em', borderBottom: '1px solid #ddd' }} {...props} />,
	h2: ({ node, ...props }) => <h2 style={{ ...headingStyles, fontSize: '1.5em', borderBottom: '1px solid #eee' }} {...props} />,
	h3: ({ node, ...props }) => <h3 style={{ ...headingStyles, fontSize: '1.25em' }} {...props} />,
	h4: ({ node, ...props }) => <h4 style={{ ...headingStyles, fontSize: '1em' }} {...props} />,
	h5: ({ node, ...props }) => <h5 style={{ ...headingStyles, fontSize: '0.875em', color: '#555' }} {...props} />,
	h6: ({ node, ...props }) => <h6 style={{ ...headingStyles, fontSize: '0.85em', color: '#666' }} {...props} />,
  // Списки
  ul: ({ node, ...props }) => <ul style={{ paddingLeft: '20px', listStyleType: 'disc' }} {...props} />,
	ol: ({ node, ...props }) => <ol style={{ paddingLeft: '0px' }} {...props} />,
  p: ({ node, ...props }) => <p style={{ marginLeft: '4px', padding: '2px 0px' }} {...props} />,
  // Элементы списка. Можно добавить кастомные маркеры или логику.
  li: ({ node, ...props }) => <li style={{ marginBottom: '0.4em' }} {...props} />,
  code: CodeBlock,
};

const LINK_REGEX_EXPR: RegExp = /<id=([^\$]*?)>/g;
const MATH_REGEX_EXPR: RegExp = /\$([^<>]*?)\$/g;
const splitPattern = (
  s: string,
  p: any,
  add_common: any,
  add_selected: any,
)=>{
  let pI = 0;
  let m: any;
  const ans = [] as any
  while ((m = p.exec(s)) !== null) {
    const group = m[0]; const fst = m[1]; const scd = m[2]; const sI = m.index;
    const eI = sI + group.length;
    if (sI > pI)
      add_common(ans,s,pI,sI);
    if (scd !== undefined) {
      add_selected(ans,[fst,scd]);
    } else {
      add_selected(ans,fst);
    }
    pI = eI;
  }
  if (pI < s.length) add_common(ans,s,pI,s.length);
  return ans
}

export const shRemark: Plugin<[], Root> = () => {
  return (tree: any) => {
    // custom visitor for detecting math and custom inner blocks
    visit(tree, ['text', 'html'], (node: Text, index: any, p: any) => {
      if (!p || index === null ) return;
      const newChildren = splitPattern(
        node.value,
        LINK_REGEX_EXPR,
        // split original string (s) and insert as textnode
        (ans:any,s:string,pI:number,sI:number)=>{
          ans.push({type:'text',value:s.slice(pI, sI)})
        },
        // insert data as splink content
        (ans:any,data:string)=>{
          ans.push({
            type:'html',
            value:`<cell id="${data}" value="${data}"></cell>`,
          })
        },
      )
      const finalNodes = newChildren.flatMap((n: any) => {
        if (n.type === 'html')
          return [n]
        const nodesWithMath = splitPattern(
          n.value,
          MATH_REGEX_EXPR,
          (ans:any,s:string,pI:number,sI:number) => {
            ans.push({type: 'text', value: s.slice(pI,sI)});
          },
          (ans:any,data:string) => {
            ans.push({
              data: {
                hChildren: [{type:'text',value:data}],
                hName: 'code',
                hProperties: {
                  className: ['lambuage-math', 'math-inline']
                }
              },
              position: {},
              type: 'inlineMath',
              value: data
            });
          },
        );
        return nodesWithMath;
      });
      p.children.splice(index, 1, ...finalNodes);      
      return index + finalNodes.length;
    });
  };
};

export declare type PreviewTp = 'embed'|'free'|'ghost'|undefined;
export function getPreviewStyle(tp: PreviewTp) {
  return match(tp,{
    'embed':{
      width:'100%',
      padding:'0px',
    },
    'free':{
      width:'100%',
      padding: '0px',
      borderRadius: '0px',
      border: '1px solid color-mix(in srgb, #eee 15%, transparent)',
    },
    'ghost':{
      width:'100%',
      padding: '0px',
      borderRadius: '7px',
    },
  })
}

export const md2sh=(
  c:string,
)=>{
  const w = c.split(/(<id=[^>]*>)/)
    .map((t:string)=>{
      if (t.match(/<id=[^>]*>/g)) {
        return [
          '',
          <Cell
            key={t+t.slice(4, t.length - 1)}
            id={t.slice(4, t.length - 1)}
          />
        ]
      }
      return [t];
    })
  const res = w.map((n:any)=>{
    if (n.length===1) {
      return [`${n[0].split('\n').map((t:any)=>{
        return t === ''?`<br>`:`<div class="sh_string"}>${t}</div>`;
      }).join('')}`];
    }
    if (n.length===2) {
      return n;
    }
  })
  return res;
}



export const Sh = (
  {value}: any,
)=>{
  // @ts-expect-error
  shComponents.cell = (props: any)=>{
    const {id}=props
    return <Cell id={id}/>;
  }
  return (
    <ReactMarkdown
      remarkPlugins={[shRemark,remarkGfm]}
      rehypePlugins={[rehypeRaw,rehypeKatex,rehypeHighlight]}
      components={shComponents}
    >
      {value}
    </ReactMarkdown>
  )
}

const insertBlock=async(
) => {
	const selection = window.getSelection()!;
	const range = selection.getRangeAt(0);
	// delete selected text
	range.deleteContents();
	const el = document.createElement('div');
	el.className = 'inlineCell';
	el.contentEditable = 'false';
	el.dataset.id='';
	await range.insertNode(el);
	const root = createRoot(el);
	await root.render(<Cell id={'val'}/>)
};

export const onKeyDownCb:any=async(
  e:any,
)=>{
	switch (e.key) {
		case '/': {
			e.preventDefault();
			e.stopPropagation();
			insertBlock();
			return
		}
		default: {
			return;
		}
	}
}
