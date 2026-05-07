// ДОБАВЛЕНО/ИЗМЕНЕНО
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
import { LuChevronDown, LuChevronRight } from "react-icons/lu";

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
  // margin: 0px 10px 20px 10px;
  margin: 0;
  // border-radius: 10px;

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

.GraphmodeSides {
  width: 100%;
  height: 100%;
  flex:1;
  min-height:0;
  align-items:stretch;
  gap: 0;
}

.GraphmodeStack {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height:0;
  position: relative;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  min-width: 50%;
  max-width: 50%;

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

.tree-row-hovered {
  background-color: rgba(200, 200, 200, 0.15) !important;
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
  let a = rgb[4] !== undefined ? parseFloat(rgb[4]) : 1;
  a = Math.max(0, Math.min(1, a)); 
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

const setTreeHoveredNodeDOM = (nodeId: string | null) => {
  document.querySelectorAll('.tree-row-hovered').forEach(el => el.classList.remove('tree-row-hovered'));
  if (nodeId) {
    document.querySelector(`[data-tree-id="${nodeId}"]`)?.classList.add('tree-row-hovered');
  }
};

const getAllGroupDescendantsHelper = (groupId: string, groups: any, nodeToGroup: any, groupToGroup: any): string[] => {
  const result: string[] =[];
  const collect = (gId: string) => {
    const gData = groups[gId];
    if (!gData) return;
    (gData.nodes ||[]).forEach((n: string) => {
      if (nodeToGroup[n] === gId) result.push(n);
    });
    Object.keys(groups).forEach(childG => {
      if (groupToGroup[childG] === gId) collect(childG);
    });
  };
  collect(groupId);
  return result;
};


// ===== ИСПРАВЛЕННЫЙ FLOW =====
const Flow = React.forwardRef(({ onNodeHover, onContextMenu, onDoubleClickNode  }: any,ref:any)=>{
  const gCtx = useGraphCtx() as any;
  const { ns, setNs, gRef, groups, setGroups } = gCtx;
  const[reactflowNs, reactflowEs] = useMemo(
    () => calcG(ns, groups, {x:1, y:1}), [ns, groups]
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
  const lastCameraUpdate = useRef(0);
  const CAMERA_UPDATE_THROTTLE = 50;

  useEffect(() => { onDoubleClickNodeRef.current = onDoubleClickNode; }, [onDoubleClickNode]);

  useEffect(() => {
    const {groupToGroup}=calculateHierarchy(groups);
    const desc: Record<string, string[]> = {};
    Object.keys(groups).forEach(gName => {
        let res: string[] =[];
        const queue =[gName];
        while(queue.length > 0) {
            const cur = queue.shift()!;
            if (groups[cur] && groups[cur].nodes) res.push(...groups[cur].nodes);
            const cg = Object.keys(groups).filter(g => groupToGroup[g] === cur);
            queue.push(...cg);
        }
        desc[gName] = res;
    });
    groupDescendantsRef.current = desc;
    sortedGroupsRef.current = Object.keys(groups).sort((a,b) => {
        let depthA = 0; let currA = a; while(groupToGroup[currA]) { depthA++; currA = groupToGroup[currA]; }
        let depthB = 0; let currB = b; while(groupToGroup[currB]) { depthB++; currB = groupToGroup[currB]; }
        return depthA - depthB;
    });
  },[groups]);

  useEffect(()=>{tempNodeRef.current = tempNode;},[tempNode]);

  useEffect(() => {
    if (!containerRef.current) return;
    const renderer = new Sigma(graphRef.current, containerRef.current, {
      renderLabels: false,
      defaultEdgeColor: "rgba(255, 255, 255, 0.05)",
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

    const handleCustomHover = (e: MouseEvent) => {
      if (!containerRef.current || !sigmaRef.current || !overlayCanvasRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const scale = 1 / sigmaRef.current.getCamera().ratio;
      let foundNode: string | null = null;
      graphRef.current.forEachNode((node, data) => {
        if (data.isGroup) return;
        const nodeAttrs = graphRef.current.getNodeAttributes(node);
        if (!nodeAttrs) return;
        const vp = sigmaRef.current!.graphToViewport({ x: nodeAttrs.x, y: nodeAttrs.y });
        const nodeX = vp.x;
        const nodeY = vp.y;
        const nodeW = 160 * scale;
        const nodeH = 36 * scale;
        if (
          mouseX >= nodeX - nodeW/2 &&
          mouseX <= nodeX + nodeW/2 &&
          mouseY >= nodeY - nodeH/2 &&
          mouseY <= nodeY + nodeH/2
        ) {
          foundNode = node;
        }
      });
      if (foundNode !== lastHoveredNode) {
        lastHoveredNode = foundNode;
        hoveredNode.current = foundNode;
        sigmaRef.current?.refresh();
        setTreeHoveredNodeDOM(foundNode); 
      }
    };
    const handleMouseLeave = () => {
      if (lastHoveredNode !== null) {
        lastHoveredNode = null;
        hoveredNode.current = null;
        sigmaRef.current?.refresh();
        setTreeHoveredNodeDOM(null);
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
        const gData = groups[gName] || { color: '#555555' };
        const descendants = groupDescendantsRef.current[gName] ||[];
        const nodesInGraph = descendants.filter(n => graphRef.current.hasNode(n) && !graphRef.current.getNodeAttributes(n).isGroup);
        if (nodesInGraph.length === 0) return;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodesInGraph.forEach(n => {
          const node = graphRef.current.getNodeAttributes(n);
          if (!node) return;
          const vp = renderer.graphToViewport({ x: node.x, y: node.y });
          const nodeW = (160 * scale) / 2;
          const nodeH = (36 * scale) / 2;
          minX = Math.min(minX, vp.x - nodeW);
          minY = Math.min(minY, vp.y - nodeH);
          maxX = Math.max(maxX, vp.x + nodeW);
          maxY = Math.max(maxY, vp.y + nodeH);
        });
        let depth = 0;
        const { groupToGroup } = calculateHierarchy(groups);
        let curr = gName;
        while(groupToGroup[curr]) { depth++; curr = groupToGroup[curr]; }
        const pad = Math.max(15, (40 - depth * 5)) * scale;
        minX -= pad; 
        minY -= (pad + 15 * scale); 
        maxX += pad; 
        maxY += pad;
        const hexColor = gData.color.startsWith('#') ? gData.color : rgba2hex(gData.color) || '#555';
        underCtx.fillStyle = hexColor + "26"; 
        drawRoundRect(underCtx, minX, minY, maxX - minX, maxY - minY, 8 * scale);
        underCtx.fill();

        underCtx.save();
        underCtx.fillStyle = "#ffffff";
        underCtx.font = `700 ${12 * scale}px 'Merriweather', 'Roboto', sans-serif`;
        underCtx.textAlign = "left";
        underCtx.textBaseline = "top";
        underCtx.fillText(gName, minX + 8 * scale, minY + 8 * scale);
        underCtx.restore();
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
        const w = 160 * scale; 
        const h = 36 * scale;
        
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
        if (scale > 0.3) {
          overCtx.fillStyle = data.status?.isLocked ? "rgba(255,255,255,0.2)" : "#ffffff";
          overCtx.font = `${11 * scale}px sans-serif`;
          overCtx.textAlign = "center";
          overCtx.textBaseline = "middle";
          let text = data.label || "";
          if (text.length > 20) text = text.substring(0, 18) + "...";
          overCtx.fillText(text, x, y);
        }
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
      if(sigmaRef.current){
        console.log(sigmaRef.current.getCamera());
      }
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
                    const nodeW = 160 * scale;
                    const nodeH = 36 * scale;
                    
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
  },[gRef, setNs, groups, onContextMenu]);

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
            graph.updateNode(n.id, attrs => ({ ...attrs, x: n.position.x, y: n.position.y }));
            existingNodes.delete(n.id);
         } else {
            graph.addNode(n.id, { x: n.position.x, y: n.position.y, isGroup: true, color: "rgba(0,0,0,0)", size: 0 });
         }
         return;
      }

      let label = n.id;
      let status = { isLocked: false, isNew: true, isDue: false, isLearned: false, level: 0 };
      if (ns[n.id]) {
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
             label: label,
             status: status
         }));
         existingNodes.delete(n.id);
      } else {
         graph.addNode(n.id, {
             x: n.position.x,
             y: n.position.y,
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

    existingNodes.forEach(n => graph.dropNode(n));
    existingEdges.forEach(e => graph.dropEdge(e));

    if (sigmaRef.current) sigmaRef.current.refresh();
  },[reactflowNs, reactflowEs, ns]);

  useEffect(() => {
     if (isFirstLoad.current && reactflowNs.length > 0 && sigmaRef.current) {
        setTimeout(() => {
           if (sigmaRef.current) {
               (sigmaRef.current as any).camera.animatedReset({ duration: 400 });
               isFirstLoad.current = false;
           }
        }, 50);
     }
  }, [reactflowNs]);

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
  },[nodeToZoomId]); // убрали reactflowNs, чтобы не вызывать повторно при перестроении


  useImperativeHandle(ref,()=>({
    setSelectionExternally: (ids: string[]) => {
      curSelected.current = new Set(ids);
      if (sigmaRef.current) sigmaRef.current.refresh();
    },
    setHoveredExternally: (id: string | null) => {
      hoveredNode.current = id;
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


const treeRowAreEqual = (prev:any,next:any) => {
  return prev.item === next.item &&
         prev.index === next.index &&
         prev.isSelected === next.isSelected &&
         prev.isGroupFullySelected === next.isGroupFullySelected &&
         prev.ns[prev.item.id] === next.ns[next.item.id] &&
         (prev.item.type === 'node' || prev.groups[prev.item.id] === next.groups[next.item.id]);
};

const VirtualTreeRow = memo(({ 
  item, style, isSelected, isGroupFullySelected, 
  actions, ns, groups,
}: any) => {
  const isGroup = item.type === 'group';
  const gData = isGroup ? groups[item.id] : null;

  const hexColor = isGroup ? (gData?.color?.startsWith('#') ? gData.color : rgba2hex(gData.color || '#555')) : null;
  const[localColor, setLocalColor] = useState(hexColor || '#555');
  const[isEditing, setIsEditing] = useState(false);
  const[editName, setEditName] = useState(item.id);

  useEffect(() => {
    if (isGroup && localColor !== hexColor) {
      const handler = setTimeout(() => { actions.handleChangeGroupColor(item.id, localColor); }, 200);
      return () => clearTimeout(handler);
    }
  },[localColor, hexColor, item.id, isGroup, actions]);

  const onRenameSubmit = () => {
    setIsEditing(false);
    if (!editName || editName === item.id || groups[editName]) { setEditName(item.id); return; }
    actions.handleRenameGroup(item.id, editName);
  };

  const isSel = isGroup ? isGroupFullySelected : isSelected;

  return (
    <Box 
      style={style}
      className={`tree-row ${isSel ? 'selected' : ''}`}
      data-tree-id={item.id}
      draggable
      onDragStart={(e) => actions.onDragStart(e, item.id, item.type)}
      onDrop={(e) => actions.onDrop(e, item.id, item.type)}
      onClick={(e) => actions.onClick(e, item.id, item.type)}
      onContextMenu={(e) => actions.onContextMenu(e, item.id, item.type)} 
      onMouseEnter={() => !isGroup && actions.onHover(item.id)}
      onMouseLeave={() => !isGroup && actions.onHover(null)}
      _hover={{ bg: isSel ? undefined : 'whiteAlpha.200' }}
      display="flex" alignItems="center" px={2} cursor={isGroup ? "default" : "pointer"}
      onDoubleClick={(e) => {
        // console.log('?')
        if (!isGroup && actions.onDoubleClickNode) {
          actions.onDoubleClickNode(item.id);
        }
      }}
      bg={
        isSel 
          ? 'rgba(49, 130, 206, 0.4)' 
          : 'transparent'
      }
    >
      <Box display="flex" h="100%" alignItems="center" position="relative">
        {Array.from({ length: item.depth }).map((_, i) => (
          <Box key={i} w="15px" h="100%" borderRight="1px solid rgba(255,255,255,0.05)" mr="4px" />
        ))}
      </Box>
      <Box w={item.depth === 0 ? "5px" : "2px"} flexShrink={0} />

      {isGroup ? (
        <Box fontSize="11px" fontWeight="bold" w="100%" display="flex" flexDirection="row" alignItems="center" gap={2}
          onDragStart={(e) => actions.onDragStart(e, item.id, item.type)}
          draggable={true}
        >
          <IconButton variant={'plain'} h={'20px'} w={'20px'} minW={'20px'} p={0} onClick={(e) => { e.stopPropagation(); actions.onToggleGroup(item.id); }}>
            {item.collapsed ? <LuChevronRight className={'smIcon'} /> : <LuChevronDown className={'smIcon'} />}
          </IconButton>
          
          {isEditing ? (
            <input autoFocus value={editName} onChange={e => setEditName(e.target.value)}
              onBlur={onRenameSubmit} onClick={e => e.stopPropagation()}
              onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') onRenameSubmit(); if (e.key === 'Escape') { setIsEditing(false); setEditName(item.id); } }}
              style={{ flex: 1, background: 'rgba(0,0,0,0.3)', color: 'white', outline: 'none', border: '1px solid gray', borderRadius: '3px', padding: '0 4px' }}
            />
          ) : (
            // <Box flex={1} onDoubleClick={() => setIsEditing(true)}>{item.id}</Box>
            <Box flex={1} onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}>{item.id}</Box>
          )}
          <Box 
            as="input" 
            // @ts-ignore
            type="color" 
            value={hexColor?.slice(0, 7) || '#555555'} 
            onChange={(e:any)=>{ e.stopPropagation(); setLocalColor(e.target.value); }} 
            onClick={(e:any)=>{ e.stopPropagation() }} 
            style={{ width: '14px', height: '14px', padding: 0, border: 'none', background: 'none', cursor: 'pointer', borderRadius: '50%' }} 
          />
        </Box>
      ) : (
        <Box h="28px" w="100%" overflow="hidden" pointerEvents="none" display="flex" alignItems="center">
           <Card id={item.id} content={ns[item.id]} options={{stats:false,twoSides:false,padding:'0px', fontSize:11}} />
        </Box>
      )}
    </Box>
  );
}, treeRowAreEqual);


// ===== ИСПРАВЛЕННЫЙ VirtualTreeView =====
const VirtualTreeView = memo(React.forwardRef(({ flatTree, sel, fullySelectedGroups, ns, groups, actions }: any, ref: any) => {
  const ITEM_HEIGHT = 32;
  const[scrollTop, setScrollTop] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(600);
  
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeout = useRef<any>(null);

  const totalHeight = useMemo(() => {
    return flatTree.length * ITEM_HEIGHT;
  }, [flatTree.length]);

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
    actions.onDragOver(e);
  };

  const selSet = useMemo(() => new Set(sel), [sel]);
  const UPWARD_BUFFER = 5;
  const DOWNWARD_BUFFER = 15;

  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - UPWARD_BUFFER);
  const endIndex = Math.min(
    flatTree.length - 1,
    Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + DOWNWARD_BUFFER
  );

  useImperativeHandle(ref, () => ({
    scrollToNode: (id: string) => {
      setTimeout(() => {
        const index = flatTree.findIndex((i: any) => i.id === id);
        if (index !== -1 && scrollContainerRef.current) {
          const top = Math.max(0, index * ITEM_HEIGHT - containerHeight / 2 + ITEM_HEIGHT / 2);
          try {
            scrollContainerRef.current.scrollTo({ top, behavior: 'instant' });
          } catch(e) {
            scrollContainerRef.current.scrollTop = top; // Fallback 
          }
        }
      }, 50); 
    }
  }));

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
         {flatTree.map((item: any, index: number) => {
           const isVisible = index >= startIndex && index <= endIndex;
           if (!isVisible) {
             return <Box key={item.id} style={{ position: 'absolute', top: index * ITEM_HEIGHT, height: ITEM_HEIGHT, width: '100%' }} />;
           }

           return (
             <VirtualTreeRow 
               key={item.id} 
               item={item} 
               index={index}
               style={{ 
                 position: 'absolute', 
                 top: index * ITEM_HEIGHT, 
                 height: ITEM_HEIGHT, 
                 width: '100%' 
               }}
               isSelected={selSet.has(item.id)}
               isGroupFullySelected={item.type === 'group' ? fullySelectedGroups.has(item.id) : false}
               actions={actions}
               ns={ns}
               groups={groups}
             />
           );
         })}
       </div>
    </div>
  );
}), (prev, next) => {
  return prev.flatTree === next.flatTree &&
         prev.sel === next.sel &&
         prev.fullySelectedGroups === next.fullySelectedGroups &&
         prev.ns === next.ns &&
         prev.groups === next.groups;
});


// ===== ИСПРАВЛЕННЫЙ GRAPH =====
export const Graph=forwardRef(({headerRef}:any,ref:any)=>{
  const{ns,setNs,id,name,groups,setGroups,repeats,setRepeats}=useGraphCtx()as any;
  const[sel,setSel]=useState<string[]>([]);
  const[mode,setMode]=useState('eg') as any;
  const[curName,setCurName]=useState({'0':name}) as any;
  
  const flowRef=useRef(null) as any;
  const treeRef=useRef<any>(null); 
  
  const latestNs = useRef(ns);
  const latestGroups = useRef(groups);
  const latestName = useRef(curName);

  const [feedSelection, setFeedSelection] = useState<string[] | null>(null);
  const [feedAutoStart, setFeedAutoStart] = useState(false);
  
  const { open: openMenu, close: closeMenu, props: menuProps } = useContextMenu();

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

  // Сбрасываем фильтры, когда уходим с экрана repeat
  useEffect(() => {
    if (mode !== 'repeat') {
      setFeedAutoStart(false);
      setFeedSelection(null);
    }
  },[mode]);

  useEffect(() => { latestNs.current = ns; },[ns]);
  useEffect(() => { latestGroups.current = groups; }, [groups]);
  useEffect(() => { latestName.current = curName; },[curName]);

  useEffect(() => {
    if (flowRef.current && flowRef.current.setSelectionExternally) { 
      flowRef.current.setSelectionExternally(sel); 
    } 
  }, [sel]);

  const { nodeToGroup, groupToGroup } = useMemo(() => 
    calculateHierarchy(groups), 
    [groups]
  );
  
  const[orderedIds, setOrderedIds] = useState<string[]>(Object.keys(ns).filter(k => sel.includes(k)));
  useEffect(() => { setOrderedIds(prev => { const newIds = sel.filter((id: string) => !prev.includes(id)); return[...prev.filter((id: string) => sel.includes(id)), ...newIds]; }); },[sel]);

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
      <Tabs.Root className='headerTabs' value={mode} onValueChange={(e)=>setMode(e.value)} variant="plain">
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
    const result: any[] =[];
    const addNode = (nodeId: string, depth: number) => { if (ns[nodeId]) result.push({ type: 'node', id: nodeId, depth }); };
    
    const addGroup = (groupId: string, depth: number) => {
      const isCollapsed = collapsedGroups.has(groupId);
      result.push({ type: 'group', id: groupId, depth, collapsed: isCollapsed });
      
      if (!isCollapsed) {
        const childGroups = Object.keys(groups).filter(g => groupToGroup[g] === groupId);
        childGroups.forEach(cg => addGroup(cg, depth + 1));
        
        const childNodes = (groups[groupId].nodes ||[]).filter((n: string) => nodeToGroup[n] === groupId);
        childNodes.forEach((cn:any)=>addNode(cn,depth+1));
      }
    };

    const rootGroups = Object.keys(groups).filter(g => !groupToGroup[g]);
    rootGroups.forEach(g => addGroup(g, 0));

    const rootNodes = Object.keys(ns).filter(n => !nodeToGroup[n]);
    rootNodes.forEach(n => addNode(n, 0));

    return result;
  },[
    groups, 
    ns, 
    collapsedGroups, 
    groupToGroup, 
    nodeToGroup
  ]);


  const [lastSelectedIdx, setLastSelectedIdx] = useState<number | null>(null);

  const fullySelectedGroups = useMemo(() => {
    const selSet = new Set(sel);
    const result = new Set<string>();
    Object.keys(groups).forEach(gId => {
      const descendants = getAllGroupDescendantsHelper(gId, groups, nodeToGroup, groupToGroup);
      if (descendants.length > 0 && descendants.every(id => selSet.has(id))) {
        result.add(gId);
      }
    });
    return result;
  },[sel, groups, nodeToGroup, groupToGroup]);

  const handleCreateGroup = useCallback((name: string, ids: string[]) => {
    const color = generateRandomHexColor(0.15);
    setGroups((prev:any) => ({...prev,[name]: {color, nodes:ids}}));
  }, [setGroups]);

  const handleAddNodesToGroup = useCallback((targetGroupName: string) => {
    setGroups((prev: any) => {
      const updated = { ...prev };
      Object.keys(updated).forEach(g => { updated[g] = { ...updated[g], nodes: updated[g].nodes.filter((n:any)=>!sel.includes(n)) }; });
      updated[targetGroupName] = { ...updated[targetGroupName], nodes:[...new Set([...updated[targetGroupName].nodes, ...sel])] };
      return updated;
    });
  }, [sel, setGroups]);

  const menuItems = useMemo(() =>[
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
                  handleCreateGroup(e.currentTarget.value, sel);
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
        const filtered = Object.keys(ns).filter((k:any) => !(sel.includes(k))).reduce((obj:any,k) => { obj[k] = ns[k]; return obj; }, {});
        setNs(filtered);
        closeMenu();
      }
    },
    {
      id: 'repeat_selected', el: 'repeat selected',
      onClick: () => {
        if (sel.length > 0) {
          setFeedSelection(sel);
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
              delete next[selectedId];
            });
            return next;
          });
        }
        closeMenu();
      }
    },
  ],[groups, ns, sel, handleCreateGroup, handleAddNodesToGroup, closeMenu, setNs]);

  const handleTreeContextMenu = useCallback((e: React.MouseEvent, itemId: string, itemType: string) => {
    e.preventDefault();
    e.stopPropagation();
    let newSel = [...sel];

    if (itemType === 'group') {
      const groupNodes = getAllGroupDescendantsHelper(itemId, groups, nodeToGroup, groupToGroup);
      const isFullySelected = groupNodes.length > 0 && groupNodes.every(id => newSel.includes(id));
      if (!isFullySelected) {
        newSel = groupNodes;
        setSel(newSel);
      }
    } else {
      if (!newSel.includes(itemId)) {
        newSel =[itemId];
        setSel(newSel);
      }
    }
    openMenu(e);
  },[sel, groups, nodeToGroup, groupToGroup, setSel, openMenu]);


  const treeActions = useMemo(() => ({
    handleRenameGroup,
    handleChangeGroupColor,
    handleUngroup,
    onToggleGroup: toggleGroup,
    onHover: (id: string | null) => flowRef.current?.setHoveredExternally(id),
    onContextMenu: handleTreeContextMenu,
    
    onClick: (e: React.MouseEvent, itemId: string, itemType: string) => {
      e.stopPropagation();
      let newSel = [...sel];
      const index = flatTree.findIndex(i => i.id === itemId);

      if (itemType === 'group') {
        const groupNodes = getAllGroupDescendantsHelper(itemId, groups, nodeToGroup, groupToGroup);
        if (e.ctrlKey || e.metaKey) {
          const allSelected = groupNodes.every(n => newSel.includes(n));
          if (allSelected) newSel = newSel.filter(id => !groupNodes.includes(id));
          else newSel =[...new Set([...newSel, ...groupNodes])];
        } else if (e.shiftKey && lastSelectedIdx !== null) {
          const start = Math.min(lastSelectedIdx, index);
          const end = Math.max(lastSelectedIdx, index);
          const rangeItems = flatTree.slice(start, end + 1);
          const rangeNodeIds = rangeItems.filter(i => i.type === 'node').map(i => i.id);
          newSel = [...new Set([...rangeNodeIds, ...groupNodes])];
        } else {
          newSel = groupNodes;
        }
        setLastSelectedIdx(index);
        setSel(newSel);
        return;
      }

      if (e.shiftKey && lastSelectedIdx !== null) {
        const start = Math.min(lastSelectedIdx, index);
        const end = Math.max(lastSelectedIdx, index);
        const rangeIds = flatTree.slice(start, end + 1).filter(i => i.type === 'node').map(i => i.id);
        
        if (e.ctrlKey || e.metaKey) newSel =[...new Set([...newSel, ...rangeIds])];
        else newSel = rangeIds;
      } else if (e.ctrlKey || e.metaKey) {
        if (newSel.includes(itemId)) newSel = newSel.filter(id => id !== itemId);
        else newSel.push(itemId);
        setLastSelectedIdx(index);
      } else {
        newSel = [itemId];
        setLastSelectedIdx(index);
      }
      setSel(newSel);
    },

    onDragStart: (e: React.DragEvent, dragId: string, type: 'node' | 'group') => {
      const selectedIds = type === 'group' ? [dragId] : (sel.includes(dragId) ? sel :[dragId]);
      const payload = { id: dragId, type, selectedIds };
      e.dataTransfer.setData('application/json', JSON.stringify(payload));
      e.dataTransfer.effectAllowed = 'move';
      
      const dragImage = document.createElement('div');
      dragImage.textContent = type === 'group' ? `📁 ${dragId}` : `🗂 ${dragId}`;
      dragImage.style.cssText = 'position:absolute;top:-9999px;padding:8px 12px;background:rgba(49,130,206,0.9);color:white;border-radius:4px;font-size:12px;';
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, 0, 0);
      setTimeout(() => document.body.removeChild(dragImage), 0);
    },

    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; },

    onDrop: (e: React.DragEvent, targetId: string, targetType: 'node'|'group') => {
      e.preventDefault(); 
      e.stopPropagation();
      try {
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        const { id: dragId, type: dragType, selectedIds } = data;
        
        if (dragType === 'group' && targetType === 'group') {
          let curr: string | undefined = targetId;
          while (curr) {
            if (curr === dragId) return; 
            curr = groupToGroup[curr];
          }
        }
        
        setGroups((prev: any) => {
          const next = { ...prev };
          Object.keys(next).forEach(g => { 
            next[g] = { ...next[g], nodes: next[g].nodes.filter((n: string) => !selectedIds.includes(n)) }; 
          });
          if (targetType === 'group') {
            next[targetId] = { ...next[targetId], nodes:[...new Set([...(next[targetId]?.nodes ||[]), ...selectedIds])] };
          } else if (targetType === 'node') {
            const targetGroup = nodeToGroup[targetId];
            if (targetGroup && next[targetGroup]) {
              next[targetGroup] = { ...next[targetGroup], nodes:[...new Set([...next[targetGroup].nodes, ...selectedIds])] };
            }
          }
          return next;
        });
      } catch(err) { console.error('Drop error:', err); }
    },

    onDropOnRoot: (e: React.DragEvent) => {
      e.preventDefault();
      try {
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        const idsToRemove = data.selectedIds; 
        setGroups((prev: any) => {
          const next = { ...prev };
          Object.keys(next).forEach(g => { 
            next[g] = { ...next[g], nodes: next[g].nodes.filter((n: string) => !idsToRemove.includes(n)) }; 
          });
          return next;
        });
      } catch(err) {}
    },

    onDoubleClickNode: (id: string) => {
      flowRef.current?.zoomToNode(id);
    },
  }),[sel, flatTree, groups, nodeToGroup, groupToGroup, lastSelectedIdx, handleRenameGroup, handleChangeGroupColor, handleUngroup, toggleGroup, setGroups, handleTreeContextMenu]);


  const handleGlobalKeyDown = useCallback((e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const isTyping =['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
    if (isTyping) return;

    if (e.key==='Delete') {
      const filtered = Object.keys(ns).filter((k:any) => !(sel.includes(k))).reduce((obj:any,k) => { obj[k] = ns[k]; return obj; }, {});
      setNs(filtered)
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
      e.preventDefault();
      if (e.shiftKey) {
        const selectedSet = new Set(sel);
        let groupToUngroup: string | null = null;
        for (const gName of Object.keys(groups)) {
          const allDescendants = getAllGroupDescendantsHelper(gName, groups, nodeToGroup, groupToGroup);
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
  },[sel, groups, nodeToGroup, groupToGroup, setGroups, setNs]);

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
      <HStack className='GraphmodeSides'>
        <VirtualTreeView 
          ref={treeRef}
          flatTree={flatTree} 
          sel={sel} 
          fullySelectedGroups={fullySelectedGroups} 
          ns={ns} 
          groups={groups} 
          actions={treeActions} 
        />
        <Separator orientation={'vertical'} w={'1px'} h={'100%'}/>
        <Flow 
          ref={flowRef} 
          onContextMenu={openMenu} 
          onDoubleClickNode={(nodeId: string) => treeRef.current?.scrollToNode(nodeId)}
        />
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

    {/* Убрали пустой <Feed/>, оставив только один: */}
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