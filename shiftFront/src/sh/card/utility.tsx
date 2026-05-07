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
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import { Box } from '@chakra-ui/react'
import { Clip } from '../clip'

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
      deps.add(match[1]);
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
    // custom visitor for detecting math and custom inner blocks
    visit(tree,['text', 'html'], (node: Text, index: any, p: any) => {
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
                hChildren:[{type:'text',value:data}],
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

// -----------------------------------------------------------
// ПОДГОТОВКА ГРАФА И DAGRE
// -----------------------------------------------------------

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
	const edges =[] as any;

	datas.forEach(card => {
		const concatenatedString =[...card.forward, ...card.backward].join(' ');
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

export const NodeWidth = 258;
export const NodeHeight = 50;

export function calculateHierarchy(groups: Record<string, {color: string, nodes: string[]}>) {
  const sortedGroups = Object.entries(groups || {}).sort((a,b) => a[1].nodes.length - b[1].nodes.length);
  const nodeToGroup: Record<string, string> = {};
  const groupToGroup: Record<string, string> = {};

  sortedGroups.forEach(([gName, gData]) => {
    gData.nodes.forEach(nodeId => {
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

// Новая функция для получения порядка групп (от вложенных к внешним)
function getGroupOrder(groups: Record<string, any>, groupToGroup: Record<string, string>): string[] {
  const allGroups = Object.keys(groups);
  const children: Record<string, string[]> = {};
  const roots: string[] = [];
  
  // Строим дерево детей для каждой группы
  allGroups.forEach(gId => {
    const parent = groupToGroup[gId];
    if (parent && groups[parent]) {
      if (!children[parent]) children[parent] = [];
      children[parent].push(gId);
    } else {
      roots.push(gId);
    }
  });
  
  // Обход в глубину: сначала дети, потом родитель
  const result: string[] = [];
  
  function visitGroup(gId: string, visited: Set<string>) {
    if (visited.has(gId)) return;
    visited.add(gId);
    
    // Сначала посещаем всех детей
    if (children[gId]) {
      children[gId].forEach(childId => {
        visitGroup(childId, visited);
      });
    }
    
    // Затем добавляем саму группу
    result.push(gId);
  }
  
  const visited = new Set<string>();
  roots.forEach(rootId => visitGroup(rootId, visited));
  
  // Добавляем группы, которые не были посещены (изолированные)
  allGroups.forEach(gId => {
    if (!visited.has(gId)) {
      visitGroup(gId, visited);
    }
  });
  
  return result;
}

// Функция для получения всех потомков группы (рекурсивно)
function getAllDescendants(groupId: string, groupToGroup: Record<string, string>): Set<string> {
  const descendants = new Set<string>();
  Object.entries(groupToGroup).forEach(([child, parent]) => {
    if (parent === groupId) {
      descendants.add(child);
      getAllDescendants(child, groupToGroup).forEach(d => descendants.add(d));
    }
  });
  return descendants;
}

const getLayoutedElements = (
  nodes: any[],
  edges: any[],
  groups: any = {},
  direction: string = 'TB',
  spacing: { x: number; y: number } = { x: 3.5, y: 2.0 }
) => {
  // 1. Собираем иерархию
  const { nodeToGroup, groupToGroup } = calculateHierarchy(groups);

  // 2. Получаем правильный порядок групп (от вложенных к внешним)
  const orderedGroups = getGroupOrder(groups, groupToGroup);

  // 3. Создаем маппинг: узел -> его самая вложенная группа
  const nodeToDeepestGroup: Record<string, string> = {};
  Object.entries(nodeToGroup).forEach(([nodeId, gId]) => {
    // Находим самого глубокого предка для этой группы
    let deepest = gId;
    let current = gId;
    while (groupToGroup[current]) {
      current = groupToGroup[current];
      deepest = current;
    }
    // Ищем самого глубокого потомка (самую вложенную группу)
    const descendants = getAllDescendants(gId, groupToGroup);
    if (descendants.size > 0) {
      // Берем первую найденную самую вложенную
      descendants.forEach(d => {
        if (!groupToGroup[d]) { // это лист (самая вложенная)
          deepest = d;
        }
      });
    }
    nodeToDeepestGroup[nodeId] = deepest;
  });

  // 4. Группируем узлы по их самой вложенной группе
  const nodesByDeepestGroup: Record<string, any[]> = {};
  nodes.forEach((node) => {
    const deepestGId = nodeToDeepestGroup[node.id];
    if (!deepestGId) return;
    if (!nodesByDeepestGroup[deepestGId]) nodesByDeepestGroup[deepestGId] = [];
    nodesByDeepestGroup[deepestGId].push(node);
  });

  let currentGroupX = 0;
  const layoutedNodes: any[] = [];
  const processedNodes = new Set<string>();

  // 5. Раскладываем группы в правильном порядке
  orderedGroups.forEach((gId) => {
    const gNodes = (nodesByDeepestGroup[gId] || [])
      .filter(n => !processedNodes.has(n.id))
      .sort((a, b) => a.id.localeCompare(b.id));
    
    const gData = groups[gId];
    const nodeGapY = 20 * spacing.y;
    
    // Уменьшаем отступ в 2 раза для вложенных групп
    const isNestedGroup = !!groupToGroup[gId];
    const groupPadding = (isNestedGroup ? 2 : 4) * spacing.x;

    let currentY = groupPadding;
    let maxWidth = 0;

    // Раскладываем узлы внутри группы сверху вниз
    gNodes.forEach((node) => {
      processedNodes.add(node.id);
      const w = node.width || NodeWidth;
      const h = node.height || NodeHeight;
      maxWidth = Math.max(maxWidth, w);

      layoutedNodes.push({
        ...node,
        parentId: gId,
        position: { 
          x: currentGroupX + groupPadding,
          y: currentY 
        },
        width: w,
        height: h,
      });

      currentY += h + nodeGapY;
    });

    // Вычисляем итоговые размеры группы
    const totalGroupWidth = maxWidth + groupPadding * 2;
    const totalGroupHeight = currentY + groupPadding - nodeGapY*2;

    // Добавляем саму группу
    layoutedNodes.push({
      id: gId,
      type: 'SpGroup',
      position: { x: currentGroupX, y: 0 },
      width: totalGroupWidth,
      height: totalGroupHeight,
      data: { label: gId, color: gData?.color || '#ccc' },
      parentId: groupToGroup[gId] || undefined,
    });

    // Сдвигаем X для следующей группы
    currentGroupX += totalGroupWidth + 30 * spacing.x;
  });

  // 6. Обрабатываем узлы без групп
  nodes.forEach((node) => {
    if (!nodeToGroup[node.id] && !processedNodes.has(node.id)) {
      layoutedNodes.push({
        ...node,
        position: { x: currentGroupX, y: 0 },
        width: node.width || NodeWidth,
        height: node.height || NodeHeight,
      });
      currentGroupX += (node.width || NodeWidth) + 30 * spacing.x;
    }
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
    'TB',
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
  return[newNs, layoutedEdges];
}