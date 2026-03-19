import { type Components } from 'react-markdown';
import { visit } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Text, Root } from 'mdast';

const headingStyles: React.CSSProperties = {
  marginBottom: '0.4em',
  fontWeight: 600,
};

export const shComponents: Components = {
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
  // Элементы списка. Можно добавить кастомные маркеры или логику.
  li: ({ node, ...props }) => <li style={{ marginBottom: '0.4em' }} {...props} />,
};



const blockRegex = /<id=(.*?)>/g;
const customMathRegex = /\$(.*?)\$/g;

const __split_pattern = (
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
            add_common(ans,s,pI,sI)
        if (scd !== undefined) {
            add_selected(ans,[fst,scd])
        } else {
            add_selected(ans,fst)
        }
        pI = eI;
    }
    if (pI < s.length)
        add_common(ans,s,pI,s.length)
    
    return ans
}

export const shRemark: Plugin<[], Root> = () => {
  return (tree: any) => {
    // custom visitor for detecting math and custom inner blocks
    visit(tree, ['text', 'html'], (node: Text, index: any, p: any) => {
      if (!p || index === null )
        return
      const newChildren = __split_pattern(
        node.value,
        blockRegex,
        // split original string (s) and insert as textnode
        (ans: any, s:string, pI:number, sI:number)=>{
          ans.push({type:'text', value:s.slice(pI, sI)})
        },
        // insert data as splink content
        (ans:any, data:string)=>{
          ans.push({
            type:'html', value:`<splink id="${data}" value="${data}"></splink>`
          })
        },
      )
      const finalNodes = newChildren.flatMap((n: any) => {
        if (n.type === 'html')
          return [n]
        const nodesWithMath = __split_pattern(
          n.value,
          customMathRegex,
          (ans: any, s: string, pI: number, sI: number) => {
              ans.push({type: 'text', value: s.slice(pI, sI)});
          },
          (ans: any, data: string) => {
            ans.push({
              data: {
                hChildren: [{type: 'text', value: data}],
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

export declare type GroupTp = 'single'|'multiple_fwd'|'multiple_bwd'|'multiple'|undefined;

export function getGroupTp(cnt: string) {
    let groupTp: GroupTp = undefined;
    if (cnt.split('===').length === 1) {
        groupTp = 'single';
    }
    let rows = cnt
        .split('===')
        .map((n: any)=>n.split('---'));
    groupTp = 'multiple_fwd';
    for (let i = 1; i < rows.length-1; ++i) {
        if (rows[i].length !== 1) {
            groupTp = undefined;
        }
    }
    if (groupTp !== undefined) {
        return groupTp;
    }
    groupTp = 'multiple_bwd';
    console.log(rows)
    for (let i = 1; i < rows.length-1; ++i) {
        if (rows[i][0].trim() !== '') {
            groupTp = undefined;
        }
    }
    if (groupTp !== undefined) {
        return groupTp;
    }
    groupTp = 'multiple';
    return groupTp;
}

export declare type PreviewTp = 'embed'|'free'|undefined;
export function getPreviewStyle(tp: PreviewTp) {
    let style = {} as any;
    if (tp === 'embed') {
        Object.assign(
            style,
            {width:'100%',padding: '3px 4px',},
        )
    }

    if (tp === 'free') {
        Object.assign(
            style,
            {
                width:'100%',
                padding: '3px 4px',
                borderRadius: '7px',
                border: '1px solid color-mix(in srgb, #eee 15%, transparent)',
            }
        )
    }
    return style;
}