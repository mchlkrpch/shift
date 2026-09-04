// utility.tsx
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
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import {
  createRoot
} from 'react-dom/client';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import { Cell } from './cell';
import { Box } from '@chakra-ui/react';
import { Clip } from '../clip';
// @ts-expect-error
import dagre from 'dagre';

export const SIDE_SPLIT_SYM: string = '@@@'
export const OPTION_SPLIT_SYM: string = '==='
export const CARD_SPLIT_SYM: string = '~~~'

export const Sh=({value}:any)=>{
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

export function topSort(ns: Record<string, string>, preferredOrder:string[]=[]) {
  const used = new Set<string>();
  const visiting = new Set<string>();
  const res: { id: string; content: string }[] = [];
  const getDependencies = (str: string): string[] => {
    const deps = new Set<string>();
    const regex = /<id=([^>]+)>/g;
    let match;
    while ((match = regex.exec(str)) !== null) {
      deps.add(match[1].split(':')[0]);
    }
    return Array.from(deps);
  };

  const dfs = (id: string) => {
    if (visiting.has(id)) return;
    if (used.has(id)) return;
    
    visiting.add(id);
    const content = ns[id];
    
    if (content !== undefined) {
      const dependencies = getDependencies(content);
      for (const depId of dependencies) {
        if (ns[depId] !== undefined) {
          dfs(depId);
        }
      }
    }
    visiting.delete(id);
    used.add(id);
    res.push({ id, content });
  };

  const initialKeys = preferredOrder.length > 0 ? preferredOrder : Object.keys(ns);
  for (const id of initialKeys) {
    if (ns[id] !== undefined) dfs(id);
  }
  
  return res;
}


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
          style={{scrollbarWidth: 'none'}}
          as="pre"
          overflowX="auto"
          p={'4px'}
        >
          <code {...props}
            style={{scrollbarWidth: "none"}}
          >
            {children}
          </code>
        </Box>
      </Box>
    );
  }
  return (
    <Box as="code" bg="whiteAlpha.200" px={1} py={0.5} borderRadius="sm" fontSize="0.9em" {...props}>
      {children}
    </Box>
  );
};

const headingStyles: React.CSSProperties = {
  marginBottom: '0.4em',
  fontWeight: 600,
};
export const shComponents:Components={
  h1: ({ node, ...props }:any) => <h1 style={{ ...headingStyles, fontSize: '2em', borderBottom: '1px solid #ddd' }} {...props} />,
  h2: ({ node, ...props }) => <h2 style={{ ...headingStyles, fontSize: '1.5em', borderBottom: '1px solid #eee' }} {...props} />,
  h3: ({ node, ...props }) => <h3 style={{ ...headingStyles, fontSize: '1.25em' }} {...props} />,
  h4: ({ node, ...props }) => <h4 style={{ ...headingStyles, fontSize: '1em' }} {...props} />,
  h5: ({ node, ...props }) => <h5 style={{ ...headingStyles, fontSize: '0.875em', color: '#555' }} {...props} />,
  h6: ({ node, ...props }) => <h6 style={{ ...headingStyles, fontSize: '0.85em', color: '#666' }} {...props} />,
  ul: ({ node, ...props }) => <ul style={{ paddingLeft: '20px', listStyleType: 'disc' }} {...props} />,
  ol: ({ node, ...props }) => <ol style={{ paddingLeft: '0px' }} {...props} />,
  p: ({ node, ...props }) => <p style={{ marginLeft: '4px', padding: '0px 0px', lineHeight: 'normal' }} {...props} />,
  li: ({ node, ...props }) => <li style={{ marginBottom: '0.4em' }} {...props} />,
  code: CodeBlock,
};

const LINK_REGEX_EXPR: RegExp = /<id=([^>]+?)>/g;
const MATH_REGEX_EXPR: RegExp = /\$([^<>]*?)\$/g;
const splitPattern = (
  s: string,
  p: any,
  add_common: any,
  add_selected: any,
)=>{
  let pI = 0;
  let m: any;
  const ans =[] as any
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
    visit(tree,['text', 'html'], (node: Text, index: any, p: any) => {
      if (!p || index === null ) return;
      const newChildren = splitPattern(
        node.value,
        LINK_REGEX_EXPR,
        (ans:any,s:string,pI:number,sI:number)=>{
          ans.push({type:'text',value:s.slice(pI, sI)})
        },
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
                hChildren:[{type:'text',value:data}],
                hName: 'code',
                hProperties: {
                  className:['lambuage-math', 'math-inline']
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

export function getPreviewStyle(_tp:any) {
  return {
    width:'100%',
    padding: '0px',
  }
}

export const md2sh=(
  c:string,
)=>{
  const w = c.split(/(<id=[^>]*>)/)
    .map((t:string)=>{
      if (t.match(/<id=[^>]*>/g)) {
        return[
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

export const insertBlock=async(
) => {
  const selection = window.getSelection()!;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const el = document.createElement('div');
  el.className = 'inlineCell';
  el.contentEditable = 'false';
  el.dataset.id='';
  await range.insertNode(el);
  const root = createRoot(el);
  await root.render(<>
    <Cell id={'val'}/>
  </>)
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

type DataTp = {
  forward: string[],
  backward: string[],
  id: string,
  tp?: string,
}

export const parseRawCards = (ns: Record<string, string>): DataTp[] => {
  return Object.entries(ns).map(([id, text]) => {
    const options = text.split('===');		
    const forward = options.map(opt => {
      const parts = opt.split('@@@');
      return parts[0] ? parts[0].trim() : '';
    });
    const backward = options.map(opt => {
      const parts = opt.split('@@@');
      return parts[1] ? parts[1].trim() : '';
    });
    return {
      id,
      forward,
      backward,
      tp: 'default_type'
    };
  });
};

export const calcEs = (datas: DataTp[]) => {
  const edgesSet = new Set() as Set<string>;
  const edges = [] as any;

  datas.forEach(card => {
    const concatenatedString = [...card.forward, ...card.backward].join(' ');
    const regex = /<id=(.*?)>/g;
    let match;
    while ((match = regex.exec(concatenatedString)) !== null) {
      const sourceId = match[1].split(':')[0];
      if (sourceId) {
        if (!edgesSet.has(`e-${sourceId}-${card.id}`)) {
          edgesSet.add(`e-${sourceId}-${card.id}`);
          edges.push({
            id: `e-${sourceId}-${card.id}`,
            source: sourceId,
            target: card.id,
            type: 'SpEdge',
          });
        }
      }
    }
  });
  return edges;
}

export const NodeWidth = 160;
export const NodeHeight = 36;

export function transformToOldGroups(flatTree: any[]) {
  const oldGroups: Record<string, string[]> = {};

  flatTree.forEach((item) => {
    // Нас интересуют только карточки (ноды)
    if (item.block.type === 'card') {
      // Каждая карточка знает список своих родителей (групп)
      item.parentGroupIds.forEach((groupId: string) => {
        if (!oldGroups[groupId]) {
          oldGroups[groupId] = [];
        }
        oldGroups[groupId].push(item.block.id);
      });
    }
  });

  return oldGroups;
}

export function calculateHierarchy(groups: any) {
  const sortedGroups = Object.entries(groups||{}).sort((a: any,b: any) => (a.end-a.start) - (b.end-b.start));
  const nodeToGroup: Record<string, string> = {};
  const groupToGroup: Record<string, string> = {};
  sortedGroups.forEach(([gName, gData]) => {
    // example of output: gn: Leonard story {start: 9, end: 12, color: '#3ab3b026', depth: 1}
    gData.forEach((nodeId:any) => {
      if (nodeToGroup[nodeId]) {
        const smallerGroup = nodeToGroup[nodeId];
        let current = smallerGroup;
        while(groupToGroup[current] && groupToGroup[current] !== gName) {
          current = groupToGroup[current];
        }
        if (current !== gName) {
          groupToGroup[current] = gName;
        }
      } else {
        nodeToGroup[nodeId] = gName;
      }
    });
  });
  
  return { nodeToGroup, groupToGroup };
}

const getLayoutedElements = (
  nodes: any[],
  edges: any[],
  groups: any = {},
  direction: string = 'LR',
  spacing: { x: number; y: number } = { x: 1, y: 1 }
) => {
  const dagreGraph = new dagre.graphlib.Graph({ compound: true });
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({ 
    rankdir: direction, 
    nodesep: 20 * spacing.y, 
    ranksep: 30 * spacing.x, 
    edgesep: 40 * spacing.y 
  });

  const { nodeToGroup, groupToGroup } = calculateHierarchy(groups);

  Object.keys(groups).forEach(gId => {
    dagreGraph.setNode(gId, { 
      label: gId,
      paddingLeft: 10, paddingRight: 0, paddingTop: 0, paddingBottom: 0
    });
  });
  
  Object.keys(groupToGroup).forEach(gId => {
    const parentId = groupToGroup[gId];
    if (parentId && groups[parentId]) {
      dagreGraph.setParent(gId, parentId);
    }
  });

  nodes.forEach(node => {
    const w = node.width || NodeWidth;
    const h = node.height || NodeHeight;
    dagreGraph.setNode(node.id, { width: w, height: h });
    
    const parentId = nodeToGroup[node.id];
    if (parentId && groups[parentId]) {
      dagreGraph.setParent(node.id, parentId);
    }
  });

  edges.forEach(edge => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes: any[] = [];
  
  nodes.forEach(node => {
    const nodeWithPosition = dagreGraph.node(node.id);
    if (!nodeWithPosition) return;
    
    layoutedNodes.push({
      ...node,
      position: { 
        x: nodeWithPosition.x,
        y: nodeWithPosition.y - 12
      },
      width: nodeWithPosition.width,
      height: nodeWithPosition.height,
      parentId: nodeToGroup[node.id]
    });
  });

  Object.keys(groups).forEach(gId => {
    const groupNode = dagreGraph.node(gId);
    if (!groupNode) return;
    const gData = groups[gId];
    layoutedNodes.push({
      id: gId,
      type: 'SpGroup',
      position: { 
        x: groupNode.x, 
        y: groupNode.y + 8
      },
      width: groupNode.width,
      height: groupNode.height,
      data: { label: gId, color: gData?.color || '#ccc' },
      parentId: groupToGroup[gId] || undefined,
    });
  });

  return { nodes: layoutedNodes, edges };
};

export const calcG = (
  rawNs: Record<string, string>,
  groups: any = {},
  spacing: { x: number; y: number } = { x: 1, y: 1.0 }
) => {
  const cleanNs = { ...rawNs };
  delete cleanNs['__groups__'];
  const parsedDatas = parseRawCards(cleanNs);
  const newEdges = calcEs(parsedDatas);
  
  const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
    parsedDatas,
    newEdges,
    groups,
    'LR',
    spacing
  );
  
  const newNs = layoutedNodes.map((n: any) => {
    if (n.type === 'SpGroup') return n;
    return {
      id: n.id,
      type: 'SpDef',
      position: n.position,
      parentId: n.parentId,
      data: {
        forward: n.forward,
        backward: n.backward,
        id: n.id,
        tp: n.tp,
      }
    };
  });
  
  return [newNs, layoutedEdges];
}