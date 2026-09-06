import { forwardRef, memo, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useGraphCtx } from "../../App";
import { calcG, transformToOldGroups } from "../card/utility";
import { Box, Button, HStack, IconButton, Spacer, Text } from "@chakra-ui/react";
import Graphology from "graphology";
import Sigma from "sigma";
import { MdClose, MdDelete } from "react-icons/md";
import { createPortal } from "react-dom";
import { getCardState } from "./feed/feed";
import { SIDE_SPLIT_SYM } from "../card/utility";
import { drawRoundRect, rgba2hex } from "./utility";

const ResizeHandle = ({ cursor, top, left, right, bottom, w, h, onDown }: any) => (
  <Box
    position="absolute"
    top={top} left={left} right={right} bottom={bottom}
    w={w} h={h}
    cursor={cursor}
    onPointerDown={onDown}
    zIndex={100}
  />
);

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
			graphRef.current.forEachEdge((_edge, _attrs, _source, _target, sourceAttrs, targetAttrs) => {
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


export const Minigraph = memo(({
	id, type,
	targetNodes, targetGroups,
	x, y,
	ns, flatTree, groups,
	onClose, onDelete, onRepeat
}: any) => {
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
		const reconstructedGroups = transformToOldGroups(flatTree);
        const [rNs, rEs] = calcG(mNs, reconstructedGroups, {x:1, y:1});

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