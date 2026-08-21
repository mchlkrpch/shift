/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  memo
} from 'react';
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
} from "@chakra-ui/react";
import { Clip } from '../clip';
import {
  calcG, 
  SIDE_SPLIT_SYM,
  topSort,
} from "../card/utility";
import { GraphCtx, useGraphCtx } from "../../App";
import '@xyflow/react/dist/style.css';
import { FaShare } from "react-icons/fa";
import { createPortal } from 'react-dom';
import { FaParagraph } from 'react-icons/fa6';
import { LuChevronDown, LuChevronRight, LuPilcrow } from 'react-icons/lu';
import { BsDiagram2Fill } from "react-icons/bs";
import { RiSaveFill, RiRepeat2Line } from "react-icons/ri";

import Sigma from "sigma";
import Graphology from "graphology";
import { ID } from "appwrite";
import { APPWRITE_CONFIG, gReq, spaced_account } from "../../appwrite/service";
import { Feed, getCardState, ChatNN } from "./feed"; 
import { Card } from "../card/card";
import { ContextMenu, useContextMenu } from "./contextMenu";
import { Colored, drawRoundRect, generateRandomHexColor, normalizeColorToHex, rgba2hex } from "./utility";

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
  gap: 6px;
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

.hover-row {
}

.group-row {
}

.root {
  height: 42px !important;
}
`;

interface CardCtxI{
  path: any[],setPath:(p:any[])=>any[],
  c:string,setC:(t:string)=>void,
};

export const CardCtx = createContext<CardCtxI|null>(null);
export const useCardCtx=()=>{
  const ctx = useContext(CardCtx);
  if (!ctx) {
    throw new Error('use graph context');
  }
  return ctx;
}

export declare type shCardProps = {
  id: string,
  content: string,
  options: any,
  focus?: boolean,
}

// ============================================================================
// GRAPH AND TREE VIEWS
// ============================================================================

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

export interface GraphRendererProps {
  reactflowNs: any[];
  reactflowEs: any[];
  ns: any;
  groups: any;
  repeats?: any;
  selectedIds?: Set<string>;
  selectionBoxRef?: React.MutableRefObject<{x: number, y: number, w: number, h: number} | null>;
  externalHoveredNodeId?: string | null;
  onNodeClick?: (e: any, nodeId: string) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
  onNodeRightClick?: (e: any, nodeId: string) => void;
  onStageClick?: (e: any) => void;
  onStageRightClick?: (e: any) => void;
  onHover?: (nodeId: string | null, groupId: string | null) => void;
  onCameraUpdated?: (cam: { x: number, y: number, ratio: number }) => void;
}

export const GraphRenderer = memo(forwardRef(({
  reactflowNs,
  reactflowEs,
  ns,
  groups,
  repeats = {},
  selectedIds = new Set(),
  selectionBoxRef,
  externalHoveredNodeId = null,
  onNodeClick,
  onNodeDoubleClick,
  onNodeRightClick,
  onStageClick,
  onStageRightClick,
  onHover,
  onCameraUpdated
}: GraphRendererProps, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const underlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const graphRef = useRef(new Graphology());

  const hoveredNode = useRef<string | null>(null);
  const hoveredGroup = useRef<string | null>(null);
  const sortedGroupsRef = useRef<string[]>([]);

  const latestProps = useRef({ groups, ns, repeats, selectedIds, selectionBoxRef, externalHoveredNodeId, onNodeClick, onNodeDoubleClick, onNodeRightClick, onStageClick, onStageRightClick, onHover, onCameraUpdated });
  useEffect(() => {
    latestProps.current = { groups, ns, repeats, selectedIds, selectionBoxRef, externalHoveredNodeId, onNodeClick, onNodeDoubleClick, onNodeRightClick, onStageClick, onStageRightClick, onHover, onCameraUpdated };
  });

  useImperativeHandle(ref, () => ({
    getSigma: () => sigmaRef.current,
    getGraph: () => graphRef.current,
    refresh: () => sigmaRef.current?.refresh(),
    animatedReset: (options: any) => {
      if (sigmaRef.current) (sigmaRef.current as any).camera.animatedReset(options);
    },
    animate: (state: any, options: any) => {
      if (sigmaRef.current) (sigmaRef.current as any).camera.animate(state, options);
    },
    viewportToGraph: (pos: any) => sigmaRef.current?.viewportToGraph(pos),
    graphToViewport: (pos: any) => sigmaRef.current?.graphToViewport(pos),
    zoomToNode: (id: string) => {
      const displayData = (sigmaRef.current as any)?.getNodeDisplayData(id);
      if (displayData) {
        const px = Number(displayData.x);
        const py = Number(displayData.y);
        if (!isNaN(px) && !isNaN(py)) {
          (sigmaRef.current as any)?.camera.animate({ x: px, y: py, ratio: 0.8 }, { duration: 150 });
        }
      }
    }
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    const renderer = new Sigma(graphRef.current, containerRef.current, {
      renderLabels: false,
      defaultEdgeColor: "rgba(0, 0, 0, 0)", 
      renderEdgeLabels: false,
      autoRescale: false,
      defaultDrawNodeHover: () => null,
      doubleClickZoomingRatio: 1, 
    });
    sigmaRef.current = renderer;

    const syncCanvasSize = () => {
      if (!underlayCanvasRef.current || !overlayCanvasRef.current || !containerRef.current) return false;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      
      const dpr = window.devicePixelRatio || 1;
      const newW = Math.floor(rect.width * dpr);
      const newH = Math.floor(rect.height * dpr);
      let changed = false;

      if (underlayCanvasRef.current.width !== newW || underlayCanvasRef.current.height !== newH) {
        underlayCanvasRef.current.width = newW;
        underlayCanvasRef.current.height = newH;
        underlayCanvasRef.current.style.width = `${rect.width}px`;
        underlayCanvasRef.current.style.height = `${rect.height}px`;
        changed = true;
      }
      if (overlayCanvasRef.current.width !== newW || overlayCanvasRef.current.height !== newH) {
        overlayCanvasRef.current.width = newW;
        overlayCanvasRef.current.height = newH;
        overlayCanvasRef.current.style.width = `${rect.width}px`;
        overlayCanvasRef.current.style.height = `${rect.height}px`;
        changed = true;
      }
      return changed;
    };

    syncCanvasSize();
    const resizeObserver = new ResizeObserver(() => { if (syncCanvasSize()) renderer.refresh(); });
    resizeObserver.observe(containerRef.current);

    let lastHoveredNode: string | null = null;
    let lastHoveredGroup: string | null = null;
    
    const handleCustomHover = (e: MouseEvent) => {
      if (!containerRef.current || !sigmaRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const scale = 1 / sigmaRef.current.getCamera().ratio;
      
      let foundNode: string | null = null;
      let foundGroup: string | null = null;

      graphRef.current.forEachNode((node, data) => {
        if (data.isGroup) return;
        const vp = sigmaRef.current!.graphToViewport({ x: data.x, y: data.y });
        const nodeW = (data.width || 160) * scale;
        const nodeH = (data.height || 36) * scale;
        if (mouseX >= vp.x - nodeW/2 && mouseX <= vp.x + nodeW/2 && mouseY >= vp.y - nodeH/2 && mouseY <= vp.y + nodeH/2) {
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
             if (mouseX >= vp.x - gw / 2 && mouseX <= vp.x + gw / 2 && mouseY >= vp.y - gh / 2 && mouseY <= vp.y + gh / 2) {
               foundGroup = gName; break;
             }
           }
        }
      }

      if (foundNode !== lastHoveredNode || foundGroup !== lastHoveredGroup) {
        lastHoveredNode = foundNode; lastHoveredGroup = foundGroup;
        hoveredNode.current = foundNode; hoveredGroup.current = foundGroup;
        if (latestProps.current.onHover) latestProps.current.onHover(foundNode, foundGroup);
        sigmaRef.current?.refresh();
      }
    };
    
    const handleMouseLeave = () => {
      if (lastHoveredNode !== null || lastHoveredGroup !== null) {
        lastHoveredNode = null; lastHoveredGroup = null;
        hoveredNode.current = null; hoveredGroup.current = null;
        if (latestProps.current.onHover) latestProps.current.onHover(null, null);
        sigmaRef.current?.refresh();
      }
    };

    containerRef.current.addEventListener('mousemove', handleCustomHover);
    containerRef.current.addEventListener('mouseleave', handleMouseLeave);

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault(); e.stopPropagation();
      const camera = sigmaRef.current!.getCamera();
      if (!e.ctrlKey && !e.metaKey) {
        camera.setState({ x: camera.x + e.deltaX * camera.ratio / 100, y: camera.y - e.deltaY * camera.ratio / 100 });
      } else {
        const rect = containerRef.current!.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const mousePx = e.clientX - rect.left;
        const mousePy = e.clientY - rect.top;
        const dxPx = mousePx - rect.width / 2;
        const dyPx = mousePy - rect.height / 2;
        const dxNorm = dxPx / size;
        const dyNorm = dyPx / size;
        
        let newRatio = camera.ratio * Math.pow(1.01, e.deltaY);
        newRatio = Math.max(0.01, Math.min(newRatio, 100));
        const deltaRatio = camera.ratio - newRatio;

        camera.setState({ x: camera.x + dxNorm * deltaRatio, y: camera.y - dyNorm * deltaRatio, ratio: newRatio });
      }
    };
    containerRef.current.addEventListener('wheel', handleWheel, { capture: true, passive: false });

    renderer.on("clickNode", (e: any) => latestProps.current.onNodeClick?.(e.event.original, e.node));
    renderer.on("doubleClickNode", (e: any) => { e.event.original.preventDefault(); latestProps.current.onNodeDoubleClick?.(e.node); });
    renderer.on("rightClickNode", (e: any) => { e.event.original.preventDefault(); latestProps.current.onNodeRightClick?.(e.event.original, e.node); });
    renderer.on("clickStage", (e: any) => latestProps.current.onStageClick?.(e.event.original));
    renderer.on("rightClickStage", (e: any) => { e.event.original.preventDefault(); latestProps.current.onStageRightClick?.(e.event.original); });

    const updateCameraInfo = () => {
      if (sigmaRef.current && latestProps.current.onCameraUpdated) {
        const cam = (sigmaRef.current as any).camera;
        latestProps.current.onCameraUpdated({ x: cam.x, y: cam.y, ratio: cam.ratio });
      }
    };
    (renderer as any).camera.on("updated", updateCameraInfo);

    renderer.on("afterRender", () => {
      const underCtx = underlayCanvasRef.current?.getContext("2d");
      const overCtx = overlayCanvasRef.current?.getContext("2d");
      if (!underCtx || !overCtx || !underlayCanvasRef.current || !overlayCanvasRef.current) return;
      
      const dpr = window.devicePixelRatio || 1;
      const width = underlayCanvasRef.current.width / dpr;
      const height = underlayCanvasRef.current.height / dpr;

      if (underlayCanvasRef.current.width !== Math.floor(width * dpr)) {
        syncCanvasSize(); return;
      }

      underCtx.save(); overCtx.save();
      underCtx.scale(dpr, dpr); overCtx.scale(dpr, dpr);
      underCtx.clearRect(0, 0, width, height); overCtx.clearRect(0, 0, width, height);
      
      const scale = 1 / renderer.getCamera().ratio;
      const props = latestProps.current;
      const activeHoveredNode = props.externalHoveredNodeId || hoveredNode.current;

      sortedGroupsRef.current.forEach(gName => {
        const gData = props.groups[gName] || { color: '#555555' };
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
        if (baseColor.length === 4) { baseColor = '#' + baseColor[1] + baseColor[1] + baseColor[2] + baseColor[2] + baseColor[3] + baseColor[3]; }

        let r = parseInt(baseColor.slice(1, 3), 16) || 85;
        let g = parseInt(baseColor.slice(3, 5), 16) || 85;
        let b = parseInt(baseColor.slice(5, 7), 16) || 85;
        let a = 0.05;

        if (isHovered) {
           r = Math.min(255, Math.floor(r * 1.2 + 20));
           g = Math.min(255, Math.floor(g * 1.2 + 20));
           b = Math.min(255, Math.floor(b * 1.2 + 20));
           a = 0.1; 
        }
        underCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
        underCtx.fillRect(minX, minY, gw, gh);
      });

      // === РИСУЕМ КРАСИВЫЕ СТРЕЛКИ СВЯЗЕЙ ВРУЧНУЮ ===
      underCtx.save();
      graphRef.current.forEachEdge((edge, attrs, source, target, sourceAttrs, targetAttrs) => {
         const p1 = renderer.graphToViewport({ x: sourceAttrs.x, y: sourceAttrs.y });
         const p2 = renderer.graphToViewport({ x: targetAttrs.x, y: targetAttrs.y });
         
         const dx = p2.x - p1.x;
         const dy = p2.y - p1.y;
         const dist = Math.sqrt(dx*dx + dy*dy);
         if (dist === 0) return;

         const dirX = dx / dist;
         const dirY = dy / dist;

         // Размеры узла назначения, чтобы стрелка касалась его края, а не центра
         const tw = (targetAttrs.width || 160) * scale;
         const th = (targetAttrs.height || 36) * scale;

         const absDirX = Math.abs(dirX);
         const absDirY = Math.abs(dirY);
         const intersectDistX = absDirX > 0 ? (tw / 2) / absDirX : Infinity;
         const intersectDistY = absDirY > 0 ? (th / 2) / absDirY : Infinity;
         const intersectDist = Math.min(intersectDistX, intersectDistY) + (2 * scale); // Небольшой отступ

         const arrowX = p2.x - dirX * intersectDist;
         const arrowY = p2.y - dirY * intersectDist;

         // Линия связи
         underCtx.strokeStyle = "rgba(160, 174, 192, 0.4)";
         underCtx.lineWidth = 1.5 * scale;
         underCtx.beginPath();
         underCtx.moveTo(p1.x, p1.y);
         underCtx.lineTo(arrowX, arrowY);
         underCtx.stroke();

         // Треугольный наконечник
         const angle = Math.atan2(dy, dx);
         const arrowLen = 8 * scale;
         underCtx.fillStyle = "rgba(160, 174, 192, 0.8)";
         underCtx.beginPath();
         underCtx.moveTo(arrowX, arrowY);
         underCtx.lineTo(arrowX - arrowLen * Math.cos(angle - Math.PI/7), arrowY - arrowLen * Math.sin(angle - Math.PI/7));
         underCtx.lineTo(arrowX - arrowLen * Math.cos(angle + Math.PI/7), arrowY - arrowLen * Math.sin(angle + Math.PI/7));
         underCtx.closePath();
         underCtx.fill();
      });
      underCtx.restore();

      graphRef.current.forEachNode((node, data) => {
        if (data.isGroup) return;
        const vp = renderer.graphToViewport({ x: data.x, y: data.y });
        const x = vp.x, y = vp.y;
        const isSelected = props.selectedIds.has(node);
        const isHovered = activeHoveredNode === node;
        const w = (data.width || 160) * scale; 
        const h = (data.height || 36) * scale;
        
        if (data.status?.isLocked && !isSelected && !isHovered) { overCtx.fillStyle = "rgba(30, 30, 30, 1.0)"; } 
        else if (isSelected) { overCtx.fillStyle = "rgba(49, 130, 206, 1.0)"; } 
        else if (isHovered) { overCtx.fillStyle = "rgba(45, 55, 72, 1.0)"; } 
        else { overCtx.fillStyle = "rgba(10, 10, 10, 1.0)"; }

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
        const gData = props.groups[gName] || { color: '#555555' };
        const groupNode = graphRef.current.hasNode(gName) ? graphRef.current.getNodeAttributes(gName) : null;
        if (!groupNode || groupNode.width === undefined) return;
        
        const vp = renderer.graphToViewport({ x: groupNode.x, y: groupNode.y });
        const gw = groupNode.width * scale;
        const gh = groupNode.height * scale;
        const minX = vp.x - gw / 2;
        const minY = vp.y - gh / 2;

        if (gw < 30 || gh < 20) return; 

        let baseColor = gData.color || '#555555';
        if (!baseColor.startsWith('#')) baseColor = rgba2hex(baseColor) || '#555555';
        baseColor = baseColor.padEnd(7, '0');
        if (baseColor.length === 4) { baseColor = '#' + baseColor[1] + baseColor[1] + baseColor[2] + baseColor[2] + baseColor[3] + baseColor[3]; }

        let r = parseInt(baseColor.slice(1, 3), 16) || 85;
        let g = parseInt(baseColor.slice(3, 5), 16) || 85;
        let b = parseInt(baseColor.slice(5, 7), 16) || 85;

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
        overCtx.fillRect(pillX, pillY, pillW, pillH);
        
        overCtx.strokeStyle = `rgba(${r}, ${g}, ${b}, 1.0)`; 
        overCtx.lineWidth = 1.2;
        overCtx.strokeRect(pillX, pillY, pillW, pillH);

        overCtx.fillStyle = "#ffffff";
        overCtx.textAlign = "left";
        overCtx.textBaseline = "middle";
        overCtx.fillText(text, pillX + 8, pillY + pillH / 2 + 1);
      });

      if (props.selectionBoxRef && props.selectionBoxRef.current) {
          const { x, y, w, h } = props.selectionBoxRef.current;
          overCtx.fillStyle = "rgba(49, 130, 206, 0.15)";
          overCtx.fillRect(x, y, w, h);
          overCtx.strokeStyle = "rgba(49, 130, 206, 0.8)";
          overCtx.lineWidth = 1;
          overCtx.strokeRect(x, y, w, h);
      }

      underCtx.restore(); overCtx.restore();
    });

    return () => {
      resizeObserver.disconnect();
      if (onCameraUpdated) (renderer as any).camera.removeListener("updated", updateCameraInfo);
      containerRef.current?.removeEventListener('wheel', handleWheel, { capture: true });
      containerRef.current?.removeEventListener('mousemove', handleCustomHover);
      containerRef.current?.removeEventListener('mouseleave', handleMouseLeave);
      renderer.kill();
    };
  }, []);

  useEffect(() => {
    const graph = graphRef.current;
    const existingNodes = new Set(graph.nodes());
    const existingEdges = new Set(graph.edges());

    const groupSortList: any[] = [];

    reactflowNs.forEach((n: any) => {
      const isGroup = n.type === 'SpGroup';
      
      if (isGroup) {
         groupSortList.push(n);
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
      const content = ns[n.id];
      if (content !== undefined) {
        label = content.split(SIDE_SPLIT_SYM)[0].replace(/<[^>]*>?/gm, '').trim() || n.id;
        try { status = getCardState(n.id, ns, repeats); } catch(e) {}
      }

      if (graph.hasNode(n.id)) {
         graph.updateNode(n.id, attrs => ({ ...attrs, x: n.position.x, y: n.position.y, width: n.width, height: n.height, label, status }));
         existingNodes.delete(n.id);
      } else {
         graph.addNode(n.id, { x: n.position.x, y: n.position.y, width: n.width, height: n.height, size: 15, label, color: "rgba(0,0,0,0)", isGroup: false, status });
      }
    });

    groupSortList.sort((a, b) => (b.width * b.height) - (a.width * a.height));
    sortedGroupsRef.current = groupSortList.map(g => g.id);

    reactflowEs.forEach((e: any) => {
      if (graph.hasNode(e.source) && graph.hasNode(e.target)) {
          if (graph.hasEdge(e.source, e.target)) existingEdges.delete(graph.edge(e.source, e.target)!);
          else graph.addEdge(e.source, e.target, { size: 1, color: '#4a5568', type: 'arrow' });
      }
    });

    existingEdges.forEach(e => { if (graph.hasEdge(e)) graph.dropEdge(e); });
    existingNodes.forEach(n => { if (graph.hasNode(n)) graph.dropNode(n); });

    sigmaRef.current?.refresh();
  }, [reactflowNs, reactflowEs, ns, groups, repeats]);

  return (
    <Box position="relative" w="100%" h="100%">
      <canvas ref={underlayCanvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0, backgroundColor: 'transparent' }} />
      <div ref={containerRef} className="sigma-container" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, backgroundColor: 'transparent' }} />
      <canvas ref={overlayCanvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2, backgroundColor: 'transparent' }} />
    </Box>
  );
}));

const ResizeHandle = ({ cursor, top, left, right, bottom, w, h, onDown }: any) => (
  <Box position="absolute" top={top} left={left} right={right} bottom={bottom} w={w} h={h} cursor={cursor} onPointerDown={onDown} zIndex={100} />
);

// --- 1. ОБНОВЛЕНИЕ MINIGRAPHPOPU И ЕГО ШАПКИ СО СТАТИСТИКОЙ ---
import { MdClose, MdDelete } from 'react-icons/md';
import { Header } from "../../components/header";

const MiniGraphPopup = memo(({ id, type, targetNodes, targetGroups, x, y, ns, groups, onClose, onDelete, onRepeat }: any) => {
    const rendererRef = useRef<any>(null);
    const { repeats } = useGraphCtx() as any;
    
    const [reactflowNs, reactflowEs, miniNs, miniGroups] = useMemo(() => {
        const visited = new Set<string>();
        
        if (type === 'group' || type === 'root') {
            (targetNodes || []).forEach((n: string) => visited.add(n));
        } else {
            const traverse = (currId: string) => {
                if (visited.has(currId)) return;
                visited.add(currId);
                const content = ns[currId];
                if (!content) return;
                const matches = [...content.matchAll(/<id=([a-zA-Z0-9_.:-]+)>/g)];
                for (const match of matches) {
                    traverse(match[1]);
                }
            };
            traverse(id);
        }
        
        const mNs: any = {};
        visited.forEach(n => { mNs[n] = ns[n] || ''; });

        const mGroups: any = {};
        if (targetGroups) {
            targetGroups.forEach((gName: string) => {
                if (groups && groups[gName]) mGroups[gName] = groups[gName];
            });
        }
        
        // Получаем расчеты из calcG (так же, как это делает основной Flow)
        const [rNs, rEs] = calcG(mNs, mGroups, {x:1, y:1});

        // 1. Очищаем узлы от суффиксов :0, :1, чтобы отображать единые базовые карточки.
        const baseNsMap = new Map();
        rNs.forEach((n: any) => {
            if (n.type === 'SpGroup') {
                baseNsMap.set(n.id, n);
                return;
            }
            const baseId = n.id.replace(/:\d+$/, '');
            if (!baseNsMap.has(baseId)) {
                baseNsMap.set(baseId, { ...n, id: baseId });
            }
        });
        const cleanNs = Array.from(baseNsMap.values());

        // 2. Берем готовые связи из calcG и тоже очищаем их от суффиксов.
        const cleanEs: any[] = [];
        const seenEdges = new Set<string>();
        
        rEs.forEach((e: any) => {
            // calcG выдает source (потомок) -> target (предок). 
            // Разворачиваем стрелку (target -> source), чтобы линия шла от предка к потомку:
            const ancestorId = e.target.replace(/:\d+$/, ''); 
            const descendantId = e.source.replace(/:\d+$/, ''); 
            
            const edgeId = `${descendantId}->${ancestorId}`;

            // Защита от дублей и петель на самого себя (если разные стороны 1 карты ссылались друг на друга)
            if (ancestorId !== descendantId && !seenEdges.has(edgeId)) {
                // Убеждаемся, что оба узла существуют в нашем очищенном списке
                if (baseNsMap.has(ancestorId) && baseNsMap.has(descendantId)) {
                    seenEdges.add(edgeId);
                    cleanEs.push({
                        id: edgeId,
                        source: descendantId,
                        target: ancestorId,
                    });
                }
            }
        });

        return [cleanNs, cleanEs, mNs, mGroups];
    }, [id, type, targetNodes, targetGroups, ns, groups]);

    const stats = useMemo(() => {
        let newCnt = 0, dueCnt = 0, learnedCnt = 0;
        Object.keys(miniNs).forEach(n => {
            const st = getCardState(n, ns, repeats);
            if (!st.isLocked) {
                if (st.isNew) newCnt++;
                else if (st.isDue) dueCnt++;
                else if (st.isLearned) learnedCnt++;
            }
        });
        return { newCnt, dueCnt, learnedCnt };
    }, [miniNs, ns, repeats]);

    useEffect(() => {
        if (rendererRef.current) {
            setTimeout(() => {
                rendererRef.current.animatedReset({ duration: 200 });
            }, 50);
        }
    }, [reactflowNs]);

    const rectRef = useRef({ x: 0, y: 0, w: 400, h: 300 });
    const [rect, setRectState] = useState(rectRef.current);
    const setRect = (newRect: any) => { rectRef.current = newRect; setRectState(newRect); };

    useEffect(() => {
       const w = 400; const h = 300;
       let finalX = Math.min(x + 15, window.innerWidth - w - 15);
       finalX = Math.max(15, finalX);
       let finalY = Math.min(y + 15, window.innerHeight - h - 15);
       finalY = Math.max(15, finalY);
       setRect({ x: finalX, y: finalY, w, h });
    }, [x, y]);

    const handlePointerDown = (e: React.PointerEvent, action: string) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startY = e.clientY;
        const startRect = { ...rectRef.current };

        const handleMove = (moveEvent: PointerEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;
            let { x, y, w, h } = startRect;
            
            if (action === 'move') { 
                x += dx; 
                y += dy; 
            } else {
                if (action.includes('e')) w += dx;
                if (action.includes('s')) h += dy;
                if (action.includes('w')) { x += dx; w -= dx; }
                if (action.includes('n')) { y += dy; h -= dy; }
                
                if (w < 200) { if (action.includes('w')) x += (w - 200); w = 200; }
                if (h < 150) { if (action.includes('n')) y += (h - 150); h = 150; }
            }
            
            setRect({ x, y, w, h });
        };

        const handleUp = () => {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
        };

        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', handleUp);
    };

    return createPortal(
        <Box position="fixed" top={rect.y} left={rect.x} w={`${rect.w}px`} h={`${rect.h}px`} bg="#1e1e1e" border="1px solid color-mix(in srgb, #666 40%, transparent)" borderRadius="md" zIndex={99999} boxShadow="dark-lg" display="flex" flexDirection="column">
            
            <HStack h="30px" bg="rgba(40,40,40,0.95)" px={2} cursor="grab" onPointerDown={(e) => handlePointerDown(e, 'move')} borderBottom="1px solid rgba(255,255,255,0.1)">
                <Text fontSize="12px" fontWeight="600" color="white"
                  // @ts-expect-error
                  noOfLines={1} pointerEvents="none">
                    {type === 'root' ? 'Root' : id}
                </Text>
                
                {/* Вставляем статистику прямо сюда */}
                <HStack gap="3" fontSize="10px" fontWeight="normal" ml={3} mr={3} pointerEvents="none">
                    <Text color="blue.400">New: {stats.newCnt}</Text>
                    <Text color="red.400">Due: {stats.dueCnt}</Text>
                    <Text color="green.400">Learned: {stats.learnedCnt}</Text>
                </HStack>
                
                <Spacer pointerEvents="none" />
                <Button size="xs" height="20px" variant="subtle" colorPalette="blue" onClick={(e) => { e.stopPropagation(); onRepeat?.(); }}>Repeat</Button>
                <IconButton aria-label="Delete" size="xs" height="20px" minW="20px" variant="ghost" colorPalette="red" onClick={(e) => { e.stopPropagation(); onDelete?.(); }}><MdDelete/></IconButton>
                <IconButton aria-label="Close" size="xs" height="20px" minW="20px" variant="ghost" onClick={(e) => { e.stopPropagation(); onClose?.(); }}><MdClose/></IconButton>
            </HStack>

            <Box position="relative" flex={1}>
              <GraphRenderer
                 ref={rendererRef}
                 reactflowNs={reactflowNs}
                 reactflowEs={reactflowEs}
                 ns={miniNs}
                 groups={miniGroups}
                 repeats={repeats}
                 selectedIds={new Set([id])}
              />
            </Box>

            <ResizeHandle cursor="ew-resize" top={'-16px'} bottom={0} left={'-16px'} w="16px" onDown={(e: any) => handlePointerDown(e, 'w')} />
            <ResizeHandle cursor="ew-resize" top={'-16px'} bottom={0} right={'-16px'} w="16px" onDown={(e: any) => handlePointerDown(e, 'e')} />
            <ResizeHandle cursor="ns-resize" left={0} right={0} top={'-16px'} h="16px" onDown={(e: any) => handlePointerDown(e, 'n')} />
            <ResizeHandle cursor="ns-resize" left={0} right={0} bottom={'-16px'} h="16px" onDown={(e: any) => handlePointerDown(e, 's')} />
            <ResizeHandle cursor="nwse-resize" top={'-16px'} left={'-16px'} w="16px" h="16px" onDown={(e: any) => handlePointerDown(e, 'nw')} />
            <ResizeHandle cursor="nesw-resize" top={'-16px'} right={'-16px'} w="16px" h="16px" onDown={(e: any) => handlePointerDown(e, 'ne')} />
            <ResizeHandle cursor="nesw-resize" bottom={'-16px'} left={'-16px'} w="16px" h="16px" onDown={(e: any) => handlePointerDown(e, 'sw')} />
            <ResizeHandle cursor="nwse-resize" bottom={'-16px'} right={'-16px'} w="16px" h="16px" onDown={(e: any) => handlePointerDown(e, 'se')} />
        </Box>,
        document.body
    );
});



const HighlightText = ({ text, query }: { text: string, query: string }) => {
  if (!query || !text) return <>{text}</>;
  const parts = text.toString().split(new RegExp(`(${query})`, 'gi'));
  return (
    <span style={{ display: 'inline' }}>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <span key={i} style={{ backgroundColor: 'rgba(255, 215, 0, 0.4)', color: '#fff', borderRadius: '2px', padding: '0 1px' }}>{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
};

const TreeRowContent = memo(({
  item, actions, nsContent, groupData, isEditingCard, isSel, isFirstSel, isLastSel, isCanvasHovered, isDropTargetInside, graphName
}: any) => {
  const isRoot = item.type === 'root';
  const isGroup = item.type === 'group' || isRoot;
  const itemHexColor = isRoot ? '#666666' : (isGroup ? (groupData?.color?.startsWith('#') ? groupData.color : rgba2hex(groupData?.color || '#555555')) : null);
  
  const [localColor, setLocalColor] = useState(itemHexColor || '#555555');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(isRoot ? graphName : item.id);

  useEffect(() => {
    if (isRoot) setEditName(graphName);
    else setEditName(item.id);
  }, [isRoot, graphName, item.id]);

  useEffect(() => {
    if (isGroup && !isRoot && localColor !== itemHexColor && itemHexColor) {
      const handler = setTimeout(() => { actions.handleChangeGroupColor(item.id, localColor); }, 200);
      return () => clearTimeout(handler);
    }
  }, [localColor, itemHexColor, item.id, isGroup, isRoot, actions]);

  const onRenameSubmit = () => {
    setIsEditing(false);
    if (isRoot) {
        if (editName && editName !== graphName) actions.handleRenameRoot(editName);
        else setEditName(graphName);
        return;
    }
    if (!editName || editName === item.id || actions.hasGroup(editName)) { setEditName(item.id); return; }
    actions.handleRenameGroup(item.id, editName);
  };

  const isMergedTop = isSel && !isFirstSel;
  const isMergedBottom = isSel && !isLastSel;
  const isSearchMatch = item.isSearchMatch;

  const defaultBg = (isSearchMatch && !isGroup) ? 'rgba(255, 215, 0, 0.08)' : 'transparent';
  const innerBg = isSel 
    ? (isFirstSel && isGroup ? 'rgba(49, 130, 206, 0.4)' : 'rgba(49, 130, 206, 0.2)') 
    : (isCanvasHovered ? 'rgba(255, 255, 255, 0.1)' : defaultBg);

  const matchBorder = (isSearchMatch && !isGroup) 
    ? '1px solid rgba(255, 215, 0, 0.4)' 
    : (isDropTargetInside ? '1px solid #0d99ff' : '1px solid transparent');

  const indentPx = item.depth * 20 + (isGroup ? 10 : 8); 

  return (
    <Box
      pt={(isGroup && isMergedTop) ? '12px' : '0px'}
      mt={(isGroup && !isMergedTop) ? '12px' : '0px'}

      position="relative"
      zIndex={isSel ? 1 : 0}

      minH={'auto'}
      h={'auto'}
      w="100%"
      display="flex"
      alignItems="center"
      pr="8px"
      bg={isDropTargetInside ? 'rgba(13, 153, 255, 0.2)' : innerBg} 
      borderTopRadius={isMergedTop ? "0px" : "4px"}
      borderBottomRadius={isMergedBottom || item.collapsed? "0px" : "4px"}
      pb={item.depthPrev < item.depth? '5px': '0px'}

      border={matchBorder}
      cursor={isGroup ? "default" : (isEditingCard ? "text" : "pointer")}
      onClick={(e) => {
        if (isEditingCard) return; 
        e.stopPropagation();
        if (e.altKey) {
            actions.onAltClick(e, item.id, item.type);
            return;
        }
        actions.onClick(e, item.id, item.type);
      }}
      onDoubleClick={(e) => {
        if (isEditingCard) return; 
        e.stopPropagation();
        if (!isGroup && actions.onDoubleClickNode) {
          actions.onDoubleClickNode(item.id);
        }
      }}
    >
      {isGroup ? (
        <Box
          pl={`${indentPx}px`}
          m={0}
          fontSize="11px" fontWeight="500" w="100%" display="flex" flexDirection="row" alignItems="center" gap={'0px'}
          _hover={isFirstSel? {} : {
            bgColor: 'color-mix(in srgb, white, transparent 90%)',
          }}
          borderRadius={'5px'}
        >
          <IconButton variant={'plain'} h={'20px'} w={'20px'} minW={'20px'} p={0} onClick={(e) => { e.stopPropagation(); actions.onToggleGroup(item.id); }}>
            {item.collapsed ? <LuChevronRight className={'smIcon'} /> : <LuChevronDown className={'smIcon'} />}
          </IconButton>

          <Box w={'100%'} display={'flex'} flexDirection={'row'} p={0} m={0} alignItems={'center'}>
            <LuPilcrow opacity={0.4}/>
            <Text fontWeight={400} fontSize="10px" opacity={0.4} whiteSpace="nowrap">{item.numbering}</Text>

            {isEditing ? (
              <input autoFocus value={editName} onChange={e => setEditName(e.target.value)}
                onBlur={onRenameSubmit} onClick={e => e.stopPropagation()}
                onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') onRenameSubmit(); if (e.key === 'Escape') { setIsEditing(false); setEditName(item.id); } }}
                style={{ marginBottom: '2px', flex: 1, background: 'rgba(0,0,0,0.3)', color: 'white', outline: 'none', border: '1px solid gray', borderRadius: '3px', padding: '0 4px' }}
              />
            ) : (
              <Box mb={'2px'} ml={'8px'} opacity={0.3} flex={1} fontWeight={400} fontSize={'11px'} onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}>
                <HighlightText text={item.id} query={actions.searchQuery} />
              </Box>
            )}

            <Box
              as="input" 
              // @ts-expect-error
              type={"color"}
              value={itemHexColor?.slice(0, 7) || '#555555'} 
              onChange={(e:any)=>{ e.stopPropagation(); setLocalColor(e.target.value); }} 
              onClick={(e:any)=>{ e.stopPropagation() }} 
              style={{ width: '14px', height: '14px', padding: 0, border: 'none', background: 'none', cursor: 'pointer', borderRadius: '50%' }} 
            />
          </Box>
        </Box>
      ) : (
        <Box
          m={0}
          display="flex" 
          flex={1}
          minW={0}
          h={'auto'}
          my="auto"
          py={'2px'}
          overflow="hidden"
          pointerEvents="auto" 
          alignItems="center"
        >
          <Box
            className="hover-row"
            w="100%"
            p={"4px 0px"}
            m={0}
            display="flex"
            alignItems="center" 
            borderRadius="3px"
            pl={`${indentPx}px`}
            _hover={isGroup? {} : {
              bgColor: 'color-mix(in srgb, white, transparent 90%)',
            }}
            onClickCapture={(e) => {
              if (isEditingCard) return; 
              if (e.altKey) {
                actions.onAltClick(e, item.id, item.type);
                e.stopPropagation(); 
                return;
              }
            }}
            onDoubleClickCapture={(e) => {
              if (isEditingCard) return;
              e.stopPropagation();
              if (actions.onDoubleClickNode) {
                  actions.onDoubleClickNode(item.id);
              }
            }}
          >
            <Card
              id={item.id}
              content={nsContent}
              options={{ stats: false, twoSides: isEditingCard, padding: '0px', fontSize: 11 }}
              focus={isEditingCard}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
}, (prev, next) => {
  return prev.item.id === next.item.id &&
         prev.item.collapsed === next.item.collapsed &&
         prev.item.depth === next.item.depth && 
         prev.item.isSearchMatch === next.item.isSearchMatch &&
         prev.actions.searchQuery === next.actions.searchQuery &&
         prev.actions.mode === next.actions.mode &&
         prev.nsContent === next.nsContent &&
         prev.groupData === next.groupData &&
         prev.isEditingCard === next.isEditingCard &&
         prev.isSel === next.isSel &&
         prev.isFirstSel === next.isFirstSel &&
         prev.isLastSel === next.isLastSel &&
         prev.isCanvasHovered === next.isCanvasHovered &&
         prev.isDropTargetInside === next.isDropTargetInside &&
         prev.graphName === next.graphName;
});

const SimpleTreeRow = memo(({ 
  item, actions, ns, groups, selSet, hoveredNodeId, isFirstSel, isLastSel, graphName
}: any) => {
  const isEditingCard = actions.editingId === item.id && item.type !== 'group';
  
  const isSel = selSet.has(item.id);
  const isGroup = item.type === 'group';
  
  const isDropTargetInside = actions.dropTarget?.id === item.id && actions.dropTarget?.pos === 'inside';

  return (
    <>
      <Box 
        className={`tree-row ${isSel ? 'selected' : ''} ${isGroup ? 'group-row' : ''}`}
        data-tree-id={item.id}
        draggable={!isEditingCard && item.type !== 'root'}
        onDragStart={(e) => actions.onDragStart(e, item.id, item.type)}
        onDragOver={(e) => actions.onDragOverRow(e, item.id, item.type)}
        onDragLeave={actions.onDragLeaveRow}
        onDrop={(e) => actions.onDrop(e, item.id, item.type)}
        onContextMenu={(e) => actions.onContextMenu(e, item.id, item.type)}
        px="8px"
        pt={"0px"}
        pb={"0px"}
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
          graphName={graphName}
        />
      </Box>
    </>
  );
}, (prev, next) => {
  const prevIsEditing = prev.actions.editingId === prev.item.id;
  const nextIsEditing = next.actions.editingId === next.item.id;
  const prevIsTarget = prev.actions.dropTarget?.id === prev.item.id;
  const nextIsTarget = next.actions.dropTarget?.id === next.item.id;
  
  return prev.item.id === next.item.id &&
         prev.item.collapsed === next.item.collapsed &&
         prev.item.depth === next.item.depth && 
         prev.item.isSearchMatch === next.item.isSearchMatch &&
         prev.actions.searchQuery === next.actions.searchQuery &&
         prev.actions.mode === next.actions.mode &&
         prev.selSet.has(prev.item.id) === next.selSet.has(next.item.id) &&
         prev.isFirstSel === next.isFirstSel &&
         prev.isLastSel === next.isLastSel &&
         (prev.hoveredNodeId === prev.item.id) === (next.hoveredNodeId === next.item.id) && 
         prev.ns[prev.item.id] === next.ns[next.item.id] &&
         prevIsEditing === nextIsEditing &&
         prevIsTarget === nextIsTarget &&
         prev.actions.dropTarget?.pos === next.actions.dropTarget?.pos &&
         prev.actions.dropTarget?.depth === next.actions.dropTarget?.depth &&
         prev.graphName === next.graphName &&
         (prev.item.type === 'node' || prev.groups[prev.item.id] === next.groups[next.item.id]);
});

const TreeView = memo(React.forwardRef(({ flatTree, sel, ns, groups, actions, hoveredNodeId, graphName }: any, ref: any) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const selSet = useMemo(() => new Set(sel), [sel]);

  useImperativeHandle(ref, () => ({
    scrollToNode: (id: string) => {
      setTimeout(() => {
        const el = document.querySelector(`[data-tree-id="${id}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50); 
    }
  }));

  const dropTarget = actions.dropTarget;

  return (
    <div 
      className='GraphmodeStack' 
      ref={scrollContainerRef}
      onDragOver={(e) => { e.preventDefault(); actions.onDragOverRoot(e); }}
      onDrop={actions.onDropOnRoot}
    >
      <Box display="flex" flexDirection="column" w="100%" pb="20px">
         {flatTree.map((item: any, index: number) => {
           const isSel = selSet.has(item.id);
           const isFirstSel = isSel && (index === 0 || !selSet.has(flatTree[index - 1].id));
           const isLastSel = isSel && (index === flatTree.length - 1 || !selSet.has(flatTree[index + 1].id));
           item.depthPrev = flatTree[index > 0? index - 1: 0].depth;
           item.depthPrev = flatTree[index < flatTree.length - 1? index + 1: flatTree.length - 1].depth;
           const isDropTop = dropTarget?.id === item.id && dropTarget.pos === 'top';
           const isDropBottom = dropTarget?.id === item.id && dropTarget.pos === 'bottom';
           const depthMargin = (dropTarget?.depth || 0) * 20 + 8;
           return (
             <React.Fragment key={item.id}>
               {isDropTop && (
                 <Box position="relative" w={`calc(100% - ${depthMargin}px)`} h="2px" bg="#0d99ff" zIndex={100} ml={`${depthMargin}px`}
                      _before={{ content: '""', position: "absolute", left: "-4px", top: "-2.5px", width: "7px", height: "7px", borderRadius: "50%", border: "1.5px solid #0d99ff", bg: "#1e1e1e" }}
                 />
               )}
               
               <SimpleTreeRow
                 item={item} 
                 selSet={selSet}
                 isFirstSel={isFirstSel}
                 isLastSel={isLastSel}
                 actions={actions}
                 ns={ns}
                 groups={groups}
                 hoveredNodeId={hoveredNodeId}
                 graphName={graphName}
               />
               
               {isDropBottom && (
                 <Box position="relative" w={`calc(100% - ${depthMargin}px)`} h="2px" bg="#0d99ff" zIndex={100} ml={`${depthMargin}px`}
                      _before={{ content: '""', position: "absolute", left: "-4px", top: "-2.5px", width: "7px", height: "7px", borderRadius: "50%", border: "1.5px solid #0d99ff", bg: "#1e1e1e" }}
                 />
               )}
             </React.Fragment>
           );
         })}
         <Box minH={'40px'}/>
      </Box>
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
         prev.actions.dropTarget?.pos === next.actions.dropTarget?.pos &&
         prev.actions.dropTarget?.depth === next.actions.dropTarget?.depth &&
         prev.graphName === next.graphName;
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

export const Graph=forwardRef(({}:any,ref:any)=>{
  const{ns,setNs,id,name,groups,setGroups,setRepeats}=useGraphCtx()as any;
  const[sel,setSel]=useState<string[]>([]);
  const[mode,setMode]=useState('eg') as any;
  const[curName,setCurName]=useState({'0':name}) as any;
  const[editingNodeId, setEditingNodeId] = useState<string | null>(null);

  // === SEARCH STATES ===
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // === SEARCH DEBOUNCE ===
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 1000); // Ждем 1 секунду после последнего ввода
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Глобальный перехват Ctrl+F
  useEffect(() => {
    const handleWindowKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    };
    window.addEventListener('keydown', handleWindowKeyDown);
    return () => window.removeEventListener('keydown', handleWindowKeyDown);
  }, []);
  
  const[hoveredNodeId, _] = useState<string | null>(null);
  const[altPopup, setAltPopup] = useState<{ id: string, type: string, x: number, y: number, targetNodes?: string[], targetGroups?: string[] } | null>(null);
  
  const flowRef=useRef(null) as any;
  const treeRef=useRef<any>(null); 
  
  const latestNs = useRef(ns);
  const latestGroups = useRef(groups);
  const latestName = useRef(curName);

  const [feedSelection, setFeedSelection] = useState<string[] | null>(null);
  const [feedAutoStart, setFeedAutoStart] = useState(false);
  const [feedActiveCard, setFeedActiveCard] = useState<string | null>(null); // Хранит активную карту из Feed
  
  const { open: openMenu, close: closeMenu, props: menuProps } = useContextMenu();

  const [, setSidebarWidth] = useState(400);
  const isDraggingSidebar = useRef(false);
  const graphSidesRef = useRef<HTMLDivElement>(null);
  
  const [dropTarget, setDropTarget] = useState<{ id: string, pos: 'top'|'bottom'|'inside' } | any>(null);
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
  
  const [lastSelectedIdx, setLastSelectedIdx] = useState<number | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const visibleItems = useMemo(() => {
    if (!debouncedSearch) return null; // Если поиск пуст, показываем всё
    const visible = new Set<string>();
    const q = debouncedSearch.toLowerCase();

    // 1. Ищем совпадения в нодах (ID или Контент)
    Object.keys(ns).forEach(nodeId => {
      const content = ns[nodeId] || "";
      if (nodeId.toLowerCase().includes(q) || content.toLowerCase().includes(q)) {
        visible.add(nodeId);
        // Добавляем все родительские группы, чтобы путь к ноде был открыт
        let currGroup = nodeToGroup[nodeId];
        while (currGroup) {
          visible.add(currGroup);
          currGroup = groupToGroup[currGroup];
        }
      }
    });

    // 2. Ищем совпадения в названиях групп
    Object.keys(groups).forEach(gName => {
      if (gName.toLowerCase().includes(q)) {
        visible.add(gName);
        let currGroup = groupToGroup[gName];
        while (currGroup) {
          visible.add(currGroup);
          currGroup = groupToGroup[currGroup];
        }
      }
    });

    return visible;
  }, [debouncedSearch, ns, groups, nodeToGroup, groupToGroup]);
  
  const flatTree = useMemo(() => {
    const result: any[] = [];
    const gNames = Object.keys(groups);
    const rootGroups = gNames.filter(g => !groupToGroup[g]);
    let counters: number[] = [];
    
    const rootId = '__root__';
    // Если идет поиск, автоматически игнорируем сворачивание (раскрываем всё)
    const isRootCollapsed = debouncedSearch ? false : collapsedGroups.has(rootId);

    if (!isRootCollapsed) {
        const addGroup = (groupId: string, depth: number) => {
            // Если включен фильтр и этой группы нет в списке видимых - пропускаем ветку
            if (visibleItems && !visibleItems.has(groupId)) return;

            const isCollapsed = debouncedSearch ? false : collapsedGroups.has(groupId);
            const cIdx = depth - 1;
            
            if (counters.length <= cIdx) counters.push(0);
            counters[cIdx]++;
            counters = counters.slice(0, cIdx + 1);
            const numbering = counters.join('.');
            
            result.push({ 
                type: 'group', id: groupId, depth, collapsed: isCollapsed, staticHeight: 32, extraTop: 0, numbering,
                isSearchMatch: debouncedSearch && groupId.toLowerCase().includes(debouncedSearch.toLowerCase())
            });
            
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
                            if (!visibleItems || visibleItems.has(node)) {
                                result.push({ 
                                    type: 'node', id: node, depth: depth + 1, staticHeight: 32,
                                    isSearchMatch: debouncedSearch && (node.toLowerCase().includes(debouncedSearch.toLowerCase()) || (ns[node] || "").toLowerCase().includes(debouncedSearch.toLowerCase()))
                                });
                            }
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

        rootGroups.forEach(g => addGroup(g, 1));

        Object.keys(ns).forEach(n => {
            let inGroup = false;
            for (let i = 0; i < gNames.length; i++) {
                if (groupSets[gNames[i]].has(n)) {
                    inGroup = true;
                    break;
                }
            }
            if (!inGroup && ns[n] !== undefined) {
                if (!visibleItems || visibleItems.has(n)) {
                    result.push({ 
                        type: 'node', id: n, depth: 1, staticHeight: 32,
                        isSearchMatch: debouncedSearch && (n.toLowerCase().includes(debouncedSearch.toLowerCase()) || (ns[n] || "").toLowerCase().includes(debouncedSearch.toLowerCase()))
                    });
                }
            }
        });
    }

    return result;
  }, [groups, ns, collapsedGroups, groupToGroup, groupSets, debouncedSearch, visibleItems, curName]);

  const treeState = useRef({ sel, flatTree, groups, nodeToGroup, groupToGroup, groupSets, lastSelectedIdx, ns });
  useEffect(() => {
    treeState.current = { sel, flatTree, groups, nodeToGroup, groupToGroup, groupSets, lastSelectedIdx, ns };
  });

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

  const handleRenameRoot = useCallback((newName: string) => {
    setCurName({ '0': newName });
  }, [setCurName]);

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

  const toggleGroup = useCallback((gId: string) => {
    setCollapsedGroups(prev => { const next = new Set(prev); if (next.has(gId)) next.delete(gId); else next.add(gId); return next; });
  },[]);

  const HeaderTabs = (
    <span css={graphCSS} key={'header_tabs'}>
      <Tabs.Root className='headerTabs' value={mode} onValueChange={(e)=>{
        if (editingNodeId) {
            setTimeout(() => {
                setMode(e.value);
                setEditingNodeId(null);
            }, 150);
        } else {
            setMode(e.value);
        }
      }} variant="plain">
        <Tabs.Trigger className='tabsTrigger' value="eg"><BsDiagram2Fill /></Tabs.Trigger>
        <Tabs.Trigger className='tabsTrigger' value="repeat" ml={'-6px'}><RiRepeat2Line /></Tabs.Trigger>
        <GraphCtx.Provider value={{ns:curName, setNs:setCurName}}>
            <Box p={0} m={0} onClickCapture={(e:any)=>{
                if (e.altKey) {
                  treeActions.onAltClick(e, '__root__', 'root');
                  e.stopPropagation();
                }
              }}>
              <Card id={'0'} content={name} options={{twoSides:false, fontSize:12}}/>
            </Box>
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

  const getAllDescendantsHelper = useCallback((groupId: string) => {
    const { groupSets: currentGroupSets, groupToGroup: currentGroupToGroup } = treeState.current;
    const result = new Set<string>();
    
    if (currentGroupSets[groupId]) {
        currentGroupSets[groupId].forEach(n => result.add(n));
    }
    
    const collectGroups = (gId: string) => {
      Object.keys(currentGroupToGroup).forEach(childG => {
        if (currentGroupToGroup[childG] === gId) {
          result.add(childG);
          collectGroups(childG);
        }
      });
    };
    collectGroups(groupId);
    
    return Array.from(result);
  }, []);

  const getDescendantGroups = useCallback((g: string) => {
    const { groupToGroup: currentGroupToGroup } = treeState.current;
    const res: string[] = [];
    const q = [g];
    while (q.length) {
        const cur = q.shift()!;
        Object.keys(currentGroupToGroup).forEach(c => {
            if (currentGroupToGroup[c] === cur) { res.push(c); q.push(c); }
        });
    }
    return res;
  }, []);

  const handleCreateGroup = useCallback((name: string, ids: string[]) => {
    const color = generateRandomHexColor(0.15);
    setGroups((prev:any) => ({...prev,[name]: {color, nodes:ids}}));
  }, [setGroups]);

  const handleAddNodesToGroup = useCallback((targetGroupName: string) => {
    const { sel: currentSel, groups: currentGroups, ns: currentNs, groupSets: currentGroupSets, groupToGroup: currentGroupToGroup } = treeState.current;
    const nodesToAdd = new Set<string>();
    currentSel.forEach(id => {
        if (currentGroups[id]) {
            currentGroupSets[id].forEach(n => nodesToAdd.add(n));
        } else if (currentNs[id]) {
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
          curr = currentGroupToGroup[curr];
      }
      return updated;
    });
  }, [setGroups]);

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
    const { sel: currentSel } = treeState.current;
    const selSetFast = new Set(currentSel);
    let newSel = [...currentSel];

    if (itemType === 'group') {
      const groupDescendants = getAllDescendantsHelper(itemId);
      const groupAndDescendants = [itemId, ...groupDescendants];
      const isFullySelected = groupAndDescendants.every(id => selSetFast.has(id));
      if (!isFullySelected) {
        newSel = Array.from(new Set([...currentSel, ...groupAndDescendants]));
        setSel(newSel);
      }
    } else {
      if (!selSetFast.has(itemId)) {
        newSel =[itemId];
        setSel(newSel);
      }
    }
    openMenu(e);
  },[getAllDescendantsHelper, openMenu]);

  const treeActions = useMemo(() => {
    return {
      mode,
      onModeChange: (e: any) => {
         if (editingNodeId) {
             setTimeout(() => { setMode(e.value); setEditingNodeId(null); }, 150);
         } else { setMode(e.value); }
      },
      saveGraph,
      shareUrl: APPWRITE_CONFIG.BASE_URL+'/'+id,
      searchQuery: debouncedSearch,
      handleRenameGroup,
      handleRenameRoot,
      handleChangeGroupColor,
      handleUngroup,
      onToggleGroup: toggleGroup,
      onHover: () => {},
      onAltClick: (e: React.MouseEvent, itemId: string, itemType: string) => {
        if (itemType === 'group' || itemType === 'root') {
          const { ns: currentNs, groups: currentGroups } = treeState.current;
          let nodes: string[] = [];
          let tGroups: string[] = [];
          if (itemType === 'group') {
            const desc = getAllDescendantsHelper(itemId);
            nodes = desc.filter(x => currentNs[x] !== undefined);
            tGroups = [itemId, ...getDescendantGroups(itemId)];
          } else {
            nodes = Object.keys(currentNs);
            tGroups = Object.keys(currentGroups);
          }
          setAltPopup({ id: itemId, type: itemType, x: e.clientX, y: e.clientY, targetNodes: nodes, targetGroups: tGroups });
        } else {
          setAltPopup({ id: itemId, type: 'node', x: e.clientX, y: e.clientY, targetGroups: [] });
        }
      },
      onContextMenu: handleTreeContextMenu,
      editingId: editingNodeId,
      hasGroup: (name: string) => !!treeState.current.groups[name],
      dropTarget,
      
      onClick: (e: React.MouseEvent, itemId: string, itemType: string) => {
        e.stopPropagation();
        
        if (editingNodeId && editingNodeId !== itemId) {
           setTimeout(() => setEditingNodeId(null), 150);
        }

        const isShift = e.shiftKey;
        const isCtrl = e.ctrlKey || e.metaKey;
        
        const { sel: currentSel, flatTree: currentFlatTree, lastSelectedIdx: currentLastSelectedIdx } = treeState.current;
        const selSetFast = new Set(currentSel);
        let newSel = [...currentSel];
        const index = currentFlatTree.findIndex(i => i.id === itemId);

        if (itemType === 'group') {
          const groupDescendants = getAllDescendantsHelper(itemId);
          const groupAndDescendants = [itemId, ...groupDescendants];
          
          if (isShift && currentLastSelectedIdx !== null) {
            const start = Math.min(currentLastSelectedIdx, index);
            const end = Math.max(currentLastSelectedIdx, index);
            const rangeIds = currentFlatTree.slice(start, end + 1).map((i: any) => i.id);
            if (isCtrl) {
                const toAdd = rangeIds.filter((id: string) => !selSetFast.has(id));
                newSel = [...newSel, ...toAdd];
            }
            else newSel = rangeIds;
          } else if (isCtrl) {
            const allSelected = groupAndDescendants.every(n => selSetFast.has(n));
            const gadSet = new Set(groupAndDescendants);
            if (allSelected) {
                newSel = newSel.filter((id: string) => !gadSet.has(id));
            } else {
                const toAdd = groupAndDescendants.filter(id => !selSetFast.has(id));
                newSel = [...newSel, ...toAdd];
            }
          } else {
            newSel = groupAndDescendants;
          }
          
          setLastSelectedIdx(index);
          if (newSel.length === currentSel.length && newSel.every(id => selSetFast.has(id))) return;
          setSel(newSel);
          return;
        }

        if (isShift && currentLastSelectedIdx !== null) {
          const start = Math.min(currentLastSelectedIdx, index);
          const end = Math.max(currentLastSelectedIdx, index);
          const rangeIds = currentFlatTree.slice(start, end + 1).map((i: any) => i.id);
          
          if (isCtrl) {
              const toAdd = rangeIds.filter((id: string) => !selSetFast.has(id));
              newSel = [...newSel, ...toAdd];
          }
          else newSel = rangeIds;
        } else if (isCtrl) {
          if (selSetFast.has(itemId)) newSel = newSel.filter((id: string) => id !== itemId);
          else newSel.push(itemId);
          setLastSelectedIdx(index);
        } else {
          newSel = [itemId];
          setLastSelectedIdx(index);
        }
        
        if (newSel.length === currentSel.length && newSel.every(id => selSetFast.has(id))) return;
        setSel(newSel);
      },

      onDoubleClickNode: (id: string) => {
        setEditingNodeId(id);
      },

      onDragStart: (e: React.DragEvent, dragId: string, type: 'node' | 'group' | 'root') => {
        if (type === 'root') return;
        const { sel: currentSel, groupSets: currentGroupSets, ns: currentNs } = treeState.current;
        const selSetFast = new Set(currentSel);
        const selectedIds = type === 'group' ? Array.from(currentGroupSets[dragId] || []) : (selSetFast.has(dragId) ? currentSel.filter(s => currentNs[s] !== undefined) : [dragId]);
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
      
      onDragOverRoot: () => {
          setDropTarget(null); 
      },

      onDragLeaveRow: () => {},

      onDragOverRow: (e: React.DragEvent, id: string, type: 'node'|'group') => { 
          e.preventDefault(); 
          e.stopPropagation(); 
          e.dataTransfer.dropEffect = 'move';
          
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          let pos: 'top'|'bottom'|'inside' = 'inside';

          if (type === 'node') {
              pos = y < rect.height / 2 ? 'top' : 'bottom';
          } else {
              if (y < rect.height * 0.25) pos = 'top';
              else if (y > rect.height * 0.75) pos = 'bottom';
              else pos = 'inside';
          }

          const { flatTree } = treeState.current;
          const targetItem = flatTree.find((i: any) => i.id === id);
          const maxDepth = targetItem ? targetItem.depth : 0;

          let targetDepth = maxDepth;
          if (pos !== 'inside') {
              const hoveredDepth = Math.max(1, Math.floor((x - 10) / 20));
              targetDepth = Math.min(maxDepth, hoveredDepth);
          } else {
              targetDepth = maxDepth + 1;
          }
          
          setDropTarget((prev:any) => {
              if (prev?.id === id && prev?.pos === pos && prev?.depth === targetDepth) return prev;
              return { id, pos, depth: targetDepth };
          });
      },

      onDrop: (e: React.DragEvent, targetId: string, targetType: 'node'|'group'|'root') => {
        e.preventDefault(); 
        e.stopPropagation();

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        let pos: 'top'|'bottom'|'inside' = 'inside';
        
        if (targetType === 'root') {
            pos = 'inside';
        } else if (targetType === 'node') {
            pos = y < rect.height / 2 ? 'top' : 'bottom';
        } else {
            if (y < rect.height * 0.25) pos = 'top';
            else if (y > rect.height * 0.75) pos = 'bottom';
            else pos = 'inside';
        }

        const { flatTree, groupToGroup, nodeToGroup } = treeState.current;
        const targetItem = flatTree.find((i: any) => i.id === targetId);
        const targetMaxDepth = targetItem ? targetItem.depth : 0;

        let targetDepth = targetMaxDepth;
        if (pos !== 'inside') {
            const hoveredDepth = Math.max(1, Math.floor((x - 10) / 20));
            targetDepth = Math.min(targetMaxDepth, hoveredDepth);
        } else {
            targetDepth = targetMaxDepth + 1;
        }

        const finalDepth = dropTarget?.depth !== undefined ? dropTarget.depth : targetDepth;
        setDropTarget(null);

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

          let insertGroup: string | null = null;
          if (pos === 'inside' && targetType === 'group') {
              insertGroup = targetId;
          } else if (pos === 'inside' && targetType === 'root') {
              insertGroup = null;
          } else {
              const chain = [];
              let curr = targetType === 'group' ? groupToGroup[targetId] : nodeToGroup[targetId];
              while (curr) {
                  chain.push(curr);
                  curr = groupToGroup[curr];
              }
              chain.reverse();
              if (finalDepth <= 1) {
                  insertGroup = null;
              } else {
                  insertGroup = chain[finalDepth - 2];
              }
          }

          let anchorId = targetId;
          if (pos !== 'inside' && insertGroup !== (targetType === 'group' ? groupToGroup[targetId] : nodeToGroup[targetId])) {
              let curr: string | undefined = targetType === 'group' ? targetId : nodeToGroup[targetId];
              while (curr && groupToGroup[curr] !== (insertGroup || undefined)) {
                  curr = groupToGroup[curr];
              }
              if (curr) anchorId = curr;
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

            if (insertGroup) {
                const arr = [...(next[insertGroup]?.nodes || [])];
                if (pos === 'inside' && targetId === insertGroup) {
                    arr.push(...nodesToMove);
                } else {
                    let targetIdx = -1;
                    if (prev[anchorId]) {
                        // Если anchorId - это группа, ищем индекс её первого дочернего узла в массиве
                        const targetNodes = prev[anchorId].nodes || [];
                        for (let i = 0; i < arr.length; i++) {
                            if (targetNodes.includes(arr[i])) { targetIdx = i; break; }
                        }
                    } else {
                        targetIdx = arr.indexOf(anchorId);
                    }
                    
                    if (targetIdx !== -1) {
                        arr.splice(pos === 'top' ? targetIdx : targetIdx + 1, 0, ...nodesToMove);
                    } else {
                        arr.push(...nodesToMove);
                    }
                }
                next[insertGroup] = { ...next[insertGroup], nodes: arr };
            } else if (!prev[anchorId]) {
                // Если мы бросаем на корень и якорь - это не группа (а обычный узел)
                if (dragType === 'node') {
                    nsUpdateParams = { target: anchorId, ids: nodesToMove, p: pos as any };
                }
            }

            // --- ПЕРЕСОРТИРОВКА ГРУПП ---
            if (dragType === 'group' && pos !== 'inside') {
                const keys = Object.keys(next).filter(k => k !== dragId);
                const targetIdx = keys.indexOf(anchorId);
                if (targetIdx !== -1) {
                    keys.splice(pos === 'top' ? targetIdx : targetIdx + 1, 0, dragId);
                } else {
                    keys.push(dragId);
                }
                // Пересобираем объект groups с новым порядком ключей
                const reordered: any = {};
                keys.forEach(k => { reordered[k] = next[k]; });
                next = reordered;
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
  },[mode, id, saveGraph, debouncedSearch, handleRenameGroup, handleRenameRoot, handleChangeGroupColor, handleUngroup, toggleGroup, handleTreeContextMenu, editingNodeId, dropTarget, getAllDescendantsHelper, getDescendantGroups]);

  const handleGlobalKeyDown = useCallback(async (e: React.KeyboardEvent) => {
    const { sel: currentSel, groups: currentGroups, groupSets: currentGroupSets, ns: currentNs, nodeToGroup: currentNodeToGroup, groupToGroup: currentGroupToGroup } = treeState.current;
    
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      e.stopPropagation();
      setIsSearchOpen(true);
      setTimeout(() => searchInputRef.current?.focus(), 50);
      return;
    }

    if (e.key === 'Escape') {
      if (editingNodeId) {
          setTimeout(() => setEditingNodeId(null), 150);
      }
      setAltPopup(null);
    }
    
    const target = e.target as HTMLElement;
    const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
    if (isTyping) return;

    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'x')) {
        if (currentSel.length > 0) {
            const toCopy: Record<string, string> = {};
            const nodesToCopy = new Set<string>();
            currentSel.forEach(id => {
                if (currentGroups[id]) {
                    currentGroupSets[id].forEach(n => nodesToCopy.add(n));
                } else if (currentNs[id]) {
                    nodesToCopy.add(id);
                }
            });
            nodesToCopy.forEach(id => { toCopy[id] = currentNs[id]; });
            await navigator.clipboard.writeText(JSON.stringify(toCopy));
            
            if (e.key.toLowerCase() === 'x') {
                const filtered = Object.keys(currentNs).filter((k:any) => !nodesToCopy.has(k)).reduce((obj:any,k) => { obj[k] = currentNs[k]; return obj; }, {});
                setNs(filtered);
                setGroups((prev: any) => {
                    const next = { ...prev };
                    Object.keys(next).forEach(g => {
                        next[g] = { ...next[g], nodes: next[g].nodes.filter((n: string) => !nodesToCopy.has(n)) };
                    });
                    return next;
                });
            }
            e.preventDefault();
            return;
        }
    }

    if (e.key==='Delete') {
      const selSetFast = new Set(currentSel);
      const filtered = Object.keys(currentNs).filter((k:any) => !selSetFast.has(k)).reduce((obj:any,k) => { obj[k] = currentNs[k]; return obj; }, {});
      setNs(filtered)
    }

    if ((e.key.toLowerCase() === 'a' || e.key.toLowerCase() === 'b') && currentSel.length > 0 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const targetId = currentSel[0];
        const isAbove = e.key.toLowerCase() === 'a';
        
        let pastedNodes: Record<string, string> | null = null;
        try {
            const text = await navigator.clipboard.readText();
            const parsed = JSON.parse(text);
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                if (Object.values(parsed).every(v => typeof v === 'string')) {
                    pastedNodes = parsed as Record<string, string>;
                }
            }
        } catch (err) {}

        if (pastedNodes && Object.keys(pastedNodes).length > 0) {
            const newIdsMap: Record<string, string> = {};
            const newNsAddition: Record<string, string> = {};
            const addedIds: string[] = [];

            for (const [oldId, content] of Object.entries(pastedNodes)) {
                let finalId = oldId;
                if (currentNs[oldId] !== undefined) {
                    finalId = ID.unique();
                    newIdsMap[oldId] = finalId;
                }
                addedIds.push(finalId);
                newNsAddition[finalId] = content;
            }

            for (const [id, content] of Object.entries(newNsAddition)) {
                let newContent = content;
                for (const [oldId, newId] of Object.entries(newIdsMap)) {
                    const regex = new RegExp(`<id=${oldId}>`, 'g');
                    newContent = newContent.replace(regex, `<id=${newId}>`);
                }
                newNsAddition[id] = newContent;
            }

            const targetType = currentGroups[targetId] ? 'group' : 'node';
            const targetGroup = targetType === 'group' ? targetId : currentNodeToGroup[targetId];

            const afterAdd = () => {
                setSel(addedIds);
            };

            if (targetType === 'group') {
                setGroups((prev: any) => {
                    const next = {...prev};
                    let curr: string | undefined = targetId;
                    let first = true;
                    while (curr && next[curr]) {
                        const nodes = [...(next[curr].nodes || [])];
                        if (first) {
                            next[curr] = {...next[curr], nodes: isAbove ? [...addedIds, ...nodes] : [...nodes, ...addedIds]};
                            first = false;
                        } else {
                            nodes.push(...addedIds);
                            next[curr] = {...next[curr], nodes};
                        }
                        curr = currentGroupToGroup[curr];
                    }
                    return next;
                });
                setNs((prev: any) => ({...prev, ...newNsAddition}));
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
                                nodes.splice(isAbove ? idx : idx + 1, 0, ...addedIds);
                            } else {
                                nodes.push(...addedIds);
                            }
                            next[curr] = {...next[curr], nodes};
                            first = false;
                        } else {
                            nodes.push(...addedIds);
                            next[curr] = {...next[curr], nodes};
                        }
                        curr = currentGroupToGroup[curr];
                    }
                    return next;
                });
                setNs((prev: any) => ({...prev, ...newNsAddition}));
                afterAdd();
            } else {
                setNs((prev: any) => {
                    const next: any = {};
                    let added = false;
                    for (const key of Object.keys(prev)) {
                        if (key === targetId && isAbove) { 
                            Object.assign(next, newNsAddition); 
                            added = true; 
                        }
                        next[key] = prev[key];
                        if (key === targetId && !isAbove) { 
                            Object.assign(next, newNsAddition); 
                            added = true; 
                        }
                    }
                    if (!added) Object.assign(next, newNsAddition);
                    return next;
                });
                afterAdd();
            }
        } else {
            const newId = `id_${Date.now()}`;
            const targetType = currentGroups[targetId] ? 'group' : 'node';
            const targetGroup = targetType === 'group' ? targetId : currentNodeToGroup[targetId];

            const afterAdd = () => {
                setEditingNodeId(newId);
                setSel([newId]);
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
                        curr = currentGroupToGroup[curr];
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
                        curr = currentGroupToGroup[curr];
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
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
      e.preventDefault();
      if (e.shiftKey) {
        const selectedSet = new Set(currentSel);
        let groupToUngroup: string | null = null;
        for (const gName of Object.keys(currentGroups)) {
          const allDescendants = getAllDescendantsHelper(gName);
          if (allDescendants.length > 0 && allDescendants.every(id => selectedSet.has(id))) {
            groupToUngroup = gName; break;
          }
        }
        
        if (groupToUngroup) {
          setGroups((prev: any) => {
            const next = { ...prev };
            const parentGroup = currentGroupToGroup[groupToUngroup!];
            const descendants = next[groupToUngroup!]?.nodes ||[];
            
            if (parentGroup && next[parentGroup]) {
              next[parentGroup] = { ...next[parentGroup], nodes:[...new Set([...next[parentGroup].nodes, ...descendants])] };
            }
            delete next[groupToUngroup!];
            return next;
          });
        }
      } else {
        if (currentSel.length > 0 && flowRef.current) flowRef.current.triggerShortcutMenu();
      }
    }
  },[setGroups, setNs, getAllDescendantsHelper]);

  const headerRef=useRef(null) as any;

  const Editor = (
  <Tabs.Root
    css={graphCSS}
    value={mode}
    variant="plain"
    className={'graphTabs'}
    onKeyDown={handleGlobalKeyDown}
    tabIndex={0}
    style={{outline:'none'}}
    >
    <Box display="flex" flexDirection="column" h="100%" w="100%" pt="10px">
      {/* 1. Header вынесен наружу, чтобы он не перерендеривался при смене вкладок */}
      <Header ref={headerRef}/>
      <Separator/>

      {isSearchOpen && (
        <Box p="8px" bg="color-mix(in srgb, #445 40%, transparent)" borderBottom="1px solid color-mix(in srgb, #666 60%, transparent)">
          <input
            ref={searchInputRef}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Поиск по графу (Esc для выхода)..."
            style={{ width: '100%', background: 'rgba(0,0,0,0.3)', color: 'white', padding: '4px 8px', border: '1px solid gray', borderRadius: '3px', outline: 0, fontSize: '12px' }}
            onKeyDown={(e) => {
                if (e.key === 'Escape') {
                    e.stopPropagation();
                    setIsSearchOpen(false);
                    setSearchInput("");
                    setDebouncedSearch("");
                }
            }}
          />
        </Box>
      )}

      {/* 2. Вкладки управляются через display: flex / none */}
      
      {/* Вкладка: Граф/Дерево */}
      <Box display={mode === 'eg' ? 'flex' : 'none'} flex={1} overflow="hidden" position="relative">
        <HStack className='GraphmodeSides' ref={graphSidesRef} h={'100%'} w="100%" gap={0}>
          <Box w={'100%'} h="100%" display="flex" flexDirection="column">
            <TreeView 
              ref={treeRef}
              flatTree={flatTree}
              sel={sel} 
              ns={ns} 
              groups={groups} 
              actions={treeActions} 
              hoveredNodeId={hoveredNodeId}
              graphName={curName['0']}
            />
          </Box>
        </HStack>
      </Box>

      {/* Вкладка: Текстовый режим (опционально) */}
      <Box display={mode === 'tr' ? 'flex' : 'none'} flex={1} overflow="hidden" position="relative">
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
      </Box>

      {/* Вкладка: Feed (Тренировка) */}
      <Box display={mode === 'repeat' ? 'flex' : 'none'} flex={1} overflow="hidden" position="relative">
        <Feed
          initialSelection={feedSelection}
          autoStart={feedAutoStart}
          setMode={setMode}
          onActiveCardChange={setFeedActiveCard}
        />
      </Box>

    </Box>

    {/* ChatNN вынесен глобально и всегда доступен */}
    <ChatNN currentCardId={mode === 'repeat' ? feedActiveCard : sel[0]} ns={ns} />

    <Box position="absolute" zIndex={9999}>
      <ContextMenu {...menuProps} items={menuItems} />
    </Box>
    {altPopup && (
      <MiniGraphPopup
        id={altPopup.id}
        type={altPopup.type}
        targetNodes={altPopup.targetNodes}
        targetGroups={altPopup.targetGroups}
        x={altPopup.x} y={altPopup.y}
        ns={ns}
        groups={groups}
        onClose={() => setAltPopup(null)}
        onDelete={() => {
            if (altPopup.type === 'group') {
                const descendants = getAllDescendantsHelper(altPopup.id);
                const toDelete = new Set([altPopup.id, ...descendants]);
                const filteredNs = Object.keys(latestNs.current).filter(k => !toDelete.has(k)).reduce((obj:any,k) => { obj[k] = latestNs.current[k]; return obj; }, {});
                setNs(filteredNs);
                setGroups((prev: any) => {
                    const next = { ...prev };
                    toDelete.forEach(g => delete next[g]);
                    return next;
                });
            } else if (altPopup.type === 'node') {
                const filteredNs = Object.keys(latestNs.current).filter(k => k !== altPopup.id).reduce((obj:any,k) => { obj[k] = latestNs.current[k]; return obj; }, {});
                setNs(filteredNs);
                setGroups((prev: any) => {
                    const next = { ...prev };
                    Object.keys(next).forEach(g => {
                        next[g] = { ...next[g], nodes: next[g].nodes.filter((n: string) => n !== altPopup.id) };
                    });
                    return next;
                });
            }
            setSel(prev => prev.filter(s => s !== altPopup.id));
            setAltPopup(null);
        }}
        onRepeat={() => {
            console.log("Repeat clicked for", altPopup.id);
        }}
      />
    )}
  </Tabs.Root>)

  useImperativeHandle(ref,()=>({
    select: (ids:any)=>{ setSel(ids); },
    selected:()=>{ return sel; },
    unselectGroupStack:()=>{} 
  }))

  return <div css={graphCSS}>{Editor}</div>
});