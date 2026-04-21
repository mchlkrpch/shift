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

// export declare type PreviewTp = 'embed'|'free'|'ghost'|undefined;
export function getPreviewStyle(tp: any) {
  // return match(tp,{
  //   'embed':{
  //     width:'100%',
  //     padding:'0px',
  //   },
  //   'free':{
  //     width:'100%',
  //     padding: '0px',
  //     borderRadius: '0px',
  //     border: '1px solid color-mix(in srgb, #eee 15%, transparent)',
  //   },
  //   'ghost':{
  //     width:'100%',
  //     padding: '0px',
  //     // borderRadius: '7px 7px 0px 0px',
  //   },
  // })
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

export function topSort(ns: Record<string,string>) {
  const used = new Set<string>();
  const visiting = new Set<string>();
  const res: { id: string; content: string }[] = [];
  const getDependencies = (str: string): string[] => {
    const deps = new Set<string>();
    const regex = /<id=([^>]+)>/g;
    let match;
    while ((match = regex.exec(str)) !== null) {
      deps.add(match[1]);
    }
    return Array.from(deps);
  };
  const dfs = (id: string) => {
    if (visiting.has(id)) {
      throw new Error(`id: ${id}`);
    }
    if (used.has(id)) {
      return;
    }
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
    res.push({
      id: id,
      content: content
    });
  };
  for (const id of Object.keys(ns)) {
    dfs(id);
  }
  return res;
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
	const allNodeIds = new Set(datas.map(d => d.id));
	const nodeContent: { [key: string]: string } = {};
	const edges = [] as any;

	datas.forEach(card => {
		const concatenatedString = [...card.forward, ...card.backward].join(' ');
		nodeContent[card.id] = concatenatedString;
		const regex = /<id=(.*?)>/g;
		let match;
		while ((match = regex.exec(concatenatedString)) !== null) {
			const sourceId = match[1];
			if (sourceId) {
				if (!edgesSet.has(`e-${sourceId}-${card.id}`)) {
					edgesSet.add(`e-${sourceId}-${card.id}`);
					allNodeIds.add(sourceId);
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

export const buildG = (rawNs: Record<string, string>) => {
	const datas = parseRawCards(rawNs); 
	const edges: {id:string;source:string;target:string,type:string}[] = [];
	const nodeContent: { [key: string]: string } = {};
	const allNodeIds = new Set(datas.map(d => d.id));
	const edgesSet = new Set() as Set<string>;
	datas.forEach(card => {
		const concatenatedString = [...card.forward, ...card.backward].join(' ');
		nodeContent[card.id] = concatenatedString;
		const regex = /<id=(.*?)>/g;
		let match;
		while ((match = regex.exec(concatenatedString)) !== null) {
			const sourceId = match[1];
			if (sourceId) {
				if (!edgesSet.has(`e-${sourceId}-${card.id}`)) {
					edgesSet.add(`e-${sourceId}-${card.id}`)
					allNodeIds.add(sourceId);
					edges.push({
							id: `e-${sourceId}-${card.id}`,
							source: sourceId,
							target: card.id,
							type:'SpEdge',
					});
				}
			}
		}
	});
  const positions: { [key: string]: { x: number; y: number } } = {};
	const inDegree: { [key: string]: number } = {};
	const adj: { [key: string]: string[] } = {};
    allNodeIds.forEach(id => {
		inDegree[id] = 0;
		adj[id] = [];
	});
	
    edges.forEach(edge => {
		if (inDegree[edge.target] !== undefined) {
			inDegree[edge.target]++;
		}
		if (adj[edge.source]) {
			adj[edge.source].push(edge.target);
		}
	});
	
    const queue: string[] = [];
	allNodeIds.forEach(id => {
		if (inDegree[id] === 0) {
			queue.push(id);
		}
	});
	
    const levelMap: { [key: number]: string[] } = {};
	let level = 0;
	while (queue.length > 0) {
		const levelSize = queue.length;
		if (!levelMap[level]) {
			levelMap[level] = [];
		}
		for (let i = 0; i < levelSize; i++) {
			const u = queue.shift()!;
			levelMap[level].push(u);
			if (adj[u]) {
				adj[u].forEach(v => {
					if (inDegree[v] !== undefined) {
						inDegree[v]--;
						if (inDegree[v] === 0) {
							queue.push(v);
						}
					}
				});
			}
		}
		level++;
	}
	
    const ySpacing = 150;
	const xSpacing = 30;
	Object.keys(levelMap).forEach(lvlStr => {
		const currentLevel = parseInt(lvlStr, 10);
		const nodesAtLevel = levelMap[currentLevel];
		const levelWidth = nodesAtLevel.length * xSpacing;
		const startX = -levelWidth / 2;
		nodesAtLevel.forEach((nodeId, index) => {
			positions[nodeId] = {
				x: startX + index * xSpacing,
				y: currentLevel * ySpacing,
			};
		});
	});
	
    allNodeIds.forEach(id => {
		if (!positions[id]) {
			positions[id] = { x: Math.random() * 400, y: Math.random() * 400 };
		}
	});
    
	return [positions, edges];
}

// dagre импорты и настройки (без изменений)
import dagre from '@dagrejs/dagre';
import { GraphCtx } from '../../App';
const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
export const NodeWidth = 258;
export const NodeHeight = 40;

const getLayoutedElements = (nodes:any, edges:any, direction:string='TB') => {
	const isHorizontal = direction === 'LR';
	dagreGraph.setGraph({ rankdir: direction });
	nodes.forEach((node:any) => {
		dagreGraph.setNode(node.id, { width: NodeWidth-40, height: NodeHeight });
	});
	edges.forEach((edge:any) => {
		dagreGraph.setEdge(edge.source, edge.target);
	});
	dagre.layout(dagreGraph);
	const newNodes = nodes.map((node:any) => {
		const nodeWithPosition = dagreGraph.node(node.id);
		const newNode = {
			...node,
			targetPosition: isHorizontal ? 'left' : 'top',
			sourcePosition: isHorizontal ? 'right' : 'bottom',
			position: {
				x: nodeWithPosition.x - NodeWidth / 2,
				y: nodeWithPosition.y - 80,
			},
		};
		return newNode;
	});
 
	return {nodes: newNodes, edges};
};

// 4. Обновленный calcG (принимает сырой объект ns)
export const calcG = (rawNs: Record<string, string>) => {
    // Сначала парсим данные
    const parsedDatas = parseRawCards(rawNs);
    
	const newEdges = calcEs(parsedDatas);
	const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
		parsedDatas, // передаем уже распарсенные DataTp[]
		newEdges,
		'TB',
	);
    
	const newNs = layoutedNodes.map((n:any) => ({
		id: n.id,
		type: 'SpDef',
		position: n.position,
		data: {
			forward: n.forward,
			backward: n.backward,
			id: n.id,
			tp: n.tp,
		}
	}));
    
	return [newNs, layoutedEdges];
}
