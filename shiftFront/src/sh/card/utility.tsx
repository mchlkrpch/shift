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
// @ts-expect-error: у copy-tex нет деклараций
import 'katex/dist/contrib/copy-tex';
import remarkMath from 'remark-math';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { MdCrop } from "react-icons/md";
import { Button } from '@chakra-ui/react';



// utility.tsx

export const handleEditorPaste = (
  e: React.ClipboardEvent<HTMLDivElement>, 
  onSaveContent: () => void
) => {
  const items = e.clipboardData?.items;
  if (!items) return;

  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      e.preventDefault(); 
      const file = items[i].getAsFile();
      if (!file) continue;

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        // Добавлен alt, чтобы Markdown парсер точно понимал, что это картинка
        const imgHtml = `<img src="${base64}" alt="pasted image" style="width: 400px; max-width: 100%; height: auto; display: inline-block; vertical-align: middle; margin: 5px 0; cursor: pointer;" class="sh-editable-image" />`;
        document.execCommand('insertHTML', false, imgHtml);
        
        onSaveContent(); 
      };
      reader.readAsDataURL(file);
      break; 
    }
  }
};

export const EditorImageResizer = ({ 
  activeImg,
  onClose,
  onResizeEnd 
}: { 
  activeImg: HTMLImageElement | null,
  onClose: () => void,
  onResizeEnd: () => void 
}) => {
  const [imgRect, setImgRect] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [cropTarget, setCropTarget] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<any>(null);
  const cropImgRef = useRef<HTMLImageElement>(null);

  const updateRect = useCallback(() => {
    if (activeImg && !cropTarget) {
      const r = activeImg.getBoundingClientRect();
      setImgRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }
  }, [activeImg, cropTarget]);

  useEffect(() => {
    if (activeImg) {
      updateRect();
      window.addEventListener('resize', updateRect);
      window.addEventListener('scroll', updateRect, true);
      
      const handleOutsideClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        // Игнорируем клики по рамке и кроперу
        if (target !== activeImg && !target.closest('.ReactCrop') && !target.closest('.cropper-actions') && !target.closest('.resizer-handle')) {
          onClose();
        }
      };
      window.addEventListener('mousedown', handleOutsideClick);

      return () => {
        window.removeEventListener('resize', updateRect);
        window.removeEventListener('scroll', updateRect, true);
        window.removeEventListener('mousedown', handleOutsideClick);
      };
    }
  }, [activeImg, updateRect, onClose]);

  useEffect(() => {
    if (!activeImg) return;
    const handleDblClick = (e: MouseEvent) => {
      e.preventDefault(); e.stopPropagation();
      setCropTarget(activeImg);
      setCrop({ unit: '%', width: 100, height: 100, x: 0, y: 0 });
    };
    activeImg.addEventListener('dblclick', handleDblClick);
    return () => activeImg.removeEventListener('dblclick', handleDblClick);
  }, [activeImg]);

  const handleDragResize = (e: React.PointerEvent) => {
    if (!activeImg) return;
    e.preventDefault(); e.stopPropagation();

    const startX = e.clientX;
    const startW = activeImg.getBoundingClientRect().width;

    const onMove = (moveEv: PointerEvent) => {
      const dx = moveEv.clientX - startX;
      activeImg.style.width = `${Math.max(50, startW + dx)}px`;
      activeImg.style.height = 'auto';
      updateRect();
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      onResizeEnd();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const saveCroppedImage = () => {
    if (cropImgRef.current && completedCrop && completedCrop.width > 0 && completedCrop.height > 0 && cropTarget) {
      const canvas = document.createElement('canvas');
      const image = cropImgRef.current;
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      canvas.width = Math.floor(completedCrop.width * scaleX);
      canvas.height = Math.floor(completedCrop.height * scaleY);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(
          image,
          completedCrop.x * scaleX, completedCrop.y * scaleY,
          completedCrop.width * scaleX, completedCrop.height * scaleY,
          0, 0,
          canvas.width, canvas.height
        );
        cropTarget.src = canvas.toDataURL('image/jpeg', 0.9);
        setCropTarget(null);
        onResizeEnd();
      }
    }
  };

  if (!activeImg) return null;

  return (
    <>
      {!cropTarget && createPortal(
        <div style={{ position: 'fixed', top: imgRect.top, left: imgRect.left, width: imgRect.width, height: imgRect.height, border: '2px dashed #0d99ff', pointerEvents: 'none', zIndex: 100000, boxSizing: 'border-box' }}>
          <div 
            className="resizer-handle e"
            onPointerDown={(e) => handleDragResize(e)} 
            onMouseDown={(e) => e.preventDefault()} // <-- Защита от потери фокуса редактора
            title="Растянуть по ширине" 
            tabIndex={-1}
            style={{ position: 'absolute', background: '#0d99ff', border: '2px solid white', pointerEvents: 'auto', width: '10px', height: '24px', right: '-5px', top: '50%', transform: 'translateY(-50%)', borderRadius: '4px', cursor: 'ew-resize' }} 
          />
          <div 
            className="resizer-handle se"
            onPointerDown={(e) => handleDragResize(e)} 
            onMouseDown={(e) => e.preventDefault()} // <-- Защита от потери фокуса редактора
            title="Растянуть" 
            tabIndex={-1}
            style={{ position: 'absolute', background: '#0d99ff', border: '2px solid white', pointerEvents: 'auto', width: '14px', height: '14px', right: '-7px', bottom: '-7px', borderRadius: '50%', cursor: 'nwse-resize' }} 
          />
        </div>,
        document.body
      )}

      {cropTarget && createPortal(
        <div className="cropper-overlay" tabIndex={-1} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 200000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onMouseDown={(e) => e.stopPropagation()}>
            <ReactCrop crop={crop} onChange={c => setCrop(c)} onComplete={c => setCompletedCrop(c)}>
              <img
                ref={cropImgRef}
                src={cropTarget.src}
                alt="Crop"
                style={{ maxHeight: '70vh', objectFit: 'contain' }}
                crossOrigin={cropTarget.src.startsWith('data:') ? undefined : "anonymous"}
                onLoad={(e) => {
                  const { width, height } = e.currentTarget;
                  setCompletedCrop({ unit: 'px', width, height, x: 0, y: 0 });
                }}
              />
            </ReactCrop>
            <div className="cropper-actions" style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
              <Button colorScheme="gray" onClick={() => setCropTarget(null)}>Cancel</Button>
              <Button colorScheme="blue" onClick={saveCroppedImage}>
                <MdCrop />
                Done
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

// ИСПРАВЛЕНИЕ: Мы достаем `node` из пропсов, чтобы он не попадал в HTML атрибуты картинки как [object Object]
export const InteractiveImage = ({ src, alt, width: propWidth, style, node, ...props }: any) => {
  const [active, setActive] = useState(false);
  const [rect, setRect] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [cropTarget, setCropTarget] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<any>(null);
  
  let parsedStyle: any = {};
  let initialWidth = propWidth || 'auto';
  
  if (typeof style === 'object' && style !== null) {
    parsedStyle = { ...style };
    if (style.width) initialWidth = style.width;
  } else if (typeof style === 'string') {
    const match = style.match(/width:\s*([^;]+)/);
    if (match) initialWidth = match[1].trim();
  }

  const [width, setWidth] = useState<number | string>(initialWidth);
  const [currentSrc, setCurrentSrc] = useState(src);
  
  // ИСПРАВЛЕНИЕ: Если картинка пришла из Markdown, и она обновилась — синхронизируем src
  useEffect(() => {
    setCurrentSrc(src);
  }, [src]);

  const imgRef = useRef<HTMLImageElement>(null);
  const cropImgRef = useRef<HTMLImageElement>(null);

  const updateRect = useCallback(() => {
    if (imgRef.current) {
      const r = imgRef.current.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }
  }, []);

  useEffect(() => {
    if (active) {
      updateRect();
      window.addEventListener('resize', updateRect);
      window.addEventListener('scroll', updateRect, true);
      return () => {
        window.removeEventListener('resize', updateRect);
        window.removeEventListener('scroll', updateRect, true);
      };
    }
  }, [active, updateRect]);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const handlePointerDown = (e: MouseEvent) => {
      e.stopPropagation(); setActive(true); updateRect();
    };
    const handleDblClick = (e: MouseEvent) => {
      e.stopPropagation(); setCropTarget(currentSrc);
      setCrop({ unit: '%', width: 100, height: 100, x: 0, y: 0 });
    };
    const handleDragStart = (e: Event) => e.preventDefault(); 
    img.addEventListener('pointerdown', handlePointerDown);
    img.addEventListener('dblclick', handleDblClick);
    img.addEventListener('dragstart', handleDragStart);
    return () => {
      img.removeEventListener('pointerdown', handlePointerDown);
      img.removeEventListener('dblclick', handleDblClick);
      img.removeEventListener('dragstart', handleDragStart);
    };
  }, [currentSrc, updateRect]);

  useEffect(() => {
    if (!active) return;
    const handleClick = (e: MouseEvent) => {
      if (imgRef.current && !imgRef.current.contains(e.target as Node)) {
        setActive(false);
      }
    };
    document.addEventListener('pointerdown', handleClick);
    return () => document.removeEventListener('pointerdown', handleClick);
  }, [active]);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (width === 'auto' && !parsedStyle?.width && !propWidth) {
      if (img.naturalWidth > 400) setWidth(400);
      else if (img.naturalWidth > 0) setWidth(img.naturalWidth);
    }
    if (active) updateRect();
  };

  const handleDragResize = (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!imgRef.current) return;
    const startX = e.clientX;
    const startW = imgRef.current.getBoundingClientRect().width;
    
    const onMove = (moveEv: PointerEvent) => {
      const dx = moveEv.clientX - startX;
      setWidth(Math.max(50, startW + dx));
      updateRect();
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const saveCroppedImage = () => {
    if (cropImgRef.current && completedCrop && completedCrop.width > 0 && completedCrop.height > 0) {
      const canvas = document.createElement('canvas');
      const image = cropImgRef.current;
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      
      canvas.width = Math.floor(completedCrop.width * scaleX);
      canvas.height = Math.floor(completedCrop.height * scaleY);
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.drawImage(
          image,
          completedCrop.x * scaleX, completedCrop.y * scaleY,
          completedCrop.width * scaleX, completedCrop.height * scaleY,
          0, 0,
          canvas.width, canvas.height
        );
        setCurrentSrc(canvas.toDataURL('image/jpeg', 0.9)); 
        setCropTarget(null);
        setActive(false);
      }
    }
  };

  return (
    <>
      <img
        ref={imgRef}
        src={currentSrc}
        alt={alt}
        onLoad={handleLoad}
        style={{ 
          ...parsedStyle, 
          width: typeof width === 'number' ? `${width}px` : width, 
          height: 'auto', 
          maxWidth: '100%', 
          borderRadius: '4px', 
          cursor: 'pointer',
          display: 'inline-block',
          verticalAlign: 'middle',
          margin: '5px 0'
        }}
        {...props}
      />

      {active && createPortal(
        <div style={{ position: 'fixed', top: rect.top, left: rect.left, width: rect.width, height: rect.height, border: '2px dashed #0d99ff', pointerEvents: 'none', zIndex: 10000, boxSizing: 'border-box' }}>
          <div onPointerDown={(e) => handleDragResize(e)} title="Растянуть по ширине" style={{ position: 'absolute', background: '#0d99ff', border: '2px solid white', pointerEvents: 'auto', width: '10px', height: '24px', right: '-5px', top: '50%', transform: 'translateY(-50%)', borderRadius: '4px', cursor: 'ew-resize' }} />
          <div onPointerDown={(e) => handleDragResize(e)} title="Растянуть" style={{ position: 'absolute', background: '#0d99ff', border: '2px solid white', pointerEvents: 'auto', width: '14px', height: '14px', right: '-7px', bottom: '-7px', borderRadius: '50%', cursor: 'nwse-resize' }} />
        </div>,
        document.body
      )}

      {cropTarget && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 20000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <ReactCrop crop={crop} onChange={c => setCrop(c)} onComplete={c => setCompletedCrop(c)}>
            <img
              ref={cropImgRef}
              src={cropTarget}
              alt="Crop"
              style={{ maxHeight: '70vh', objectFit: 'contain' }}
              crossOrigin={currentSrc?.startsWith('data:') ? undefined : "anonymous"}
              onLoad={(e) => {
                const { width, height } = e.currentTarget;
                setCompletedCrop({ unit: 'px', width, height, x: 0, y: 0 });
              }}
            />
          </ReactCrop>
          <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
            <Button colorScheme="gray" onClick={() => setCropTarget(null)}>Cancel</Button>
            <Button colorScheme="blue" onClick={saveCroppedImage}>
              <MdCrop />
              Done
            </Button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

// ... Остальные константы без изменений ...

// ... ваш существующий код ...

// export const shComponents: Components = {
//   h1: ({ node, ...props }:any) => <h1 style={{ ...headingStyles, fontSize: '2em', borderBottom: '1px solid #ddd' }} {...props} />,
//   // ... (остальные компоненты) ...
//   li: ({ node, ...props }) => <li style={{ marginBottom: '0.4em' }} {...props} />,
//   code: CodeBlock,
//   img: InteractiveImage, // <---- ДОБАВЛЯЕМ СЮДА
// };


export const SIDE_SPLIT_SYM: string = '@@@';
export const OPTION_SPLIT_SYM: string = '===';
export const CARD_SPLIT_SYM: string = '~~~';


export const Sh = ({ value }: any) => {
  // @ts-expect-error
  shComponents.cell = (props: any) => {
    const { id } = props;
    return <Cell id={id} />;
  };
  const safeValue = typeof value === 'string' ? value : value;
  return (
    <span style={{ whiteSpace: 'normal' }}>
      <ReactMarkdown
        urlTransform={(url: string) => url} // ИСПРАВЛЕНИЕ: Отключаем удаление Base64-картинок парсером Markdown!
        remarkPlugins={[
          remarkMath,
          shRemark,
          remarkGfm
        ]}
        rehypePlugins={[rehypeRaw, rehypeKatex, rehypeHighlight]}
        components={shComponents}
      >
        {safeValue}
      </ReactMarkdown>
    </span>
  );
};

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


export const shComponents: Components = {
  h1: ({ node, ...props }:any) => <h1 style={{ ...headingStyles, fontSize: '2em', borderBottom: '1px solid #ddd' }} {...props} />,
  h2: ({ node, ...props }) => <h2 style={{ ...headingStyles, fontSize: '1.5em', borderBottom: '1px solid #eee' }} {...props} />,
  h3: ({ node, ...props }) => <h3 style={{ ...headingStyles, fontSize: '1.25em' }} {...props} />,
  h4: ({ node, ...props }) => <h4 style={{ ...headingStyles, fontSize: '1em' }} {...props} />,
  h5: ({ node, ...props }) => <h5 style={{ ...headingStyles, fontSize: '0.875em', color: '#555' }} {...props} />,
  h6: ({ node, ...props }) => <h6 style={{ ...headingStyles, fontSize: '0.85em', color: '#666' }} {...props} />,

  p: ({ node, ...props }) => (
    <p 
      style={{ 
        marginLeft: '4px', 
        padding: '0px 0px', 
        lineHeight: '1em',
        marginTop: '0em',
        marginBottom: '0em',
      }} 
      {...props} 
    />
  ),
  
  ul: ({ node, ...props }) => <ul style={{
    paddingLeft: '20px', listStyleType: 'disc',
    marginBlockStart: '0em',
    marginBlockEnd: '0em',
  }} {...props} />,
  
  // ИЗМЕНЕНИЯ ЗДЕСЬ: добавляем отступ и тип маркера (decimal - обычные цифры)
  ol: ({ node, ...props }) => <ol style={{ paddingLeft: '20px', listStyleType: 'decimal' }} {...props} />,
  
  // p: ({ node, ...props }) => <p style={{ marginLeft: '4px', padding: '0px 0px', lineHeight: '1.2em' }} {...props} />,
  
  // Элемент списка (li) остаётся без изменений, он будет работать и для ul, и для ol
  li: ({ node, ...props }) => <li style={{ marginBottom: '0em' }} {...props} />,
  img: InteractiveImage,
  
  code: CodeBlock,
};

const LINK_REGEX_EXPR: RegExp = /<id=([^>]+?)>/g;
const MATH_REGEX_EXPR: RegExp = /\$([\s\S]+?)\$/g;

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
    visit(tree, ['text', 'html'], (node: any, index: any, p: any) => {
      if (!p || index === null) return;

      if (node.type === 'html' && node.value.toLowerCase().includes('<img')) {
        return;
      }

      const nodesAfterMath = splitPattern(
        node.value,
        MATH_REGEX_EXPR,
        (ans: any, s: string, pI: number, sI: number) => {
          ans.push({ type: 'text', value: s.slice(pI, sI) });
        },
        (ans: any, data: string) => {
          ans.push({
            data: {
              hChildren: [{ type: 'text', value: data }],
              hName: 'code',
              hProperties: {
                className: ['language-math', 'math-inline']
              }
            },
            position: {},
            type: 'inlineMath',
            value: data
          });
        },
      );

      const finalNodes = nodesAfterMath.flatMap((n: any) => {
        if (n.type === 'inlineMath' || n.type === 'html') {
          return [n];
        }
        return splitPattern(
          n.value,
          LINK_REGEX_EXPR,
          (ans: any, s: string, pI: number, sI: number) => {
            ans.push({ type: 'text', value: s.slice(pI, sI) });
          },
          (ans: any, data: string) => {
            ans.push({
              type: 'html',
              value: `<cell id="${data}" value="${data}"></cell>`,
            });
          },
        );
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
  sortedGroups.forEach(([gName, gData]: any) => {
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