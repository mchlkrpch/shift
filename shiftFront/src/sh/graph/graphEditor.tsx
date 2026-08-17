// graphEditor.tsx
/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  memo
} from 'react'

import Sigma from "sigma";
import Graphology from "graphology";

import {
  GraphCtx,
  useGraphCtx
} from '../../App';
import {
  DarkMode,
  LightMode,
  useColorMode
} from '../../main';
import {
  Box,
  Button,
  CardRoot,
  HStack,
  IconButton,
  Separator,
  Spacer,
  Tabs,
  Text,
  VStack
} from '@chakra-ui/react';
import { calcG, calculateHierarchy, SIDE_SPLIT_SYM, topSort } from '../card/utility';
import { Card } from '../card/card';
import { ContextMenu, useContextMenu } from '../menu'; 

import { FaParagraph } from "react-icons/fa6";
import { BsDiagram2Fill } from "react-icons/bs";
import { APPWRITE_CONFIG, gReq, spaced_account } from "../../appwrite/service";
import { MdFilterCenterFocus } from "react-icons/md";
import { Clip } from "../clip";
import {
  FaShare,
} from "react-icons/fa";
import { PiExport } from "react-icons/pi";
import { RiSaveFill, RiRepeat2Line } from "react-icons/ri";

import { Feed, getCardState } from "./feed"; 
import { LuChevronDown, LuChevronRight, LuPilcrow } from "react-icons/lu";

export const graphCSS = css`
display:flex;
flex:1;
position: relative;
margin: 0;
width: 100%;
min-height: 0;
overflow-y: hidden;

.thinButton {
  height: 20px;
  gap: 3px;
  padding:0px 10px;
}

.headerTabs {
  display: flex;
  flex-direction: row;
  width: 100%;
  align-items: center;
  gap: 8px;
}

.graphTabs {
  width: 100%;
  display: flex;
  flex-direction:column;
  gap:0;
  min-height:0;
  flex:1;
  margin: 0;
  background-color: color-mix(in srgb, #556 20%, transparent);
  overflow: hidden;
  border: 1.2px solid color-mix(in srgb, #666 14%, transparent);
}

.tabsTrigger {
  display: flex;
  border-radius: 5px;
  height: 20px;
  padding: 2px 5px;
  gap: 2px;
  min-width: fit-content;
  align-content: center;
  justify-content: center;
  border: 1.2px solid transparent;
}

.tabsTrigger[aria-selected="false"]:hover {
  background-color: color-mix(in srgb, white 10%, transparent);
  color: white;
  transition: all .1s;
}[aria-selected="true"] {
  background-color: color-mix(in srgb, #556 40%, transparent);
}

.GraphmodeStack {
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
  min-height:100%;
  position: relative;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, white 40%, transparent) transparent;
}

.smIcon {
  width: 12px;
  height: 12px;
}

.TextmodeStack {
  display: flex;
  flex: 1;
  min-height:0;
  align-items: stretch;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
  gap: 0;
  height: 100%;
}

.textmodeToolsPanel {
  display:flex;
  position: sticky;
  align-items:center;
  justify-content:start;
  top: 0;
  z-index: 10;  
  width: 100%;
  padding: 10px 15px;
  background-color: color-mix(in srgb, #888 10%, transparent);
  backdrop-filter:blur(60px);
  border-bottom: 1.2px solid color-mix(in srgb, #666 14%, transparent);
}

.graphFrame {
  flex: 1;
  position: relative;
  min-height: 500px;
  overflow: hidden;
  background-color: #1e1e1e;
  outline: none;
  border: none;
}

.sigma-container {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  outline: none;
  border: none;
  user-select: none;
  -webkit-user-select: none;
}

.sigma-tools-panel {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 50;
}

.tree-row {
  content-visibility: auto;
  contain-intrinsic-size: 0 32px;
  will-change: contents;
}
`;

const Colored=({content}:any)=>{
  const {colorMode} = useColorMode();
  return colorMode === 'light' ? <LightMode>{content}</LightMode> : <DarkMode>{content}</DarkMode>;
}

export const TempDef = ({data, id}: any) => {
  const extendedGCtx = {
    ...data.gCtx, 
    ns: { ...(data.gCtx?.ns || {}), [id]: data.content },
    setNs: (newNsOrCb: any) => {
      const currentNs = { ...(data.gCtx?.ns || {}),[id]: data.content };
      const newNs = typeof newNsOrCb === 'function' ? newNsOrCb(currentNs) : newNsOrCb;
      if (newNs[id] !== undefined) data.setContent(newNs[id]);
      if (data.gCtx && data.gCtx.setNs) {
        const { [id]: tempCardContent, ...restCards } = newNs;
        data.gCtx.setNs(restCards);
      }
    },
  };

  return (
    <Colored content={(
      <Box className='defNode' onClick={(e)=>e.stopPropagation()} onDoubleClick={(e)=>e.stopPropagation()}>
      <CardRoot className={`SpDef-frame feed-block-Def`} borderRadius={'5px'} w={'350px'} minH={'30px'} boxShadow={'0px 0px 20px rgba(0, 0, 0, 0.4)'}>
        <GraphCtx.Provider value={extendedGCtx}>
          <Card id={id} content={data.content} focus options={{twoSides:false, stats:false}} />
        </GraphCtx.Provider>
      </CardRoot>
    </Box>
    )}/>
  )
};

function rgba2hex(orig: any): string {
  if (!orig) return '#555555ff';
  if (typeof orig === 'string' && orig.startsWith('#')) {
    if (orig.length === 4) {
      const [, r, g, b] = orig;
      return `#${r}${r}${g}${g}${b}${b}ff`;
    }
    if (orig.length === 5) {
      const [, r, g, b, a] = orig;
      return `#${r}${r}${g}${g}${b}${b}${a}${a}`;
    }
    if (orig.length === 7) return orig + 'ff'; 
    if (orig.length === 9) return orig.toLowerCase();
    return orig.toLowerCase();
  }

  const rgb = orig.replace(/\s/g, '').match(/^rgba?\((\d+),(\d+),(\d+),?([^,\s)]+)?/i);
  if (!rgb) return '#555555ff';
  
  const r = parseInt(rgb[1], 10);
  const g = parseInt(rgb[2], 10);
  const b = parseInt(rgb[3], 10);
  let a = 1.0;
  const alpha = Math.round(a * 255);
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}${alpha.toString(16).padStart(2, '0')}`;
}

const generateRandomHexColor = (alpha: number = 0.15): string => {
  const r = Math.floor(Math.random() * 150 + 50);
  const g = Math.floor(Math.random() * 150 + 50);
  const b = Math.floor(Math.random() * 150 + 50);
  const alphaHex = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}${alphaHex}`;
};

const normalizeColorToHex = (color: any): string => {
  if (!color) return '#555555ff';
  return rgba2hex(color);
};

const drawRoundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const Flow = React.forwardRef(({ onCanvasHover, onContextMenu, onDoubleClickNode, sel }: any, ref:any) => {
  const gCtx = useGraphCtx() as any;
  const { ns, setNs, gRef, groups, setGroups } = gCtx;

  const { nodeToGroup, groupToGroup, groupSets } = useMemo(() => {
     const gSets: Record<string, Set<string>> = {};
     Object.entries(groups).forEach(([gName, gData]: [string, any]) => {
         gSets[gName] = new Set(gData.nodes || []);
     });
     
     const g2g: Record<string, string> = {};
     const gNames = Object.keys(groups);
     
     const isSubset = (setA: Set<string>, setB: Set<string>) => {
         if (setA.size === 0) return false;
         for (let elem of setA) {
             if (!setB.has(elem)) return false;
         }
         return true;
     };
     
     gNames.forEach(g1 => {
         let bestParent: string | null = null;
         let minSize = Infinity;
         const s1 = gSets[g1];
         
         gNames.forEach(g2 => {
             if (g1 === g2) return;
             const s2 = gSets[g2];
             let isChild = false;
             
             if (s1.size > 0 && s1.size < s2.size) {
                 if (isSubset(s1, s2)) isChild = true;
             } else if (s1.size > 0 && s1.size === s2.size) {
                 if (g1 > g2 && isSubset(s1, s2)) isChild = true;
             }
             
             if (isChild && s2.size < minSize) {
                 bestParent = g2;
                 minSize = s2.size;
             }
         });
         
         if (bestParent) g2g[g1] = bestParent;
     });
     
     const n2g: Record<string, string> = {};
     Object.keys(groups).forEach(g => {
          (groups[g].nodes || []).forEach((n: string) => {
              if (!n2g[n]) {
                  let bestGroup: string | null = null;
                  let minSize = Infinity;
                  gNames.forEach(gx => {
                      if (gSets[gx].has(n) && gSets[gx].size < minSize) {
                          bestGroup = gx;
                          minSize = gSets[gx].size;
                      }
                  });
                  if (bestGroup) n2g[n] = bestGroup;
              }
          });
     });
     return { nodeToGroup: n2g, groupToGroup: g2g, groupSets: gSets };
  }, [groups]);

  const [activeNs, activeGroups] = useMemo(() => {
    if (!sel || sel.length === 0) return [ns, groups];

    const selSetFast = new Set(sel);

    const fNs: any = {};
    sel.forEach((id: string) => {
      if (ns[id] !== undefined) fNs[id] = ns[id];
    });

    const fGroups: any = {};
    const groupsToKeep = new Set<string>();

    sel.forEach((id: string) => {
      if (groups[id]) groupsToKeep.add(id);

      let currG = nodeToGroup[id] || groupToGroup[id];
      while (currG) {
        groupsToKeep.add(currG);
        currG = groupToGroup[currG];
      }
    });

    groupsToKeep.forEach(gId => {
      if (groups[gId]) {
        fGroups[gId] = {
          ...groups[gId],
          nodes: groups[gId].nodes.filter((n: string) => selSetFast.has(n) || groupsToKeep.has(n))
        };
      }
    });

    return [fNs, fGroups];
  }, [ns, groups, sel, nodeToGroup, groupToGroup]);

  const [reactflowNs, reactflowEs] = useMemo(
    () => calcG(activeNs, activeGroups, {x:1, y:1}), [activeNs, activeGroups]
  );

  const exportWrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const underlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const selectionBoxRef = useRef<{x: number, y: number, w: number, h: number} | null>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const graphRef = useRef(new Graphology());
  const curSelected = useRef(new Set<string>());
  
  const hoveredNode = useRef<string | null>(null);
  const hoveredGroup = useRef<string | null>(null);

  const isFirstLoad = useRef(true);
  
  const[tempNode, setTempNode] = useState<any>(null);
  const tempContentRef = useRef('');
  const[tempPos, setTempPos] = useState({x: 0, y: 0});
  const tempNodeRef = useRef(tempNode);
  const[nodeToZoomId, setNodeToZoomId] = useState<string|null>(null);
  const[exportMenuOpen, setExportMenuOpen] = useState(false);
  const[exportName, setExportName] = useState('graph');
  
  const groupDescendantsRef = useRef<Record<string, string[]>>({});
  const sortedGroupsRef = useRef<string[]>([]);
  const onDoubleClickNodeRef = useRef(onDoubleClickNode);
  const [cameraInfo, setCameraInfo] = useState({ x: 0, y: 0, ratio: 1 });

  const activeGroupsRef = useRef(activeGroups);
  useEffect(() => { activeGroupsRef.current = activeGroups; }, [activeGroups]);

  useEffect(() => { onDoubleClickNodeRef.current = onDoubleClickNode; }, [onDoubleClickNode]);

  useEffect(() => {
    const desc: Record<string, string[]> = {};
    Object.keys(activeGroups).forEach(gName => {
        let res: string[] =[];
        const queue =[gName];
        while(queue.length > 0) {
            const cur = queue.shift()!;
            if (activeGroups[cur] && activeGroups[cur].nodes) res.push(...activeGroups[cur].nodes);
            const cg = Object.keys(activeGroups).filter(g => groupToGroup[g] === cur);
            queue.push(...cg);
        }
        desc[gName] = res;
    });
    groupDescendantsRef.current = desc;
    sortedGroupsRef.current = Object.keys(activeGroups).sort((a,b) => {
        let depthA = 0; let currA = a; while(groupToGroup[currA]) { depthA++; currA = groupToGroup[currA]; }
        let depthB = 0; let currB = b; while(groupToGroup[currB]) { depthB++; currB = groupToGroup[currB]; }
        return depthA - depthB;
    });
  },[activeGroups, groupToGroup]);

  useEffect(()=>{tempNodeRef.current = tempNode;},[tempNode]);

  useEffect(() => {
    if (!containerRef.current) return;
    const renderer = new Sigma(graphRef.current, containerRef.current, {
      renderLabels: false,
      defaultEdgeColor: "rgba(255, 255, 255, 0.1)",
      renderEdgeLabels: false,
      autoRescale: false,
      defaultDrawNodeHover: () => null,
      doubleClickZoomingRatio: sigmaRef.current?sigmaRef.current.getCamera().ratio:1,
    });
    const updateCameraInfo = () => {
      if (sigmaRef.current) {
        const cam = (sigmaRef.current as any).camera;
        setCameraInfo({
          x: cam.x,
          y: cam.y,
          ratio: parseFloat(cam.ratio.toFixed(2))
        });
      }
    };
    updateCameraInfo();
    if (sigmaRef.current){
      (sigmaRef.current as any).camera.on("updated", updateCameraInfo);
    }
    // @ts-ignore
    renderer.camera.removeListener("updated", updateCameraInfo);
    sigmaRef.current = renderer;
    
    let lastHoveredNode: string | null = null;
    let lastHoveredGroup: string | null = null;

    const handleCustomHover = (e: MouseEvent) => {
      if (!containerRef.current || !sigmaRef.current || !overlayCanvasRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const scale = 1 / sigmaRef.current.getCamera().ratio;
      
      let foundNode: string | null = null;
      let foundGroup: string | null = null;

      graphRef.current.forEachNode((node, data) => {
        if (data.isGroup) return;
        const nodeAttrs = graphRef.current.getNodeAttributes(node);
        if (!nodeAttrs) return;
        const vp = sigmaRef.current!.graphToViewport({ x: nodeAttrs.x, y: nodeAttrs.y });
        const nodeX = vp.x;
        const nodeY = vp.y;
        const nodeW = (nodeAttrs.width || 160) * scale;
        const nodeH = (nodeAttrs.height || 36) * scale;
        if (
          mouseX >= nodeX - nodeW/2 &&
          mouseX <= nodeX + nodeW/2 &&
          mouseY >= nodeY - nodeH/2 &&
          mouseY <= nodeY + nodeH/2
        ) {
          foundNode = node;
        }
      });

      if (!foundNode) {
        for (let i = sortedGroupsRef.current.length - 1; i >= 0; i--) {
           const gName = sortedGroupsRef.current[i];
           const gNode = graphRef.current.hasNode(gName) ? graphRef.current.getNodeAttributes(gName) : null;
           if (gNode && gNode.width !== undefined) {
             const vp = sigmaRef.current!.graphToViewport({ x: gNode.x, y: gNode.y });
             const gw = gNode.width * scale;
             const gh = gNode.height * scale;
             if (
               mouseX >= vp.x - gw / 2 &&
               mouseX <= vp.x + gw / 2 &&
               mouseY >= vp.y - gh / 2 &&
               mouseY <= vp.y + gh / 2
             ) {
               foundGroup = gName;
               break;
             }
           }
        }
      }

      if (foundNode !== lastHoveredNode || foundGroup !== lastHoveredGroup) {
        lastHoveredNode = foundNode;
        lastHoveredGroup = foundGroup;
        hoveredNode.current = foundNode;
        hoveredGroup.current = foundGroup;
        if (onCanvasHover) onCanvasHover(foundNode || foundGroup);
        sigmaRef.current?.refresh();
      }
    };

    const handleMouseLeave = () => {
      if (lastHoveredNode !== null || lastHoveredGroup !== null) {
        lastHoveredNode = null;
        lastHoveredGroup = null;
        hoveredNode.current = null;
        hoveredGroup.current = null;
        if (onCanvasHover) onCanvasHover(null);
        sigmaRef.current?.refresh();
      }
    };

    containerRef.current.addEventListener('mousemove', handleCustomHover);
    containerRef.current.addEventListener('mouseleave', handleMouseLeave);

    const syncCanvasSize = () => {
      if (!underlayCanvasRef.current || !overlayCanvasRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      underlayCanvasRef.current.width = Math.floor(rect.width * dpr);
      underlayCanvasRef.current.height = Math.floor(rect.height * dpr);
      overlayCanvasRef.current.width = Math.floor(rect.width * dpr);
      overlayCanvasRef.current.height = Math.floor(rect.height * dpr);
      underlayCanvasRef.current.style.width = `${rect.width}px`;
      underlayCanvasRef.current.style.height = `${rect.height}px`;
      overlayCanvasRef.current.style.width = `${rect.width}px`;
      overlayCanvasRef.current.style.height = `${rect.height}px`;
    };

    syncCanvasSize();
    const resizeObserver = new ResizeObserver(syncCanvasSize);
    resizeObserver.observe(containerRef.current);
    window.addEventListener('resize', syncCanvasSize);
    
    renderer.on("afterRender", () => {
      const underCtx = underlayCanvasRef.current?.getContext("2d");
      const overCtx = overlayCanvasRef.current?.getContext("2d");
      if (!underCtx || !overCtx || !underlayCanvasRef.current || !overlayCanvasRef.current) return;
      const dpr = window.devicePixelRatio || 1;
      const width = underlayCanvasRef.current.width / dpr;
      const height = underlayCanvasRef.current.height / dpr;
      if (underlayCanvasRef.current.width !== Math.floor(width * dpr)) {
        syncCanvasSize();
        return;
      }

      updateCameraInfo();

      underCtx.save(); 
      overCtx.save();
      underCtx.scale(dpr, dpr); 
      overCtx.scale(dpr, dpr);
      underCtx.clearRect(0, 0, width, height); 
      overCtx.clearRect(0, 0, width, height);
      const scale = 1 / renderer.getCamera().ratio;
      
      sortedGroupsRef.current.forEach(gName => {
        const gData = activeGroupsRef.current[gName] || { color: '#555555' };
        const groupNode = graphRef.current.hasNode(gName) ? graphRef.current.getNodeAttributes(gName) : null;
        if (!groupNode || groupNode.width === undefined) return;
        
        const vp = renderer.graphToViewport({ x: groupNode.x, y: groupNode.y });
        const gw = groupNode.width * scale;
        const gh = groupNode.height * scale;
        const minX = vp.x - gw / 2;
        const minY = vp.y - gh / 2;
        
        const isHovered = hoveredGroup.current === gName;

        let baseColor = gData.color || '#555555';
        if (!baseColor.startsWith('#')) baseColor = rgba2hex(baseColor) || '#555555';
        baseColor = baseColor.padEnd(7, '0');
        if (baseColor.length === 4) {
          baseColor = '#' + baseColor[1] + baseColor[1] + baseColor[2] + baseColor[2] + baseColor[3] + baseColor[3];
        }

        let r = parseInt(baseColor.slice(1, 3), 16) || 85;
        let g = parseInt(baseColor.slice(3, 5), 16) || 85;
        let b = parseInt(baseColor.slice(5, 7), 16) || 85;
        let a = 255;

        if (isHovered) {
           r = Math.min(255, Math.floor(r * 1.2 + 20));
           g = Math.min(255, Math.floor(g * 1.2 + 20));
           b = Math.min(255, Math.floor(b * 1.2 + 20));
           a = Math.min(1, a + 0.15); 
        }

        underCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
        drawRoundRect(underCtx, minX, minY, gw, gh, 8 * scale);
        underCtx.fill();
      });

      graphRef.current.forEachNode((node, data) => {
        if (data.isGroup) return;
        const nodeAttrs = graphRef.current.getNodeAttributes(node);
        if (!nodeAttrs) return;
        const vp = renderer.graphToViewport({ x: nodeAttrs.x, y: nodeAttrs.y });
        const x = vp.x;
        const y = vp.y;
        const isSelected = curSelected.current.has(node);
        const isHovered = hoveredNode.current === node;
        const w = (nodeAttrs.width || 160) * scale; 
        const h = (nodeAttrs.height || 36) * scale;
        
        if (data.status?.isLocked && !isSelected && !isHovered) {
          overCtx.fillStyle = "rgba(30, 30, 30, 1.0)";
        } else if (isSelected) {
          overCtx.fillStyle = "rgba(49, 130, 206, 1.0)";
        } else if (isHovered) {
          overCtx.fillStyle = "rgba(45, 55, 72, 1.0)";
        } else {
          overCtx.fillStyle = "rgba(10, 10, 10, 1.0)";
        }

        drawRoundRect(overCtx, x - w/2, y - h/2, w, h, 6 * scale);
        overCtx.fill();
        
        if (data.status && !data.status.isLocked) {
          let dotColor = "#718096";
          if (data.status.isNew) dotColor = "#3182ce";
          else if (data.status.isDue) dotColor = "#e53e3e";
          else if (data.status.isLearned) dotColor = "#38a169";
          overCtx.fillStyle = dotColor;
          overCtx.beginPath();
          overCtx.arc(x + w/2 - 12 * scale, y - h/2 + 12 * scale, 3.5 * scale, 0, Math.PI * 2);
          overCtx.fill();
        }
        
        const maxTextWidth = w - 16;
        if (maxTextWidth > 15) { 
          overCtx.fillStyle = data.status?.isLocked ? "rgba(255,255,255,0.2)" : "#ffffff";
          overCtx.font = `500 12px 'Merriweather', 'Roboto', sans-serif`;
          overCtx.textAlign = "center";
          overCtx.textBaseline = "middle";
          
          let text = data.label || "";
          let tw = overCtx.measureText(text).width;
          
          if (tw > maxTextWidth) {
              const ratio = maxTextWidth / tw;
              const keepChars = Math.max(1, Math.floor(text.length * ratio) - 2);
              text = text.slice(0, keepChars) + '..';
          }
          overCtx.fillText(text, x, y);
        }
      });

      sortedGroupsRef.current.forEach(gName => {
        const groupNode = graphRef.current.hasNode(gName) ? graphRef.current.getNodeAttributes(gName) : null;
        if (!groupNode || groupNode.width === undefined) return;
        
        const vp = renderer.graphToViewport({ x: groupNode.x, y: groupNode.y });
        const gw = groupNode.width * scale;
        const gh = groupNode.height * scale;
        const minX = vp.x - gw / 2;
        const minY = vp.y - gh / 2;

        if (gw < 30 || gh < 20) return; 

        overCtx.font = `600 13px 'Roboto', sans-serif`;
        let text = gName;
        const maxTextW = gw - 16; 

        let tw = overCtx.measureText(text).width;
        if (tw > maxTextW) {
            const ratio = maxTextW / tw;
            const keepChars = Math.max(1, Math.floor(text.length * ratio) - 2);
            text = text.slice(0, keepChars) + '..';
            tw = overCtx.measureText(text).width;
        }

        const pillW = tw + 16; 
        const pillH = 22; 
        const pillX = minX + 5;
        const pillY = minY + 5; 

        overCtx.fillStyle = "rgba(30, 30, 30, 0.95)"; 
        drawRoundRect(overCtx, pillX, pillY, pillW, pillH, 6);
        overCtx.fill();
        
        overCtx.strokeStyle = "rgba(255, 255, 255, 0.1)"; 
        overCtx.lineWidth = 1;
        overCtx.stroke();

        overCtx.fillStyle = "#ffffff";
        overCtx.textAlign = "left";
        overCtx.textBaseline = "middle";
        overCtx.fillText(text, pillX + 8, pillY + pillH / 2 + 1);
      });

      if (selectionBoxRef.current) {
          const { x, y, w, h } = selectionBoxRef.current;
          overCtx.fillStyle = "rgba(49, 130, 206, 0.15)";
          overCtx.fillRect(x, y, w, h);
          overCtx.strokeStyle = "rgba(49, 130, 206, 0.8)";
          overCtx.lineWidth = 1;
          overCtx.strokeRect(x, y, w, h);
      }

      underCtx.restore(); 
      overCtx.restore();
    });

    renderer.on("doubleClickNode", (e: any) => {
      e.event.original.preventDefault();
      onDoubleClickNodeRef.current?.(e.node);
    });

    renderer.on("clickNode", (e:any) => {
      const isCtrl = e.event.original.ctrlKey || e.event.original.metaKey;
      if (isCtrl) {
        if (curSelected.current.has(e.node)) curSelected.current.delete(e.node);
        else curSelected.current.add(e.node);
      } else {
        curSelected.current.clear();
        curSelected.current.add(e.node);
      }
      renderer.refresh();
      if (gRef.current && gRef.current.select) gRef.current.select(Array.from(curSelected.current));
    });

    renderer.on("clickStage", () => {
      curSelected.current.clear();
      renderer.refresh();
      if (gRef.current && gRef.current.select) gRef.current.select([]);
    });

    renderer.on("rightClickNode", (e:any) => {
      e.event.original.preventDefault();
      if (!curSelected.current.has(e.node)) {
        curSelected.current.clear(); 
        curSelected.current.add(e.node);
        renderer.refresh();
        if (gRef.current && gRef.current.select) gRef.current.select(Array.from(curSelected.current));
      }
      onContextMenu?.(e.event.original);
    });

    renderer.on("rightClickStage", (e:any) => {
      e.event.original.preventDefault();
      if (curSelected.current.size > 0) {
        onContextMenu?.(e.event.original);
      }
    });

    const updateTempNodePos = () => {
      if (tempNodeRef.current && sigmaRef.current) {
        const vp = sigmaRef.current.graphToViewport(tempNodeRef.current.position);
        setTempPos({ x: vp.x, y: vp.y });
      }
    };
    (renderer as any).camera.on("updated", updateTempNodePos);
    let isSpaceDown = false;
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space' && containerRef.current) {
            isSpaceDown = true;
            containerRef.current.style.cursor = 'grab';
        }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
        if (e.code === 'Space' && containerRef.current) {
            isSpaceDown = false;
            containerRef.current.style.cursor = 'default';
        }
    };
    const handleBlur = () => { 
        isSpaceDown = false; 
        if (containerRef.current) containerRef.current.style.cursor = 'default'; 
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    let isSelecting = false;
    let startPos = { x: 0, y: 0 };
    let lastClickTime = 0;
    
    const onPointerDown = (e:MouseEvent|PointerEvent|TouchEvent|any) => {
        if (e.button !== 0) return;
        if (!hoveredNode.current && !isSpaceDown && !e.ctrlKey && !e.metaKey) {
            e.stopPropagation();
            
            const now = Date.now();
            const rect = containerRef.current!.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            if (now - lastClickTime < 300) {
                const graphPos = renderer.viewportToGraph({ x, y });
                setTempNode({ id: `id_${Date.now()}`, position: graphPos, content: '' });
                setTempPos({ x, y });
                isSelecting = false;
                selectionBoxRef.current = null;
                lastClickTime = 0;
                return;
            }

            lastClickTime = now;
            isSelecting = true;
            startPos = { x, y };
            selectionBoxRef.current = { x: startPos.x, y: startPos.y, w: 0, h: 0 };
        }
    };

    const onPointerMove = (e:MouseEvent|PointerEvent|TouchEvent|any) => {
        if (isSelecting) {
            e.stopPropagation();
            const rect = containerRef.current!.getBoundingClientRect();
            const currentX = e.clientX - rect.left;
            const currentY = e.clientY - rect.top;
            
            selectionBoxRef.current = {
                x: Math.min(startPos.x, currentX),
                y: Math.min(startPos.y, currentY),
                w: Math.abs(currentX - startPos.x),
                h: Math.abs(currentY - startPos.y)
            };
            renderer.refresh();
        }
    };

    const onPointerUp=(e:MouseEvent|PointerEvent|TouchEvent|any) => {
        if (isSelecting) {
            isSelecting = false;
            e.stopPropagation();
            const box = selectionBoxRef.current;
            selectionBoxRef.current = null;
            
            if (box && (box.w > 5 || box.h > 5)) {
                const selectedIds: string[] =[];
                const scale = 1 / renderer.getCamera().ratio;

                graphRef.current.forEachNode((node, attrs) => {
                    if (attrs.isGroup) return;
                    const vp = renderer.graphToViewport({ x: attrs.x, y: attrs.y });
                    const nodeW = (attrs.width || 160) * scale;
                    const nodeH = (attrs.height || 36) * scale;
                    
                    const nodeLeft = vp.x - nodeW / 2;
                    const nodeTop = vp.y - nodeH / 2;
                    const nodeRight = vp.x + nodeW / 2;
                    const nodeBottom = vp.y + nodeH / 2;

                    const boxLeft = box.x;
                    const boxTop = box.y;
                    const boxRight = box.x + box.w;
                    const boxBottom = box.y + box.h;
                    
                    if (
                        nodeLeft < boxRight &&
                        nodeRight > boxLeft &&
                        nodeTop < boxBottom &&
                        nodeBottom > boxTop
                    ) {
                        selectedIds.push(node);
                    }
                });
                
                if (!e.shiftKey) curSelected.current.clear();
                selectedIds.forEach(id => curSelected.current.add(id));
                
                if (gRef.current && gRef.current.select) {
                    gRef.current.select(Array.from(curSelected.current));
                }
            } else if (box && box.w <= 5 && box.h <= 5) {
                if (tempNodeRef.current) {
                    const finalContent = tempContentRef.current;
                    if (finalContent.trim() !== '') {
                        setNs((prev: any) => ({ ...prev,[tempNodeRef.current.id]: finalContent }));
                        setNodeToZoomId(tempNodeRef.current.id);
                    }
                    setTempNode(null);
                }
                curSelected.current.clear();
                if (gRef.current && gRef.current.select) gRef.current.select([]);
            }
            renderer.refresh();
        }
    };

    containerRef.current.addEventListener('mousedown', onPointerDown, { capture: true });
    containerRef.current.addEventListener('touchstart', onPointerDown, { capture: true });
    window.addEventListener('mousemove', onPointerMove, { capture: true });
    window.addEventListener('touchmove', onPointerMove, { capture: true });
    window.addEventListener('mouseup', onPointerUp, { capture: true });
    window.addEventListener('touchend', onPointerUp, { capture: true });

    return () => {
      // @ts-ignore
      renderer.camera.removeListener("updated", updateTempNodePos);
      resizeObserver.disconnect();
      window.removeEventListener('resize', syncCanvasSize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      if (containerRef.current) {
          containerRef.current.removeEventListener('mousedown', onPointerDown, { capture: true });
          containerRef.current.removeEventListener('touchstart', onPointerDown, { capture: true });
      }
      window.removeEventListener('mousemove', onPointerMove, { capture: true });
      window.removeEventListener('touchmove', onPointerMove, { capture: true });
      window.removeEventListener('mouseup', onPointerUp, { capture: true });
      window.removeEventListener('touchend', onPointerUp, { capture: true });
      containerRef.current?.removeEventListener('mousemove', handleCustomHover);
      containerRef.current?.removeEventListener('mouseleave', handleMouseLeave);
      renderer.kill();
    };
  },[gRef, onContextMenu]);

  useEffect(() => {
    if (!sigmaRef.current || !tempNode) return;
    const updatePos = () => { setTempPos(sigmaRef.current!.graphToViewport(tempNode.position)); };
    (sigmaRef.current as any).camera.on("updated", updatePos);
    return () => (sigmaRef.current as any)!.camera.removeListener("updated", updatePos);
  },[tempNode]);


  useEffect(() => {
    const graph = graphRef.current;
    const repeats = gCtx.repeats || {};

    const existingNodes = new Set(graph.nodes());
    const existingEdges = new Set(graph.edges());

    reactflowNs.forEach((n: any) => {
      const isGroup = n.type === 'SpGroup';
      
      if (isGroup) {
         if (graph.hasNode(n.id)) {
            graph.updateNode(n.id, attrs => ({ ...attrs, x: n.position.x, y: n.position.y, width: n.width, height: n.height }));
            existingNodes.delete(n.id);
         } else {
            graph.addNode(n.id, { x: n.position.x, y: n.position.y, width: n.width, height: n.height, isGroup: true, color: "rgba(0,0,0,0)", size: 0 });
         }
         return;
      }

      let label = n.id;
      let status = { isLocked: false, isNew: true, isDue: false, isLearned: false, level: 0 };
      if (ns[n.id] !== undefined) {
        label = (
          ns[n.id].split(SIDE_SPLIT_SYM)[0].replace(/<[^>]*>?/gm, '').trim()
        )
        try { status = getCardState(n.id, ns, repeats); } catch(e) {}
      }

      if (graph.hasNode(n.id)) {
         graph.updateNode(n.id, attrs => ({
             ...attrs,
             x: n.position.x,
             y: n.position.y,
             width: n.width,
             height: n.height,
             label: label,
             status: status
         }));
         existingNodes.delete(n.id);
      } else {
         graph.addNode(n.id, {
             x: n.position.x,
             y: n.position.y,
             width: n.width,
             height: n.height,
             size: 15,
             label: label,
             color: "rgba(0,0,0,0)",
             isGroup: false,
             status
         });
      }
    });

    reactflowEs.forEach((e: any) => {
      const source = e.source;
      const target = e.target;
      if (graph.hasNode(source) && graph.hasNode(target)) {
          if (graph.hasEdge(source, target)) {
             existingEdges.delete(graph.edge(source, target)!);
          } else {
             graph.addEdge(source, target, { size: 1, color: 'gray' });
          }
      }
    });

    existingEdges.forEach(e => {
      if (graph.hasEdge(e)) {
        graph.dropEdge(e);
      }
    });

    existingNodes.forEach(n => {
      if (graph.hasNode(n)) {
        graph.dropNode(n);
      }
    });

    if (sigmaRef.current) sigmaRef.current.refresh();
  },[reactflowNs, reactflowEs, ns]);

  const prevSelStr = useRef(JSON.stringify(sel));
  useEffect(() => {
     const curSelStr = JSON.stringify(sel);
     if (isFirstLoad.current && reactflowNs.length > 0 && sigmaRef.current) {
        setTimeout(() => {
           if (sigmaRef.current) {
               (sigmaRef.current as any).camera.animatedReset({ duration: 400 });
               isFirstLoad.current = false;
           }
        }, 50);
     } else if (sigmaRef.current && curSelStr !== prevSelStr.current) {
        if (sel.length <= 1) {
            setTimeout(() => {
               if (sigmaRef.current) {
                   (sigmaRef.current as any).camera.animatedReset({ duration: 300 });
               }
            }, 50);
        }
        prevSelStr.current = curSelStr;
     }
  }, [sel, reactflowNs]);

  useEffect(() => {
    if (nodeToZoomId && sigmaRef.current && graphRef.current.hasNode(nodeToZoomId)) {
      const timer = setTimeout(() => {
        const displayData = (sigmaRef.current as any).getNodeDisplayData(nodeToZoomId);
        if (displayData) {
          const px = Number(displayData.x);
          const py = Number(displayData.y);
          if (!isNaN(px) && !isNaN(py)) {
            const currentRatio = (sigmaRef.current as any).camera.ratio;
            const targetRatio = 0.8;
            (sigmaRef.current as any)!.camera.animate({ x: px, y: py, ratio: targetRatio }, { duration: 150 });
          }
        }
        setNodeToZoomId(null);
      }, 150);
      return () => clearTimeout(timer);
    }
  },[nodeToZoomId]); 

  useImperativeHandle(ref,()=>({
    setSelectionExternally: (ids: string[]) => {
      curSelected.current = new Set(ids);
      if (sigmaRef.current) sigmaRef.current.refresh();
    },
    setHoveredExternally: (id: string | null) => {
      if (id && activeGroups[id]) {
        hoveredGroup.current = id;
        hoveredNode.current = null;
      } else {
        hoveredNode.current = id;
        hoveredGroup.current = null;
      }
      if (sigmaRef.current) sigmaRef.current.refresh();
    },
    triggerShortcutMenu: () => {
      if (curSelected.current.size > 0) {
        onContextMenu?.({ clientX: window.innerWidth / 2 - 100, clientY: window.innerHeight / 2 - 50, preventDefault: () => {} });
      }
    },
    zoomToNode: (id: string) => {
      setNodeToZoomId(id);
    }
  }));

  return (
    <Box ref={exportWrapperRef} className='graphFrame' tabIndex={0} position="relative">
      <canvas 
        ref={underlayCanvasRef} 
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0, backgroundColor: 'transparent' }} 
      />
      
      <div 
        ref={containerRef} 
        className="sigma-container" 
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, backgroundColor: 'transparent' }} 
      />
      
      <canvas 
        ref={overlayCanvasRef} 
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2, backgroundColor: 'transparent' }} 
      />
      
      {tempNode && (
        <Box position="absolute" left={tempPos.x} top={tempPos.y} transform="translate(-50%, -50%)" zIndex={100}>
          <TempDef id={tempNode.id} data={{ content: tempNode.content, setContent: (val: string) => { tempContentRef.current = val; setTempNode((prev: any) => ({ ...prev, content: val })); }, gCtx }} />
        </Box>
      )}

      <HStack className="sigma-tools-panel" gap="2" zIndex={50}>
        <Box 
          px={2} py={1} 
          bg="rgba(30,30,30,0.7)" 
          borderRadius="md" 
          fontSize="10px" 
          fontFamily="monospace"
          color="gray.300"
          backdropFilter="blur(5px)"
        >
          x: {cameraInfo.x} | y: {cameraInfo.y} | z: {cameraInfo.ratio}x
        </Box>
        <Box position="relative">
          <IconButton aria-label="export graph" variant="subtle" size="sm" bg="rgba(150, 150, 150, 0.1)" backdropFilter="blur(5px)" borderRadius="md" onClick={() => setExportMenuOpen(!exportMenuOpen)}>
            <PiExport size="14px" />
          </IconButton>
          {exportMenuOpen && (
            <Box position="absolute" top="100%" right={0} mt="8px" bg="color-mix(in srgb, #445 90%, transparent)" border="1px solid color-mix(in srgb, #666 60%, transparent)" backdropFilter="blur(20px)" p="8px" borderRadius="md" boxShadow="dark-lg" zIndex={1000} w="200px">
              <VStack align="stretch" gap={2}>
                <Text fontSize="12px" color="gray.400" mb="-4px">Имя файла</Text>
                <input autoFocus value={exportName} onChange={(e) => setExportName(e.target.value)} placeholder="graph" style={{ background: 'rgba(0,0,0,0.3)', color: 'white', padding: '4px 8px', border: '1px solid gray', borderRadius: '3px', outline: 0, width: '100%', fontSize: '12px' }} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') handleExport('png'); if (e.key === 'Escape') setExportMenuOpen(false); }}/>
                <HStack gap={1} mt={1}>
                  <Button flex={1} size="sm" height="24px" fontSize="12px" variant="subtle" colorPalette="blue" onClick={() => handleExport('png')}>PNG</Button>
                  <Button flex={1} size="sm" height="24px" fontSize="12px" variant="subtle" colorPalette="blue" onClick={() => handleExport('svg')}>SVG</Button>
                </HStack>
              </VStack>
            </Box>
          )}
        </Box>
        <IconButton aria-label="center graph" variant="subtle" size="sm" bg="rgba(150, 150, 150, 0.1)" backdropFilter="blur(5px)" borderRadius="md" onClick={() => (sigmaRef.current as any)?.camera.animatedReset({ duration: 300 })}>
          <MdFilterCenterFocus size="20px" />
        </IconButton>
      </HStack>
    </Box>
  )
});

const TreeRowContent = memo(({
  item, actions, nsContent, groupData, isEditingCard, isSel, isFirstSel, isLastSel, isCanvasHovered, isDropTargetInside
}: any) => {
  const isGroup = item.type === 'group';
  const itemHexColor = isGroup ? (groupData?.color?.startsWith('#') ? groupData.color : rgba2hex(groupData?.color || '#555555')) : null;
  
  const [localColor, setLocalColor] = useState(itemHexColor || '#555555');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.id);

  useEffect(() => {
    if (isGroup && localColor !== itemHexColor && itemHexColor) {
      const handler = setTimeout(() => { actions.handleChangeGroupColor(item.id, localColor); }, 200);
      return () => clearTimeout(handler);
    }
  }, [localColor, itemHexColor, item.id, isGroup, actions]);

  const onRenameSubmit = () => {
    setIsEditing(false);
    if (!editName || editName === item.id || actions.hasGroup(editName)) { setEditName(item.id); return; }
    actions.handleRenameGroup(item.id, editName);
  };

  const isMergedTop = isSel && !isFirstSel;
  const isMergedBottom = isSel && !isLastSel;

  const innerBg = isSel 
    ? (isFirstSel ? 'rgba(49, 130, 206, 0.4)' : 'rgba(49, 130, 206, 0.2)') 
    : (isCanvasHovered ? 'rgba(255, 255, 255, 0.1)' : 'transparent');

  const hoverBg = isSel 
    ? (isFirstSel ? 'rgba(49, 130, 206, 0.4)' : 'rgba(49, 130, 206, 0.25)') 
    : 'whiteAlpha.200';
  const indentPx = item.depth * 20 + (isGroup ? 10 : 8); 

  return (
    <Box
      h={isEditingCard ? "auto" : "100%"}
      minH={isEditingCard ? "auto" : "28px"}
      w="100%"
      display="flex"
      alignItems="center"
      pl={`${indentPx}px`}
      pr="8px"
      bg={isDropTargetInside ? 'rgba(13, 153, 255, 0.2)' : innerBg} 
      borderTopRadius={isMergedTop ? "0px" : "4px"}
      borderBottomRadius={isMergedBottom ? "0px" : "4px"}
      border={isDropTargetInside ? '1px solid #0d99ff' : '1px solid transparent'}
      cursor={isGroup ? "default" : (isEditingCard ? "text" : "pointer")}
      _hover={{ bg: isDropTargetInside ? 'rgba(13, 153, 255, 0.2)' : hoverBg }}
      onMouseOver={(e) => { e.stopPropagation(); actions.onHover(item.id); }}
      onMouseOut={(e) => { e.stopPropagation(); actions.onHover(null); }}
      onClick={(e) => {
        if (isEditingCard) return; 
        e.stopPropagation();
        actions.onClick(e, item.id, item.type);
      }}
      onDoubleClick={(e) => {
        if (!isGroup && actions.onDoubleClickNode) {
          actions.onDoubleClickNode(item.id);
        }
      }}
    >
      {isGroup ? (
        <Box fontSize="11px" fontWeight="500" w="100%" display="flex" flexDirection="row" alignItems="center" gap={'4px'}>
          <IconButton variant={'plain'} h={'20px'} w={'20px'} minW={'20px'} p={0} onClick={(e) => { e.stopPropagation(); actions.onToggleGroup(item.id); }}>
            {item.collapsed ? <LuChevronRight className={'smIcon'} /> : <LuChevronDown className={'smIcon'} />}
          </IconButton>
          <LuPilcrow opacity={0.3} size={'12px'}/>

          {isEditing ? (
            <input autoFocus value={editName} onChange={e => setEditName(e.target.value)}
              onBlur={onRenameSubmit} onClick={e => e.stopPropagation()}
              onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') onRenameSubmit(); if (e.key === 'Escape') { setIsEditing(false); setEditName(item.id); } }}
              style={{ flex: 1, background: 'rgba(0,0,0,0.3)', color: 'white', outline: 'none', border: '1px solid gray', borderRadius: '3px', padding: '0 4px' }}
            />
          ) : (
            <Box opacity={0.3} flex={1} onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}>{item.id}</Box>
          )}
          <Box 
            as="input" 
            type="color" 
            value={itemHexColor?.slice(0, 7) || '#555555'} 
            onChange={(e:any)=>{ e.stopPropagation(); setLocalColor(e.target.value); }} 
            onClick={(e:any)=>{ e.stopPropagation() }} 
            style={{ width: '14px', height: '14px', padding: 0, border: 'none', background: 'none', cursor: 'pointer', borderRadius: '50%' }} 
          />
        </Box>
      ) : (
        <Box 
          className={'wrap?'}
          display={'flex'}
          flex={1}
          minW={0}
          h={isEditingCard ? "auto" : "28px"} 
          m={0}
          my="auto" 
          py={isEditingCard ? 4 : 0} 
          overflow="hidden" 
          pointerEvents={isEditingCard ? "auto" : "none"}
          alignItems="center"
        >
           <Card 
             id={item.id}
             content={nsContent} 
             options={{ stats: false, twoSides: isEditingCard, padding: '0px', fontSize: 11 }} 
             focus={isEditingCard} 
           />
        </Box>
      )}
    </Box>
  );
}, (prev, next) => {
  return prev.item.id === next.item.id &&
         prev.item.collapsed === next.item.collapsed &&
         prev.item.depth === next.item.depth && 
         prev.nsContent === next.nsContent &&
         prev.groupData === next.groupData &&
         prev.isEditingCard === next.isEditingCard &&
         prev.isSel === next.isSel &&
         prev.isFirstSel === next.isFirstSel &&
         prev.isLastSel === next.isLastSel &&
         prev.isCanvasHovered === next.isCanvasHovered &&
         prev.isDropTargetInside === next.isDropTargetInside;
});

const VirtualTreeRow = memo(({ 
  item, style, actions, ns, groups, setRowHeight, selSet, hoveredNodeId, isFirstSel, isLastSel
}: any) => {
  const isEditingCard = actions.editingId === item.id && item.type !== 'group';
  const contentRef = useRef<HTMLDivElement>(null);
  
  const isSel = selSet.has(item.id);
  const isMergedTop = isSel && !isFirstSel;
  const isMergedBottom = isSel && !isLastSel;

  React.useLayoutEffect(() => {
    if (isEditingCard && contentRef.current) {
        setRowHeight(item.id, Math.max(item.staticHeight, contentRef.current.offsetHeight));
    }
  }, [isEditingCard, item.id, item.staticHeight, setRowHeight]);

  useEffect(() => {
      if (!isEditingCard) {
          setRowHeight(item.id, item.staticHeight);
          return;
      }
      if (!contentRef.current) return;
      const obs = new ResizeObserver(entries => {
          for (let e of entries) {
              setRowHeight(item.id, Math.max(item.staticHeight, (e.target as HTMLElement).offsetHeight));
          }
      });
      obs.observe(contentRef.current);
      return () => obs.disconnect();
  }, [item.id, isEditingCard, setRowHeight, item.staticHeight]);

  const { height: styleHeight, top, ...restStyle } = style;
  
  const extraTop = item.extraTop || 0;
  const actualTop = top + extraTop;
  const actualHeight = isEditingCard ? 'auto' : (styleHeight - extraTop);
  
  const isDropTargetInside = actions.dropTarget?.id === item.id && actions.dropTarget?.pos === 'inside';

  return (
    <Box 
      style={{ ...restStyle, top: actualTop, height: actualHeight }}
      className={`tree-row ${isSel ? 'selected' : ''}`}
      data-tree-id={item.id}
      ref={contentRef}
      draggable={!isEditingCard}
      onDragStart={(e) => actions.onDragStart(e, item.id, item.type)}
      onDragOver={(e) => actions.onDragOverRow(e, item.id, item.type)}
      onDragLeave={actions.onDragLeaveRow}
      onDrop={(e) => actions.onDrop(e, item.id, item.type)}
      px="8px"
      pt={isMergedTop ? "0px" : "4px"}
      pb={isMergedBottom ? "0px" : "4px"}
    >
      <TreeRowContent
        item={item}
        actions={actions}
        nsContent={ns[item.id]}
        groupData={groups[item.id]}
        isEditingCard={isEditingCard}
        isSel={isSel}
        isFirstSel={isFirstSel}
        isLastSel={isLastSel}
        isCanvasHovered={hoveredNodeId === item.id}
        isDropTargetInside={isDropTargetInside}
      />
    </Box>
  );
}, (prev, next) => {
  const prevIsEditing = prev.actions.editingId === prev.item.id;
  const nextIsEditing = next.actions.editingId === next.item.id;
  const prevIsTarget = prev.actions.dropTarget?.id === prev.item.id;
  const nextIsTarget = next.actions.dropTarget?.id === next.item.id;
  
  return prev.item.id === next.item.id &&
         prev.item.collapsed === next.item.collapsed &&
         prev.item.depth === next.item.depth && 
         prev.style.top === next.style.top &&
         prev.style.height === next.style.height &&
         prev.selSet.has(prev.item.id) === next.selSet.has(next.item.id) &&
         prev.isFirstSel === next.isFirstSel &&
         prev.isLastSel === next.isLastSel &&
         (prev.hoveredNodeId === prev.item.id) === (next.hoveredNodeId === next.item.id) && 
         prev.ns[prev.item.id] === next.ns[next.item.id] &&
         prevIsEditing === nextIsEditing &&
         prevIsTarget === nextIsTarget &&
         prev.actions.dropTarget?.pos === next.actions.dropTarget?.pos &&
         (prev.item.type === 'node' || prev.groups[prev.item.id] === next.groups[next.item.id]);
});

const VirtualTreeView = memo(React.forwardRef(({ flatTree, sel, ns, groups, actions, hoveredNodeId }: any, ref: any) => {
  const[scrollTop, setScrollTop] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(600);
  
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeout = useRef<any>(null);
  const [heights, setHeights] = useState<Record<string, number>>({});

  const setRowHeight = useCallback((id: string, h: number) => {
    setHeights(prev => prev[id] === h ? prev : { ...prev, [id]: h });
  }, []);

  const tops = useMemo(() => {
    let current = 0;
    return flatTree.map((item: any) => {
        const h = heights[item.id] || item.staticHeight;
        const top = current;
        current += h;
        return top;
    });
  }, [flatTree, heights]);

  const totalHeight = tops.length > 0 ? tops[tops.length - 1] + (heights[flatTree[flatTree.length - 1].id] || flatTree[flatTree.length - 1].staticHeight) : 0;

  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const updateHeight = () => {
      if (scrollContainerRef.current) {
        setContainerHeight(scrollContainerRef.current.clientHeight);
      }
    };
    updateHeight();
    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(scrollContainerRef.current);
    return () => resizeObserver.disconnect();
  },[]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
    setIsScrolling(true);
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => setIsScrolling(false), 150);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    actions.onDragOverRoot(e);
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const rect = container.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const threshold = 50;
      
      if (y < threshold) {
        container.scrollTop -= 10;
      } else if (rect.height - y < threshold) {
        container.scrollTop += 10;
      }
    }
  };

  const selSet = useMemo(() => new Set(sel), [sel]);
  const UPWARD_BUFFER = 5;
  const DOWNWARD_BUFFER = 15;

  let startIndex = 0;
  let low = 0, high = tops.length - 1;
  while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (tops[mid] <= scrollTop) {
          startIndex = mid;
          low = mid + 1;
      } else {
          high = mid - 1;
      }
  }
  startIndex = Math.max(0, startIndex - UPWARD_BUFFER);

  let endIndex = startIndex;
  while (endIndex < tops.length && tops[endIndex] < scrollTop + containerHeight) {
      endIndex++;
  }
  endIndex = Math.min(tops.length - 1, endIndex + DOWNWARD_BUFFER);

  useImperativeHandle(ref, () => ({
    scrollToNode: (id: string) => {
      setTimeout(() => {
        const index = flatTree.findIndex((i: any) => i.id === id);
        if (index !== -1 && scrollContainerRef.current) {
          const itemH = heights[id] || flatTree[index].staticHeight;
          const top = Math.max(0, tops[index] - containerHeight / 2 + itemH / 2);
          try {
            scrollContainerRef.current.scrollTo({ top, behavior: 'instant' });
          } catch(e) {
            scrollContainerRef.current.scrollTop = top; 
          }
        }
      }, 50); 
    }
  }));

  const dropTarget = actions.dropTarget;
  const dropTargetIdx = dropTarget ? flatTree.findIndex((i:any) => i.id === dropTarget.id) : -1;

  return (
    <div 
      className='GraphmodeStack' 
      ref={scrollContainerRef}
      onScroll={handleScroll}
      onDragOver={handleDragOver}
      onDrop={actions.onDropOnRoot}
    >
       <div style={{ 
         height: totalHeight,
         position: 'relative', 
         width: '100%',
         pointerEvents: isScrolling ? 'none' : 'auto'
       }}>
         {dropTarget && dropTargetIdx !== -1 && dropTarget.pos !== 'inside' && (
           <Box
              position="absolute"
              left="0"
              right="0"
              height="2px"
              bg="#0d99ff"
              zIndex={100}
              pointerEvents="none"
              top={(() => {
                const top = tops[dropTargetIdx];
                const item = flatTree[dropTargetIdx];
                const h = heights[dropTarget.id] || item.staticHeight;
                const extra = item.extraTop || 0;
                if (dropTarget.pos === 'top') return top + extra;
                return top + h; 
              })()}
              _before={{
                content: '""',
                position: "absolute",
                left: "4px",
                top: "-2.5px",
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                border: "1.5px solid #0d99ff",
                bg: "#1e1e1e"
              }}
           />
         )}

         {flatTree.map((item: any, index: number) => {
           const isVisible = index >= startIndex && index <= endIndex;
           if (!isVisible) {
             return <Box key={item.id} style={{ position: 'absolute', top: tops[index], height: heights[item.id] || item.staticHeight, width: '100%' }} />;
           }

           const isSel = selSet.has(item.id);
           const isFirstSel = isSel && (index === 0 || !selSet.has(flatTree[index - 1].id));
           const isLastSel = isSel && (index === flatTree.length - 1 || !selSet.has(flatTree[index + 1].id));

           return (
             <VirtualTreeRow 
               key={item.id} 
               item={item} 
               index={index}
               style={{ 
                 position: 'absolute', 
                 top: tops[index], 
                 height: heights[item.id] || item.staticHeight, 
                 width: '100%' 
               }}
               selSet={selSet}
               isFirstSel={isFirstSel}
               isLastSel={isLastSel}
               actions={actions}
               ns={ns}
               groups={groups}
               setRowHeight={setRowHeight}
               hoveredNodeId={hoveredNodeId}
             />
           );
         })}
       </div>
    </div>
  );
}), (prev, next) => {
  return prev.flatTree === next.flatTree &&
         prev.sel === next.sel &&
         prev.ns === next.ns &&
         prev.groups === next.groups &&
         prev.hoveredNodeId === next.hoveredNodeId && 
         prev.actions.editingId === next.actions.editingId &&
         prev.actions.dropTarget?.id === next.actions.dropTarget?.id &&
         prev.actions.dropTarget?.pos === next.actions.dropTarget?.pos;
});

const reorderRootKeys = (obj: any, targetId: string, selectedIds: string[], pos: 'top'|'bottom'|'inside') => {
  const keys = Object.keys(obj).filter(k => !selectedIds.includes(k)); 
  const targetIdx = keys.indexOf(targetId);
  if (targetIdx !== -1) {
      keys.splice(pos === 'top' ? targetIdx : targetIdx + 1, 0, ...selectedIds);
  } else {
      keys.push(...selectedIds);
  }
  const newObj: any = {};
  keys.forEach(k => { if(obj[k] !== undefined) newObj[k] = obj[k]; });
  return newObj;
};

export const Graph=forwardRef(({headerRef}:any,ref:any)=>{
  const{ns,setNs,id,name,groups,setGroups,repeats,setRepeats}=useGraphCtx()as any;
  const[sel,setSel]=useState<string[]>([]);
  const[mode,setMode]=useState('eg') as any;
  const[curName,setCurName]=useState({'0':name}) as any;
  const[editingNodeId, setEditingNodeId] = useState<string | null>(null);
  
  const[hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  
  const flowRef=useRef(null) as any;
  const treeRef=useRef<any>(null); 
  
  const latestNs = useRef(ns);
  const latestGroups = useRef(groups);
  const latestName = useRef(curName);

  const [feedSelection, setFeedSelection] = useState<string[] | null>(null);
  const [feedAutoStart, setFeedAutoStart] = useState(false);
  
  const { open: openMenu, close: closeMenu, props: menuProps } = useContextMenu();

  const [sidebarWidth, setSidebarWidth] = useState(400);
  const isDraggingSidebar = useRef(false);
  const graphSidesRef = useRef<HTMLDivElement>(null);
  
  const [dropTarget, setDropTarget] = useState<{ id: string, pos: 'top'|'bottom'|'inside' } | null>(null);
  const dragFallbackRef = useRef<any>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingSidebar.current || !graphSidesRef.current) return;
      const rect = graphSidesRef.current.getBoundingClientRect();
      const newWidth = Math.max(150, Math.min(rect.width - 150, e.clientX - rect.left));
      setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => {
      if (isDraggingSidebar.current) {
        isDraggingSidebar.current = false;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = '';
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
  }, []);

  useEffect(() => {
    let needsUpdate = false;
    const normalized: any = {};
    Object.entries(groups).forEach(([name, data]:[string, any]) => {
      const hex = normalizeColorToHex(data?.color);
      if (hex !== data?.color) needsUpdate = true;
      normalized[name] = { ...data, color: hex };
    });
    if (needsUpdate) setGroups(normalized);
  },[])

  useEffect(() => {
    if (mode !== 'repeat') {
      setFeedAutoStart(false);
      setFeedSelection(null);
    }
  },[mode]);

  useEffect(() => {
    if (!editingNodeId) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const editingRow = document.querySelector(`[data-tree-id="${editingNodeId}"]`);
      if (editingRow && editingRow.contains(target)) return;
      
      // Задержка позволяет Card выполнить свой нативный onBlur и сохранить изменения в стейт ns
      setTimeout(() => setEditingNodeId(null), 150);
    };
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleClickOutside, { capture: true });
    }, 50);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousedown', handleClickOutside, { capture: true });
    };
  }, [editingNodeId]);

  useEffect(() => { latestNs.current = ns; },[ns]);
  useEffect(() => { latestGroups.current = groups; }, [groups]);
  useEffect(() => { latestName.current = curName; },[curName]);

  useEffect(() => {
    if (flowRef.current && flowRef.current.setSelectionExternally) { 
      flowRef.current.setSelectionExternally(sel); 
    } 
  }, [sel]);

  const { nodeToGroup, groupToGroup, groupSets } = useMemo(() => {
     const gSets: Record<string, Set<string>> = {};
     Object.entries(groups).forEach(([gName, gData]: [string, any]) => {
         gSets[gName] = new Set(gData.nodes || []);
     });
     
     const g2g: Record<string, string> = {};
     const gNames = Object.keys(groups);
     
     const isSubset = (setA: Set<string>, setB: Set<string>) => {
         if (setA.size === 0) return false;
         for (let elem of setA) {
             if (!setB.has(elem)) return false;
         }
         return true;
     };
     
     gNames.forEach(g1 => {
         let bestParent: string | null = null;
         let minSize = Infinity;
         const s1 = gSets[g1];
         
         gNames.forEach(g2 => {
             if (g1 === g2) return;
             const s2 = gSets[g2];
             let isChild = false;
             
             if (s1.size > 0 && s1.size < s2.size) {
                 if (isSubset(s1, s2)) isChild = true;
             } else if (s1.size > 0 && s1.size === s2.size) {
                 if (g1 > g2 && isSubset(s1, s2)) isChild = true;
             }
             
             if (isChild && s2.size < minSize) {
                 bestParent = g2;
                 minSize = s2.size;
             }
         });
         
         if (bestParent) g2g[g1] = bestParent;
     });
     
     const n2g: Record<string, string> = {};
     Object.keys(groups).forEach(g => {
          (groups[g].nodes || []).forEach((n: string) => {
              if (!n2g[n]) {
                  let bestGroup: string | null = null;
                  let minSize = Infinity;
                  gNames.forEach(gx => {
                      if (gSets[gx].has(n) && gSets[gx].size < minSize) {
                          bestGroup = gx;
                          minSize = gSets[gx].size;
                      }
                  });
                  if (bestGroup) n2g[n] = bestGroup;
              }
          });
     });
     return { nodeToGroup: n2g, groupToGroup: g2g, groupSets: gSets };
  }, [groups]);
  
  const[orderedIds, setOrderedIds] = useState<string[]>(Object.keys(ns).filter(k => sel.includes(k)));
  
  useEffect(() => { 
    setOrderedIds(prev => { 
      const selSetFast = new Set(sel);
      const newIds = sel.filter((id: string) => !prev.includes(id)); 
      return [...prev.filter((id: string) => selSetFast.has(id)), ...newIds]; 
    }); 
  }, [sel]);

  const handleMoveCard = (cardId: string, direction: -1 | 1) => {
    setOrderedIds(prev => {
      const idx = prev.indexOf(cardId); if (idx === -1) return prev;
      const newIdx = idx + direction; if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next =[...prev]; [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  };

  const handleTopSort = () => { const sorted = topSort(ns, orderedIds); setOrderedIds(sorted.map(s => s.id)); };

  const handleRenameGroup = useCallback((oldName: string, newName: string) => {
    setGroups((prev: any) => { const updated = { ...prev }; updated[newName] = updated[oldName]; delete updated[oldName]; return updated; });
  },[setGroups]);

  const handleChangeGroupColor = useCallback((groupName: string, newColor: string) => {
    const hexColor = newColor.length === 7 ? newColor : normalizeColorToHex(newColor);
    setGroups((prev: any) => ({ ...prev,[groupName]: { ...prev[groupName], color: hexColor } }));
  }, [setGroups]);

  const handleUngroup = useCallback((groupName: string) => {
    setGroups((prev: any) => { const updated = { ...prev }; delete updated[groupName]; return updated; });
  },[setGroups]);

  const saveGraph = useCallback(async () => {
    const user = await spaced_account.get();
    gReq.update(id, { content: JSON.stringify(latestNs.current), groups: JSON.stringify(latestGroups.current), name: latestName.current['0'], collaborators:[], owner: user.$id });
  },[id]);

  const HeaderTabs = (
    <span css={graphCSS} key={'header_tabs'}>
      <Tabs.Root className='headerTabs' value={mode} onValueChange={(e)=>{
        if (editingNodeId) {
            // Если карточка редактируется, откладываем переход чтобы позволить сохраниться
            setTimeout(() => {
                setMode(e.value);
                setEditingNodeId(null);
            }, 150);
        } else {
            setMode(e.value);
        }
      }} variant="plain">
        <Tabs.Trigger className='tabsTrigger' value="eg"><BsDiagram2Fill /></Tabs.Trigger>
        <Tabs.Trigger className='tabsTrigger' value="tr" ml={'-6px'}><FaParagraph style={{marginLeft:'-1.5px'}}/></Tabs.Trigger>
        <Tabs.Trigger className='tabsTrigger' value="repeat" ml={'-6px'}><RiRepeat2Line /></Tabs.Trigger>
        <GraphCtx.Provider value={{ns:curName, setNs:setCurName}}>
            <Card id={'0'} content={name} options={{twoSides:false, fontSize:12}}/>
        </GraphCtx.Provider>
        <Spacer />
        <Button h={'20px'} gap={'3px'} fontWeight={500} p={'0px 4px'} variant={'ghost'} colorPalette={'green'} onClick={saveGraph}>
          <RiSaveFill style={{height:'13px',width:'13px'}}/>save
        </Button>
        <Clip props={{h:'20px',variant:'ghost',p:'0',w:'20px',minW:'20px'}} copyIcon={<FaShare style={{width:'13px',height:'13px'}}/>} value={APPWRITE_CONFIG.BASE_URL+'/'+id} />
      </Tabs.Root>
    </span>
  );

  useEffect(()=>{
    if (headerRef&&headerRef.current) {
      const f=async()=>{ await headerRef.current.resetContent(); const dc=headerRef.current.getContent(); headerRef.current.setContent([dc[0], HeaderTabs, dc[2]]); }
      f();
    }
  },[mode,groups,curName]);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = useCallback((gId: string) => {
    setCollapsedGroups(prev => { const next = new Set(prev); if (next.has(gId)) next.delete(gId); else next.add(gId); return next; });
  },[]);

  const flatTree = useMemo(() => {
    const result: any[] = [];
    const gNames = Object.keys(groups);
    const rootGroups = gNames.filter(g => !groupToGroup[g]);
    
    const addGroup = (groupId: string, depth: number) => {
        const isCollapsed = collapsedGroups.has(groupId);
        const extraTop = 0; 
        result.push({ type: 'group', id: groupId, depth, collapsed: isCollapsed, staticHeight: 32, extraTop });
        
        if (!isCollapsed) {
            const seenGroups = new Set<string>();
            const seenNodes = new Set<string>();
            const directChildGroups = gNames.filter(c => groupToGroup[c] === groupId);
            
            const getChildGroupForNode = (node: string) => {
                for (let c of directChildGroups) {
                    if (groupSets[c].has(node)) return c;
                }
                return null;
            };

            (groups[groupId].nodes || []).forEach((node: string) => {
                const childG = getChildGroupForNode(node);
                if (childG) {
                    if (!seenGroups.has(childG)) {
                        addGroup(childG, depth + 1);
                        seenGroups.add(childG);
                    }
                } else {
                    if (!seenNodes.has(node) && ns[node] !== undefined) {
                        result.push({ type: 'node', id: node, depth: depth + 1, staticHeight: 32 });
                        seenNodes.add(node);
                    }
                }
            });
            
            directChildGroups.forEach(childG => {
                if (!seenGroups.has(childG)) {
                    addGroup(childG, depth + 1);
                }
            });
        }
    };

    rootGroups.forEach(g => addGroup(g, 0));

    Object.keys(ns).forEach(n => {
        let inGroup = false;
        for (let i = 0; i < gNames.length; i++) {
            if (groupSets[gNames[i]].has(n)) {
                inGroup = true;
                break;
            }
        }
        if (!inGroup && ns[n] !== undefined) {
            result.push({ type: 'node', id: n, depth: 0, staticHeight: 32 });
        }
    });

    return result;
  }, [groups, ns, collapsedGroups, groupToGroup, groupSets]);

  const [lastSelectedIdx, setLastSelectedIdx] = useState<number | null>(null);

  const getAllDescendantsHelper = useCallback((groupId: string) => {
    const result = new Set<string>();
    
    if (groupSets[groupId]) {
        groupSets[groupId].forEach(n => result.add(n));
    }
    
    const collectGroups = (gId: string) => {
        Object.keys(groupToGroup).forEach(childG => {
            if (groupToGroup[childG] === gId) {
                result.add(childG);
                collectGroups(childG);
            }
        });
    };
    collectGroups(groupId);
    
    return Array.from(result);
  }, [groupSets, groupToGroup]);

  const getDescendantGroups = useCallback((g: string) => {
    const res: string[] = [];
    const q = [g];
    while (q.length) {
        const cur = q.shift()!;
        Object.keys(groupToGroup).forEach(c => {
            if (groupToGroup[c] === cur) { res.push(c); q.push(c); }
        });
    }
    return res;
  }, [groupToGroup]);

  const handleCreateGroup = useCallback((name: string, ids: string[]) => {
    const color = generateRandomHexColor(0.15);
    setGroups((prev:any) => ({...prev,[name]: {color, nodes:ids}}));
  }, [setGroups]);

  const handleAddNodesToGroup = useCallback((targetGroupName: string) => {
    const nodesToAdd = new Set<string>();
    sel.forEach(id => {
        if (groups[id]) {
            groupSets[id].forEach(n => nodesToAdd.add(n));
        } else if (ns[id]) {
            nodesToAdd.add(id);
        }
    });
    const arrToAdd = Array.from(nodesToAdd);

    setGroups((prev: any) => {
      const updated = { ...prev };
      let curr: string | undefined = targetGroupName;
      while (curr && updated[curr]) {
          updated[curr] = { 
              ...updated[curr], 
              nodes: [...new Set([...updated[curr].nodes, ...arrToAdd])] 
          };
          curr = groupToGroup[curr];
      }
      return updated;
    });
  }, [sel, setGroups, groupToGroup, groups, ns, groupSets]);

  const menuItems = useMemo(() => {
    const selSetFast = new Set(sel);
    return [
      {
        id: 'group', el: 'group',
        children:[
          {
            id: 'name_input',
            el: (
              <input
                autoFocus placeholder="enter the name..."
                style={{ background: 'transparent', color: 'white', padding: '4px 8px', border: '0', outline: 0, width: '100%' }}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter' && e.currentTarget.value) {
                    handleCreateGroup(e.currentTarget.value, sel.filter(s => ns[s]));
                    closeMenu();
                  }
                  if (e.key === 'Escape') closeMenu();
                }}
              />
            )
          }
        ]
      },
      {
        id: 'add_to_group', el: 'add to group',
        children: Object.keys(groups).length === 0
          ?[{ id: 'no_groups', el: <Text fontSize="12px" color="gray.400">No groups available</Text>, disabled: true }]
          : Object.keys(groups).map((gName) => ({
              id: `add_to_${gName}`, el: gName,
              onClick: () => { handleAddNodesToGroup(gName); closeMenu(); }
            }))
      },
      {
        id: 'delete', el: 'delete', danger: true,
        onClick: () => {
          const filtered = Object.keys(ns).filter((k:any) => !selSetFast.has(k)).reduce((obj:any,k) => { obj[k] = ns[k]; return obj; }, {});
          setNs(filtered);
          closeMenu();
        }
      },
      {
        id: 'repeat_selected', el: 'repeat selected',
        onClick: () => {
          const selectedNodes = sel.filter(id => ns[id]);
          if (selectedNodes.length > 0) {
            setFeedSelection(selectedNodes);
            setFeedAutoStart(true);
            setMode('repeat');
          }
          closeMenu();
        }
      },{
        id: 'forget', el: 'forget history', danger: true,
        onClick: () => {
          if (window.confirm('Forget history for selected cards?')) {
            setRepeats((prev: any) => {
              const next = { ...prev };
              sel.forEach((selectedId: string) => {
                if (ns[selectedId]) delete next[selectedId];
              });
              return next;
            });
          }
          closeMenu();
        }
      },
    ]
  },[groups, ns, sel, handleCreateGroup, handleAddNodesToGroup, closeMenu, setNs]);

  const handleTreeContextMenu = useCallback((e: React.MouseEvent, itemId: string, itemType: string) => {
    e.preventDefault();
    e.stopPropagation();
    let newSel = [...sel];
    const selSetFast = new Set(sel);

    if (itemType === 'group') {
      const groupDescendants = getAllDescendantsHelper(itemId);
      const groupAndDescendants = [itemId, ...groupDescendants];
      const isFullySelected = groupAndDescendants.every(id => selSetFast.has(id));
      if (!isFullySelected) {
        newSel = Array.from(new Set([...sel, ...groupAndDescendants]));
        setSel(newSel);
      }
    } else {
      if (!selSetFast.has(itemId)) {
        newSel =[itemId];
        setSel(newSel);
      }
    }
    openMenu(e);
  },[sel, getAllDescendantsHelper, setSel, openMenu]);


  const treeActions = useMemo(() => {
    const selSetFast = new Set(sel);

    return {
      handleRenameGroup,
      handleChangeGroupColor,
      handleUngroup,
      onToggleGroup: toggleGroup,
      onHover: (id: string | null) => flowRef.current?.setHoveredExternally(id),
      onContextMenu: handleTreeContextMenu,
      editingId: editingNodeId,
      hasGroup: (name: string) => !!groups[name],
      dropTarget,
      
      onClick: (e: React.MouseEvent, itemId: string, itemType: string) => {
        e.stopPropagation();
        
        if (editingNodeId && editingNodeId !== itemId) {
           setTimeout(() => setEditingNodeId(null), 150);
        }

        const isShift = e.shiftKey;
        const isCtrl = e.ctrlKey || e.metaKey;
        let newSel = [...sel];
        const index = flatTree.findIndex(i => i.id === itemId);

        if (itemType === 'group') {
          const groupDescendants = getAllDescendantsHelper(itemId);
          const groupAndDescendants = [itemId, ...groupDescendants];
          
          if (isShift && lastSelectedIdx !== null) {
            const start = Math.min(lastSelectedIdx, index);
            const end = Math.max(lastSelectedIdx, index);
            const rangeIds = flatTree.slice(start, end + 1).map(i => i.id);
            if (isCtrl) {
                const toAdd = rangeIds.filter(id => !selSetFast.has(id));
                newSel = [...newSel, ...toAdd];
            }
            else newSel = rangeIds;
          } else if (isCtrl) {
            const allSelected = groupAndDescendants.every(n => selSetFast.has(n));
            const gadSet = new Set(groupAndDescendants);
            if (allSelected) {
                newSel = newSel.filter(id => !gadSet.has(id));
            } else {
                const toAdd = groupAndDescendants.filter(id => !selSetFast.has(id));
                newSel = [...newSel, ...toAdd];
            }
          } else {
            newSel = groupAndDescendants;
          }
          
          setLastSelectedIdx(index);
          if (newSel.length === sel.length && newSel.every(id => selSetFast.has(id))) return;
          setSel(newSel);
          return;
        }

        if (isShift && lastSelectedIdx !== null) {
          const start = Math.min(lastSelectedIdx, index);
          const end = Math.max(lastSelectedIdx, index);
          const rangeIds = flatTree.slice(start, end + 1).map(i => i.id);
          
          if (isCtrl) {
              const toAdd = rangeIds.filter(id => !selSetFast.has(id));
              newSel = [...newSel, ...toAdd];
          }
          else newSel = rangeIds;
        } else if (isCtrl) {
          if (selSetFast.has(itemId)) newSel = newSel.filter(id => id !== itemId);
          else newSel.push(itemId);
          setLastSelectedIdx(index);
        } else {
          newSel = [itemId];
          setLastSelectedIdx(index);
        }
        
        if (newSel.length === sel.length && newSel.every(id => selSetFast.has(id))) return;
        setSel(newSel);
      },

      onDoubleClickNode: (id: string) => {
        setEditingNodeId(id);
      },

      onDragStart: (e: React.DragEvent, dragId: string, type: 'node' | 'group') => {
        const selectedIds = type === 'group' ? Array.from(groupSets[dragId] || []) : (selSetFast.has(dragId) ? sel.filter(s => ns[s] !== undefined) : [dragId]);
        const payload = { id: dragId, type, selectedIds };
        
        dragFallbackRef.current = payload;
        
        e.dataTransfer.setData('application/json', JSON.stringify(payload));
        e.dataTransfer.effectAllowed = 'move';
        
        const dragImage = document.createElement('div');
        dragImage.textContent = type === 'group' ? `📁 ${dragId}` : `🗂 ${dragId}`;
        dragImage.style.cssText = 'position:absolute;top:-9999px;padding:8px 12px;background:rgba(49,130,206,0.9);color:white;border-radius:4px;font-size:12px;';
        document.body.appendChild(dragImage);
        e.dataTransfer.setDragImage(dragImage, 0, 0);
        setTimeout(() => document.body.removeChild(dragImage), 0);
      },

      onDragOverRow: (e: React.DragEvent, id: string, type: 'node'|'group') => { 
          e.preventDefault(); 
          e.stopPropagation(); 
          e.dataTransfer.dropEffect = 'move';
          
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const y = e.clientY - rect.top;
          let pos: 'top'|'bottom'|'inside' = 'inside';

          if (type === 'node') {
              pos = y < rect.height / 2 ? 'top' : 'bottom';
          } else {
              if (y < rect.height * 0.25) pos = 'top';
              else if (y > rect.height * 0.75) pos = 'bottom';
              else pos = 'inside';
          }
          
          setDropTarget(prev => {
              if (prev?.id === id && prev?.pos === pos) return prev;
              return { id, pos };
          });
      },
      
      onDragOverRoot: (e: React.DragEvent) => {
          setDropTarget(null); 
      },

      onDragLeaveRow: (e: React.DragEvent) => {},

      onDrop: (e: React.DragEvent, targetId: string, targetType: 'node'|'group') => {
        e.preventDefault(); 
        e.stopPropagation();
        setDropTarget(null); 

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const y = e.clientY - rect.top;
        let pos: 'top'|'bottom'|'inside' = 'inside';
        
        if (targetType === 'node') {
            pos = y < rect.height / 2 ? 'top' : 'bottom';
        } else {
            if (y < rect.height * 0.25) pos = 'top';
            else if (y > rect.height * 0.75) pos = 'bottom';
            else pos = 'inside';
        }

        try {
          let data;
          try {
              data = JSON.parse(e.dataTransfer.getData('application/json'));
          } catch(err) {}
          if (!data || Object.keys(data).length === 0) data = dragFallbackRef.current;
          if (!data) return;

          const { id: dragId, type: dragType, selectedIds } = data;
          const nodesToMove = selectedIds;
          
          if (dragType === 'group' && targetType === 'group') {
            let curr: string | undefined = targetId;
            while (curr) {
              if (curr === dragId) return; 
              curr = groupToGroup[curr];
            }
          }

          let nsUpdateParams: { target: string, ids: string[], p: 'top'|'bottom' } | null = null;
          
          setGroups((prev: any) => {
            let next = { ...prev };
            
            let groupsToKeepNodes = new Set<string>();
            if (dragType === 'group') {
                groupsToKeepNodes.add(dragId);
                getDescendantGroups(dragId).forEach(c => groupsToKeepNodes.add(c));
            }

            Object.keys(next).forEach(g => {
                if (!groupsToKeepNodes.has(g)) {
                    next[g] = { ...next[g], nodes: next[g].nodes.filter((n: string) => !nodesToMove.includes(n)) };
                }
            });

            let insertTarget: string | null = null;
            if (pos === 'inside' && targetType === 'group') {
                insertTarget = targetId;
            } else {
                insertTarget = targetType === 'group' ? groupToGroup[targetId] : nodeToGroup[targetId];
            }

            if (insertTarget) {
                let curr: string | undefined = insertTarget;
                let first = true;
                while (curr) {
                    if (next[curr]) {
                        const arr = [...next[curr].nodes];
                        if (first) {
                            let targetIdx = -1;
                            if (targetType === 'node') {
                                targetIdx = arr.indexOf(targetId);
                            } else if (targetType === 'group' && pos !== 'inside') {
                                const targetNodes = next[targetId].nodes || [];
                                for (let i = 0; i < arr.length; i++) {
                                    if (targetNodes.includes(arr[i])) { targetIdx = i; break; }
                                }
                            }

                            if (targetIdx !== -1) {
                                arr.splice(pos === 'top' ? targetIdx : targetIdx + 1, 0, ...nodesToMove);
                            } else {
                                arr.push(...nodesToMove);
                            }
                            first = false;
                        } else {
                            nodesToMove.forEach((n: string) => {
                                if (!arr.includes(n)) arr.push(n);
                            });
                        }
                        next[curr] = { ...next[curr], nodes: arr };
                    }
                    curr = groupToGroup[curr];
                }
            } else if (!insertTarget && targetType === 'node') {
                if (dragType === 'node') {
                    nsUpdateParams = { target: targetId, ids: nodesToMove, p: pos };
                }
            }
            return next;
          });

          if (nsUpdateParams) {
              setTimeout(() => {
                 setNs((prevNs: any) => reorderRootKeys(prevNs, nsUpdateParams!.target, nsUpdateParams!.ids, nsUpdateParams!.p));
              }, 0);
          }
        } catch(err) { console.error('Drop error:', err); }
      },

      onDropOnRoot: (e: React.DragEvent) => {
        e.preventDefault();
        setDropTarget(null);
        try {
          let data;
          try { data = JSON.parse(e.dataTransfer.getData('application/json')); } catch(err) {}
          if (!data || Object.keys(data).length === 0) data = dragFallbackRef.current;
          if (!data) return;

          const idsToRemove = data.selectedIds; 
          let groupsToKeepNodes = new Set<string>();
          if (data.type === 'group') {
              groupsToKeepNodes.add(data.id);
              getDescendantGroups(data.id).forEach(c => groupsToKeepNodes.add(c));
          }

          setGroups((prev: any) => {
            const next = { ...prev };
            Object.keys(next).forEach(g => { 
              if (!groupsToKeepNodes.has(g)) {
                  next[g] = { ...next[g], nodes: next[g].nodes.filter((n: string) => !idsToRemove.includes(n)) }; 
              }
            });
            return next;
          });
        } catch(err) {}
      },
    }
  },[sel, flatTree, groups, nodeToGroup, groupToGroup, lastSelectedIdx, handleRenameGroup, handleChangeGroupColor, handleUngroup, toggleGroup, setGroups, handleTreeContextMenu, editingNodeId, ns, getAllDescendantsHelper, getDescendantGroups, dropTarget, groupSets]);

  const handleGlobalKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (editingNodeId) {
          setTimeout(() => setEditingNodeId(null), 150);
      }
    }
    
    const target = e.target as HTMLElement;
    const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
    if (isTyping) return;

    if (e.key==='Delete') {
      const selSetFast = new Set(sel);
      const filtered = Object.keys(ns).filter((k:any) => !selSetFast.has(k)).reduce((obj:any,k) => { obj[k] = ns[k]; return obj; }, {});
      setNs(filtered)
    }

    if ((e.key.toLowerCase() === 'a' || e.key.toLowerCase() === 'b') && sel.length > 0 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const targetId = sel[0];
        const isAbove = e.key.toLowerCase() === 'a';
        const newId = `id_${Date.now()}`;
        const targetType = groups[targetId] ? 'group' : 'node';
        const targetGroup = targetType === 'group' ? targetId : nodeToGroup[targetId];

        const afterAdd = () => {
            setEditingNodeId(newId);
            setSel([newId]);
            // Даем React время отрендерить добавленный элемент, затем скроллим к нему для фокуса
            setTimeout(() => {
                treeRef.current?.scrollToNode(newId);
            }, 50);
        };

        if (targetType === 'group') {
            setGroups((prev: any) => {
                const next = {...prev};
                let curr: string | undefined = targetId;
                let first = true;
                while (curr && next[curr]) {
                    const nodes = [...(next[curr].nodes || [])];
                    if (first) {
                        next[curr] = {...next[curr], nodes: isAbove ? [newId, ...nodes] : [...nodes, newId]};
                        first = false;
                    } else {
                        nodes.push(newId);
                        next[curr] = {...next[curr], nodes};
                    }
                    curr = groupToGroup[curr];
                }
                return next;
            });
            setNs((prev: any) => ({...prev, [newId]: ''}));
            afterAdd();
            return;
        }

        if (targetGroup) {
            setGroups((prev: any) => {
                const next = {...prev};
                let curr: string | undefined = targetGroup;
                let first = true;
                while (curr && next[curr]) {
                    const nodes = [...(next[curr].nodes || [])];
                    if (first) {
                        const idx = nodes.indexOf(targetId);
                        if (idx !== -1) {
                            nodes.splice(isAbove ? idx : idx + 1, 0, newId);
                        } else {
                            nodes.push(newId);
                        }
                        next[curr] = {...next[curr], nodes};
                        first = false;
                    } else {
                        nodes.push(newId);
                        next[curr] = {...next[curr], nodes};
                    }
                    curr = groupToGroup[curr];
                }
                return next;
            });
            setNs((prev: any) => ({...prev, [newId]: ''}));
            afterAdd();
        } else {
            setNs((prev: any) => {
                const next: any = {};
                let added = false;
                for (const key of Object.keys(prev)) {
                    if (key === targetId && isAbove) { next[newId] = ''; added = true; }
                    next[key] = prev[key];
                    if (key === targetId && !isAbove) { next[newId] = ''; added = true; }
                }
                if (!added) next[newId] = '';
                return next;
            });
            afterAdd();
        }
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
      e.preventDefault();
      if (e.shiftKey) {
        const selectedSet = new Set(sel);
        let groupToUngroup: string | null = null;
        for (const gName of Object.keys(groups)) {
          const allDescendants = getAllDescendantsHelper(gName);
          if (allDescendants.length > 0 && allDescendants.every(id => selectedSet.has(id))) {
            groupToUngroup = gName; break;
          }
        }
        
        if (groupToUngroup) {
          setGroups((prev: any) => {
            const next = { ...prev };
            const parentGroup = groupToGroup[groupToUngroup!];
            const descendants = next[groupToUngroup!]?.nodes ||[];
            
            if (parentGroup && next[parentGroup]) {
              next[parentGroup] = { ...next[parentGroup], nodes:[...new Set([...next[parentGroup].nodes, ...descendants])] };
            }
            delete next[groupToUngroup!];
            return next;
          });
        }
      } else {
        if (sel.length > 0 && flowRef.current) flowRef.current.triggerShortcutMenu();
      }
    }
  },[sel, groups, nodeToGroup, groupToGroup, setGroups, setNs, getAllDescendantsHelper]);

  const Editor = (
  <Tabs.Root
    css={graphCSS}
    defaultValue="tr"
    variant="plain"
    className={'graphTabs'}
    onKeyDown={handleGlobalKeyDown}
    tabIndex={0}
    style={{outline:'none'}}
    >
    {mode==='eg'&&(
      <HStack className='GraphmodeSides' ref={graphSidesRef} h={'100%'} gap={0}>
        <Box w={`${sidebarWidth}px`} minW={`${sidebarWidth}px`} h="100%" display="flex" flexDirection="column">
          <VirtualTreeView 
            ref={treeRef}
            flatTree={flatTree} 
            sel={sel} 
            ns={ns} 
            groups={groups} 
            actions={treeActions} 
            hoveredNodeId={hoveredNodeId}
          />
        </Box>

        <Box 
          w="4px" 
          h="100%" 
          cursor="col-resize" 
          bg="color-mix(in srgb, #666 30%, transparent)" 
          _hover={{ bg: 'color-mix(in srgb, #fff 50%, transparent)' }} 
          transition="background 0.2s"
          onMouseDown={(e) => {
            e.preventDefault();
            isDraggingSidebar.current = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
          }}
          zIndex={10}
        />
        
        <Box flex={1} h="100%" minW={0} position="relative" display="flex">
          <Flow 
            ref={flowRef} 
            sel={sel} 
            onContextMenu={openMenu} 
            onDoubleClickNode={(nodeId: string) => treeRef.current?.scrollToNode(nodeId)}
            onCanvasHover={setHoveredNodeId}
          />
        </Box>
      </HStack>
    )}

    {mode==='tr'&&(
      <VStack className='TextmodeStack'>
        <Box className='textmodeToolsPanel'>
          <Button className='thinButton' variant="subtle" onClick={handleTopSort}><BsDiagram2Fill style={{height:'13px',width:'13px',marginRight: '5px'}}/>top sort</Button>
        </Box>
        {orderedIds.map((curId:any)=>{
          return <Card
            key={curId}
            id={curId}
            content={ns[curId]}
            options={{
              stats: false,
              twoSides: true,
              onMove: (dir: number) => handleMoveCard(curId, dir as -1|1),
              onCardsCreated: (newIds: string[]) => {
                setOrderedIds(prev => {
                  const uniqueNew = newIds.filter(id => !prev.includes(id));
                  return[...prev, ...uniqueNew];
                });
              }
            }}
            /> })}
      </VStack>
    )}

    {mode==='repeat'&&( <Feed initialSelection={feedSelection} autoStart={feedAutoStart} /> )}
    
    <Box position="absolute" zIndex={9999}>
      <ContextMenu {...menuProps} items={menuItems} />
    </Box>
  </Tabs.Root>)

  useImperativeHandle(ref,()=>({
    select: (ids:any)=>{ setSel(ids); },
    selected:()=>{ return sel; },
    unselectGroupStack:()=>{} 
  }))

  return <div css={graphCSS}>{Editor}</div>
});