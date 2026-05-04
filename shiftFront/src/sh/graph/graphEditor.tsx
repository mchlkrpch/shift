/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import '@xyflow/react/dist/style.css';

import {
  getSmoothStepPath,
  // getStraightPath,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useReactFlow,
} from '@xyflow/react'
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react'
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
import { calcG, calculateHierarchy, OPTION_SPLIT_SYM, Sh, SIDE_SPLIT_SYM, topSort } from '../card/utility';
import { Card, CardCtx, dropMenuCSS } from '../card/card';
import { FaParagraph } from "react-icons/fa6";
import { BsDiagram2Fill } from "react-icons/bs";
import { APPWRITE_CONFIG, gReq, spaced_account } from "../../appwrite/service";
import { Panel } from '@xyflow/react';
import { MdFilterCenterFocus } from "react-icons/md";
import { Clip } from "../clip";
import {
  FaShare,
} from "react-icons/fa";
import { PiExport } from "react-icons/pi";
import { RiSaveFill } from "react-icons/ri";
import { RiRepeat2Line } from "react-icons/ri";
// import { Feed } from "./feed";
// import { LuChevronDown, LuChevronRight } from "react-icons/lu";
// import { createPortal } from "react-dom";

// -----------------------------------------------------------------
// ОБНОВЛЕННЫЙ ИМПОРТ: забираем getCardState из Feed
// -----------------------------------------------------------------
import { Feed, getCardState } from "./feed"; 
import { LuChevronDown, LuChevronRight } from "react-icons/lu";
import { createPortal } from "react-dom";

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

//////////////////////////////////////////////////////
// graph headertabs
//////////////////////////////////////////////////////

.headerTabs {
  display: flex;
  flex-direction: row;
  width: 100%;
  align-items: center;
  gap: 8px;
}

.graphTabs {
  width: 100%;
  display: flex
  flex-direction:column;
  gap:0;
  min-height:0;
  flex:1;
  
  // update
  margin: 0px 10px 20px 10px;
  border-radius: 10px;
  background-color: color-mix(in srgb, #556 20%, transparent);
  overflow: hidden;
  border: 1.2px solid color-mix(in srgb, #666 14%, transparent);
}

.tabsTrigger {
  display: flex;
  border-radius: 2px;
  height: 20px;
  padding: 2px 5px;
  gap: 2px;
  min-width: fit-content;
  align-content: center;
  justify-content: center;
  border: 1.2px solid transparent;
}


// for selected mode(graph/text) in header
[aria-selected="true"] {
  background-color: color-mix(in srgb, #556 40%, transparent);
  border-radius: 5px;
  border: 1.2px solid color-mix(in srgb, #666 20%, transparent);
}


//////////////////////////////////////////////////////
// Graph root with editor stack
//////////////////////////////////////////////////////


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
  flex: 1;
  min-height:0;
  align-items: stretch;

  overflow-y: auto;
  overflow-x: auto;
  scrollbar-width: none;
  // padding: 0px 10px;

  gap: 0px;
  min-width: 50%;
  max-width: 50%;
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
  overflow-x: auto;
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

//////////////////////////////////////////////////////
// reactflow Flow of graph
//////////////////////////////////////////////////////

.graphFrame {
  flex: 1;
  position: relative;
  min-height: 500px;
  overflow: hidden;
  // background-color: color-mix(in srgb, #666 10%, transparent);
}

.defNode {
  // background-color: black;
}
`;



function getContent(data:any) {
  return data.forward.map((f_s:string,i:number)=>(
    f_s
    + `\n${SIDE_SPLIT_SYM}\n`
    + data.backward[i]
  )).join(`\n${OPTION_SPLIT_SYM}\n`)
}






////////////////////////////////////////////////////////////////////////////////////////////////
// ReactFlow part
////////////////////////////////////////////////////////////////////////////////////////////////

const Colored=({content}:any)=>{
  const {colorMode} = useColorMode();
  if (colorMode==='light') {
    return <LightMode>{content}</LightMode>;
  }
  return <DarkMode>{content}</DarkMode>;
}

// export const SpDef=({data}:any)=>{
//   return (
//     <Colored content={(
//       <Box className='defNode'>
//         <Handle
//           type='target'
//           position={Position.Top}
//           style={{ top:'100%', left: '50%', opacity: '0%' }}
//           isConnectable={false}
//         />
//         <Handle
//           type="source"
//           style={{ top: '100%', left: '50%', opacity: '0%' }}
//           position={Position.Top}
//           isConnectable={false}
//         />
//         <CardRoot
//           // className={`SpDef-frame feed-block-${data.tp}`}
//           borderRadius={'5px'}
//           bg={'color-mix(in srgb, black 90%, transparent)'}
//           w={'fit-content'}
//           maxW={'250px'}
//           minH={'30px'}
//           // zIndex={'9999'}
//           >
//           <Sh value={data.forward[0]} isInner={true}/>
//         </CardRoot>
//       </Box>
//     )}/>
//   )
// };


// export const SpDef = ({ data }: any) => {
//   const dummyCardCtx = useMemo(() => ({
//     path: [data.id],
//     setPath: () =>[],
//     c: data.forward && data.forward.length > 0 ? data.forward[0] : '',
//     setC: () => {},
//   }), [data]);
//   return (
//     <Colored content={(
//       <Box className='defNode'>
//         <Handle
//           type='target'
//           position={Position.Top}
//           style={{ top:'100%', left: '50%', opacity: '0%' }}
//           isConnectable={false}
//         />
//         <Handle
//           type="source"
//           style={{ top: '100%', left: '50%', opacity: '0%' }}
//           position={Position.Top}
//           isConnectable={false}
//         />
//         <CardRoot
//           borderRadius={'5px'}
//           bg={'color-mix(in srgb, black 50%, transparent)'}
//           backdropFilter={'saturate(200%) blur(10px);'}
//           w={'fit-content'}
//           border={0}
//           maxW={'250px'}
//           minH={'30px'}
//           >
//           {/* Оборачиваем Sh в наш фейковый провайдер */}
//           <CardCtx.Provider value={dummyCardCtx}>
//             <Sh value={data.forward[0]} isInner={true}/>
//           </CardCtx.Provider>
//         </CardRoot>
//       </Box>
//     )}/>
//   )
// };

export const SpDef = ({ data }: any) => {
  const gCtx = useGraphCtx() as any;
  const dummyCardCtx = useMemo(() => ({
    path:[data.id],
    setPath: () =>[],
    c: data.forward && data.forward.length > 0 ? data.forward[0] : '',
    setC: () => {},
  }),[data]);
  const ns = gCtx?.ns || {};
  const repeats = gCtx?.repeats || {};
  const status = getCardState(data.id, ns, repeats);
  let dotColor = "gray.500";
  let statusText = "";
  if (!status.isLocked) {
      if (status.isNew) { dotColor = "#3182ce"; statusText = "New"; }
      else if (status.isDue) { dotColor = "#e53e3e"; statusText = "Due"; }
      else if (status.isLearned) { dotColor = "#38a169"; statusText = "Done"; }
  }
  return (
    <Colored content={(
      <Box 
        className='defNode' 
        position="relative" 
        opacity={status.isLocked ? 0.35 : 1} 
        filter={status.isLocked ? 'grayscale(80%) blur(0.5px)' : 'none'}
        transition="all 0.3s ease"
      >
        <Handle
          type='target'
          position={Position.Top}
          style={{ top:'100%', left: '50%', opacity: '0%' }}
          isConnectable={false}
        />
        <Handle
          type="source"
          style={{ top: '100%', left: '50%', opacity: '0%' }}
          position={Position.Top}
          isConnectable={false}
        />
        <CardRoot
          borderRadius={'5px'}
          bg={'color-mix(in srgb, black 50%, transparent)'}
          backdropFilter={'saturate(200%) blur(10px);'}
          w={'fit-content'}
          border={0}
          maxW={'250px'}
          minH={'30px'}
          >
          <CardCtx.Provider value={dummyCardCtx}>
            <Sh value={data.forward[0]} isInner={true}/>
          </CardCtx.Provider>
        </CardRoot>
        {!status.isLocked&&(
          <Box 
            position="absolute" 
            top="-10px" right="-10px" 
            bg="color-mix(in srgb, black 85%, transparent)" 
            backdropFilter="blur(5px)"
            px="6px" py="3px" borderRadius="6px" fontSize="10px" 
            color="white" fontWeight="bold"
            display="flex" alignItems="center" gap="5px" 
            zIndex={10} 
            border="1px solid rgba(255,255,255,0.1)"
          >
            <Box w="6px" h="6px" borderRadius="50%" bg={dotColor} />
            Lvl {status.level} • {statusText}
          </Box>
        )}
      </Box>
    )}/>
  )
};

export const TempDef = ({data, id}: any) => {
  const extendedGCtx = {
    ...data.gCtx, 
    ns: { 
      ...(data.gCtx?.ns || {}), 
      [id]: data.content        
    },
    setNs: (newNsOrCb: any) => {
      const currentNs = { ...(data.gCtx?.ns || {}),[id]: data.content };
      const newNs = typeof newNsOrCb === 'function' ? newNsOrCb(currentNs) : newNsOrCb;
      // 1. Сохраняем текст самой TempDef (пока пользователь еще пишет)
      if (newNs[id] !== undefined) {
        data.setContent(newNs[id]);
      }
      // 2. Самое важное: отправляем ОСТАЛЬНЫЕ новые карточки (через ~~~) в глобальный граф!
      if (data.gCtx && data.gCtx.setNs) {
        // Деструктуризируем: достаем временный id, а все остальные карточки кладем в restCards
        const { [id]: tempCardContent, ...restCards } = newNs;
        // Отправляем остаток (который содержит все прошлые узлы + новые из ~~~) в реальный граф
        data.gCtx.setNs(restCards);
      }
    },
  };

  return (
    <Colored content={(
      <Box 
        className='defNode'
        onClick={(e)=>e.stopPropagation()} 
        onDoubleClick={(e)=>e.stopPropagation()}
      >
      <CardRoot
        className={`SpDef-frame feed-block-Def`}
        borderRadius={'5px'}
        w={'350px'}
        minH={'30px'}
        boxShadow={'0px 0px 20px rgba(0, 0, 0, 0.4)'}
      >
        <GraphCtx.Provider value={extendedGCtx}>
          <Card 
            id={id} 
            content={data.content}
            focus
            options={{twoSides:false, stats:false}} 
          />
        </GraphCtx.Provider>
      </CardRoot>
    </Box>
    )}/>
  )
};


export const SpGroup = ({data}: any) => {
  const isHex = data.color.startsWith('#');
  const bg = isHex ? `${data.color}26` : data.color;
  const border = isHex ? `0px solid ${data.color}99` : `2px solid ${data.color.replace('0.1','0.6')}`;
  return (
    <Box
      w="100%"
      h="100%"
      bg={bg}
      // border={border}
      borderRadius="2px"
      position="relative"
      pointerEvents="none" >
      <Box 
        position="absolute"
        top="-24px" left="10px" 
        fontSize="14px"
        fontWeight="bold"
        color="gray.400"
        maxWidth="calc(100% - 20px)"
        whiteSpace="nowrap"
        overflow="hidden"
        textOverflow="ellipsis"
        zIndex={'-999'}
      >
        {data.label}
      </Box>
    </Box>
  );
};

// export const SpGroup = ({data}: any) => {
//   const zoom = useStore((s: any) => s.transform[2]);
//   const inverseZoom = 1 / (zoom || 1);
//   const isHex = data.color.startsWith('#');
//   const bg = isHex ? `${data.color}26` : data.color;
//   const border = isHex ? `2px solid ${data.color}99` : `2px solid ${data.color.replace('0.1','0.6')}`;
//   const baseFontSize = 12;
//   const baseTopOffset = 28;
//   const baseLeftOffset = 10;
//   const fontSize = baseFontSize * inverseZoom;
//   const topOffset = (baseTopOffset-baseFontSize) * inverseZoom;
//   const leftOffset = baseLeftOffset * inverseZoom;
//   return (
//     <Box w="100%" h="100%" bg={bg} border={border} borderRadius="12px" position="relative" pointerEvents="none" >
//       <Box 
//         position="absolute" 
//         top={`-${topOffset}px`} 
//         left={`${leftOffset}px`} 
//         fontSize={`${fontSize}px`} 
//         lineHeight={1}
//         fontWeight="semi-bold" 
//         color="gray.400"
//         maxWidth={`calc(100% - ${leftOffset * 2}px)`} 
//         whiteSpace="nowrap" 
//         overflow="hidden" 
//         textOverflow="ellipsis"
//       >
//         {data.label}
//       </Box>
//     </Box>
//   );
// };


export function SpEdge({
  id,
  sourceX,sourceY,
  targetX,targetY,
  sourcePosition,targetPosition,
  markerEnd,selected,borderRadius = 1,
}: any) {
  const [edgePath] = getSmoothStepPath({
    sourceX, sourceY,
    sourcePosition,
    targetX, targetY,
    targetPosition, borderRadius,
  });
  return (
    <>
      <path
        id={id}
        fill="none"
        stroke="color-mix(in srgb, white 10%, transparent)"
        d={edgePath}
        strokeWidth={3}
        markerEnd={markerEnd}
        z={'-1'}
      />
      <path
        d={edgePath}
        z={'-1'}
        fill="transparent"
        stroke="transparent"
        strokeWidth={18}
      />
    </>
  );
}


const nodeTypes = {SpDef:SpDef, TempDef:TempDef, SpGroup:SpGroup}
const edgeTypes = {SpEdge: SpEdge}


const GraphTreeNode = ({ itemId, ns, depth, orderedIds, onDragStart, onDragOver, onDropOnNode }: any) => {
  if (!orderedIds.includes(itemId)) return null;
  return (
    <Box ml={`${depth * 10}px`}
      minW={0} flexShrink={0}
      draggable
      onDragStart={(e) => onDragStart(e, itemId, 'node')}
      onDragOver={onDragOver} onDrop={(e) => onDropOnNode(e, itemId)}
    >
      <Card
        id={itemId}content={ns[itemId]}
        options={{stats:false,twoSides:false,padding:'0px'}}
        />
    </Box>
  );
};

const GraphTreeGroup = ({ itemId, depth, groups, groupToGroup, nodeToGroup, ns, orderedIds, prevSelectCb, handleRenameGroup, handleChangeGroupColor, handleUngroup, onDragStart, onDragOver, onDropOnGroup, onDropOnNode }: any) => {
  const gData = groups[itemId];
  const childGroups = Object.keys(groups).filter(g => groupToGroup[g] === itemId);
  const childNodes = gData.nodes.filter((n: string) => nodeToGroup[n] === itemId);
  const[groupHide, setGroupHide] = useState(false);
  const [groupSelect, setGroupSelect] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const[editName, setEditName] = useState(itemId);

  const [contextMenu, setContextMenu] = useState<{x:number, y:number}|null>(null);
  const hexColor = gData.color.startsWith('#') ? gData.color : '#555555';
  const [localColor, setLocalColor] = useState(hexColor);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (localColor !== hexColor) {
        handleChangeGroupColor(itemId, localColor);
      }
    }, 200);
    return () => clearTimeout(handler);
  },[localColor, hexColor, itemId, handleChangeGroupColor]);

  useEffect(() => {
    if (!contextMenu) return;
    const hideMenu = () => setContextMenu(null);
    window.addEventListener('click', hideMenu);
    return () => window.removeEventListener('click', hideMenu);
  }, [contextMenu]);

  const onRenameSubmit = () => {
    setIsEditing(false);
    if (!editName || editName === itemId || groups[editName]) {
      setEditName(itemId);
      return;
    }
    handleRenameGroup(itemId, editName);
  };
  return (
    <Box 
      flexShrink={0}
      m={0} ml={`${depth * 10}px`} overflow={'hidden'}
      bg={groupSelect ? `${hexColor}14` : 'transparent'}
      draggable
      onDragStart={(e) => onDragStart(e, itemId, 'group')}
      onDragOver={onDragOver}
      onDrop={(e) => onDropOnGroup(e, itemId)}
      onClick={(e) => {
        e.stopPropagation();
        if (prevSelectCb.current && prevSelectCb.current !== setGroupSelect) {
          prevSelectCb.current(false);
        }
        setGroupSelect(true);
        prevSelectCb.current = setGroupSelect;
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <Box
        fontSize="11px" fontWeight="bold" p={'4px'} w={'100%'} bg={groupSelect ? `${hexColor}33` : 'transparent'} display={'flex'} flexDirection={'row'} alignItems="center" gap={2}>
        <IconButton variant={'plain'} h={'20px'} w={'20px'} minW={'20px'} p={0} onClick={(e: any) => { setGroupHide(!groupHide); e.stopPropagation(); }}>
          {groupHide ? <LuChevronRight className={'smIcon'} /> : <LuChevronDown className={'smIcon'} />}
        </IconButton>

        {isEditing ? (
          <input 
            autoFocus value={editName} onChange={e => setEditName(e.target.value)}
            onBlur={onRenameSubmit} onClick={e => e.stopPropagation()}
            onKeyDown={e => {
              e.stopPropagation();
              if (e.key === 'Enter') onRenameSubmit();
              if (e.key === 'Escape') { setIsEditing(false); setEditName(itemId); }
            }}
            style={{ flex: 1, background: 'rgba(0,0,0,0.3)', color: 'white', outline: 'none', border: '1px solid gray', borderRadius: '3px', padding: '0 4px' }}
          />
        ) : (
          <Box flex={1} onDoubleClick={() => setIsEditing(true)} cursor="text">
            {itemId}
          </Box>
        )}
        <Box
          // @ts-ignore
          as="input" type="color" value={hexColor} 
          onChange={(e:any)=>{
            e.stopPropagation();
            setLocalColor(e.target.value);
          }}
          onClick={(e:any)=>{
            e.stopPropagation()
            console.log('e.target.value',e.target.value)
          }}
          style={{ width: '16px', height: '16px', padding: 0, border: 'none', background: 'none', cursor: 'pointer', borderRadius: '50%' }}
        />
      </Box>
      {contextMenu&&(
        <Box 
          position="fixed" top={contextMenu.y} left={contextMenu.x} zIndex={9999} 
          bg="color-mix(in srgb, #445 90%, transparent)" p="4px" borderRadius="8px" boxShadow="dark-lg" minW="150px"
          onClick={(e) => e.stopPropagation()}
        >
          <VStack align="stretch" gap={1}>
            <Button size="sm" variant="ghost" colorScheme="red" onClick={() => { handleUngroup(itemId); setContextMenu(null); }}>
              Разгруппировать
            </Button>
          </VStack>
        </Box>
      )}

      {!groupHide && (
        <>
          {childGroups.map((cg: any) => <GraphTreeGroup key={cg} itemId={cg} depth={depth + 1} groups={groups} groupToGroup={groupToGroup} nodeToGroup={nodeToGroup} ns={ns} orderedIds={orderedIds} prevSelectCb={prevSelectCb} handleRenameGroup={handleRenameGroup} handleChangeGroupColor={handleChangeGroupColor} />)}
          {childNodes.map((cn: any) => <GraphTreeNode key={cn} itemId={cn} depth={depth + 1} ns={ns} orderedIds={orderedIds} />)}
        </>
      )}
    </Box>
  );
};

const TextTreeNode = ({ itemId, ns, depth, orderedIds, handleMoveCard }: any) => {
  if (!orderedIds.includes(itemId)) return null;
  return (
    <Box ml={`${depth * 15}px`} w={`calc(100% - ${depth * 15}px)`}>
      <Card
        id={itemId}content={ns[itemId]}
        options={{ stats: false, twoSides: true, onMove: (dir: number) => handleMoveCard(itemId, dir as -1|1)}} />
    </Box>
  );
};

const TextTreeGroup = ({ itemId, depth, groups, groupToGroup, nodeToGroup, ns, orderedIds, handleMoveCard }: any) => {
  const gData = groups[itemId];
  const childGroups = Object.keys(groups).filter(g => groupToGroup[g] === itemId);
  const childNodes = gData.nodes.filter((n: string) => nodeToGroup[n] === itemId);
  const hexColor = gData.color.startsWith('#') ? gData.color : '#555555';

  return (
    <Box ml={`${depth * 10}px`} w={`calc(100% - ${depth * 10}px)`} bg={`${hexColor}1A`} p="10px" my="10px" borderRadius="10px" border={`1px solid ${hexColor}4D`}>
      <Box fontSize="14px" fontWeight="bold" mb={3}>{itemId}</Box>
      {childGroups.map((cg: any) => <TextTreeGroup key={cg} itemId={cg} depth={depth + 1} groups={groups} groupToGroup={groupToGroup} nodeToGroup={nodeToGroup} ns={ns} orderedIds={orderedIds} handleMoveCard={handleMoveCard} />)}
      {childNodes.map((cn: any) => <TextTreeNode key={cn} itemId={cn} depth={depth + 1} ns={ns} orderedIds={orderedIds} handleMoveCard={handleMoveCard} />)}
    </Box>
  );
};


// to user useReactFlow() inside
const Flow=React.forwardRef((props:any,ref:any)=>{
  const gCtx=useGraphCtx()as any;
  const{ns,setNs,gRef,groups,setGroups}=gCtx;
  const [reactflowNs,reactflowEs] = useMemo(()=>calcG(ns, groups), [ns, groups]);
  // const [reactflowNs,reactflowEs] = calcG(ns); // calculates dagre graph with connections between cards
  
  const flowRef = useRef(null) as any;
  const selectedNodesIds = useRef(new Set());
  const curSelected = useRef(new Set());
  
  const [menu,setMenu] = useState<{isOpen:boolean,x:number,y:number,mode:any,name:string,idx:number}>({
    isOpen:false,x:0,y:0,mode:'idle',name:'',idx:0});
  const onContextMenu = useCallback((e:React.MouseEvent) => {
    e.preventDefault();
    if (curSelected.current.size > 0) {
      setMenu({isOpen:true,x:e.clientX, y:e.clientY, mode:'idle', name:'',idx:0});
    }
  },[]);

  const[tempNode, setTempNode] = useState<any>(null);
  const tempContentRef = useRef('');
  const[nodeToZoomId, setNodeToZoomId] = useState<string|null>(null);

  const {
    setViewport,getViewport,
    getZoom,fitView,
    screenToFlowPosition,
    setCenter,getNodes,
  }=useReactFlow();

  const handleCreateGroup = (name: string, ids: string[]) => {
    const r = Math.floor(Math.random() * 150 + 50);
    const g = Math.floor(Math.random() * 150 + 50);
    const b = Math.floor(Math.random() * 150 + 50);
    const color = `rgba(${r},${g},${b},0.15)`;
    setGroups((prev:any) => ({...prev, [name]: {color, nodes:ids}}));
  };

  const [exportMenuOpen, setExportMenuOpen] = useState(false);
const [exportName, setExportName] = useState('graph');

const handleExport = useCallback(async (format: 'png' | 'svg') => {
    try {
      const { toPng, toSvg } = await import('html-to-image');
      const el = document.querySelector('.react-flow') as HTMLElement;
      if (!el) return;
      const filter = (node: HTMLElement) => {
        if (node?.classList?.contains('react-flow__panel')) {
          return false;
        }
        return true;
      };
      const options = { filter, backgroundColor: '#1e1e1e' };
      const dataUrl = format === 'png' 
        ? await toPng(el, options) 
        : await toSvg(el, options);
      const a = document.createElement('a');
      a.setAttribute('download', `${exportName || 'graph'}.${format}`);
      a.setAttribute('href', dataUrl);
      a.click();
      setExportMenuOpen(false);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Ошибка экспорта. Убедитесь, что установлена библиотека: npm install html-to-image');
    }
  }, [exportName]);

  const handleAddNodesToGroup = (targetGroupName: string) => {
    const nodesToAdd = Array.from(curSelected.current as any) as string[];
    setGroups((prev: any) => {
      const updated = { ...prev };
      Object.keys(updated).forEach(g => {
        updated[g] = { ...updated[g], nodes: updated[g].nodes.filter(n => !nodesToAdd.includes(n)) };
      });
      updated[targetGroupName] = {
        ...updated[targetGroupName],
        nodes: [...new Set([...updated[targetGroupName].nodes, ...nodesToAdd])]
      };
      return updated;
    });
    setMenu({isOpen:false, x:0, y:0, mode:'idle', name:'', idx:0});
  };

  const handleWheel=useCallback((event:any) => {
    if (event.ctrlKey) {
      const zoomSensitivity = 0.005;
      const currentZoom = getZoom();
      const currentViewport = getViewport();
      const zoomDelta = -event.deltaY * zoomSensitivity;
      const newZoom = Math.max(0.1, Math.min(4, currentZoom * (1 + zoomDelta)));
      // cursor position accoring to Flow
      const reactFlowBounds = flowRef.current.getBoundingClientRect();
      const cursorScreenX = event.clientX - reactFlowBounds.left;
      const cursorScreenY = event.clientY - reactFlowBounds.top;
      // convert screen coords to graph coords
      const graphX = (cursorScreenX - currentViewport.x) / currentZoom;
      const graphY = (cursorScreenY - currentViewport.y) / currentZoom;
      const newViewportX = cursorScreenX - graphX * newZoom;
      const newViewportY = cursorScreenY - graphY * newZoom;
      setViewport({ x: newViewportX, y: newViewportY, zoom: newZoom });
    }
  }, [getZoom, getViewport, setViewport]);

  const onSelectionEnd=()=>{
    const finalSelectionArray = Array.from(selectedNodesIds.current);
    gRef.current.select(finalSelectionArray);
    curSelected.current = selectedNodesIds.current;
    selectedNodesIds.current=new Set()
  };

  const onNodesChange = (changes: any) => {
    changes = changes.filter((ch: any) => ch.type !== 'position');
    for (const ch of changes) {
      if (ch.type === 'select') {
        if (ch.selected === true) {
          selectedNodesIds.current.add(ch.id);
        } else {
          selectedNodesIds.current.delete(ch.id);
        }
      }
    }
  };

  useEffect(() => {
    if (nodeToZoomId) {
      const timer = setTimeout(() => {
        const nodes = getNodes();
        const targetNode = nodes.find((n:any)=>n.id === nodeToZoomId);
        if (targetNode && targetNode.position) {
          const width = targetNode.measured?.width ?? 250;
          const height = targetNode.measured?.height ?? 100;
          const x = targetNode.position.x + width / 2 - 150;
          const y = targetNode.position.y + height / 2;
          setCenter(x, y, { zoom: 1.5, duration: 800 });
          setNodeToZoomId(null);
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  },[reactflowNs, nodeToZoomId, getNodes, setCenter]);


  const displayNodes = useMemo(() => {
    if (tempNode) {
      const tNode = {
        id: tempNode.id,
        position: tempNode.position,
        type: 'TempDef',
        draggable: true,
        data: {
          content: tempNode.content,
          setContent: (val: string) => {
            tempContentRef.current = val;
            setTempNode((prev: any) => ({ ...prev, content: val }));
          },
          gCtx,
        }
      };
      return [...reactflowNs, tNode];
    }
    return reactflowNs;
  }, [reactflowNs, tempNode, gCtx, ns]);


  const handleWrapperDoubleClick = useCallback((e: React.MouseEvent)=>{
    const target = e.target as HTMLElement;
    e.stopPropagation();
    e.preventDefault();
    if (target.classList.contains('react-flow__pane')) {
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const newId = `id_${Date.now()}`;
      tempContentRef.current = '';
      setTempNode({
        id: newId,
        position,
        content: ''
      });
    }
  }, [screenToFlowPosition]);


  const onPaneClick = useCallback(() => {
    if (gRef&&gRef.current) {
      gRef.current.unselectGroupStack();
    }

    if (tempNode) {
      const finalContent = tempContentRef.current;
      if (finalContent.trim() !== '') {
        setNs((prev: any) => ({
          ...prev,
          [tempNode.id]: finalContent
        }));
        setNodeToZoomId(tempNode.id);
      }
      setTempNode(null);
    }
    setMenu({isOpen:false,x:0,y:0,mode:'idle',name:'',idx:0});
  }, [tempNode, setNs]);


  useImperativeHandle(ref,()=>({
    getNodes:()=>displayNodes.reduce((acc:any,n:any)=>{
      acc[n.id]=getContent(n.data);
      return acc;
    }, {} as Record<string,any>),
  }))

  const idle_cb =[
    ()=>setMenu({...menu, mode:'naming', idx:0}),
    ()=>setMenu({...menu, mode:'adding_to_group', idx:0}),
    ()=>{
      const filtered = Object.keys(ns)
        .filter((k:any) => !(Array.from(curSelected.current).includes(k)))
        .reduce((obj:any,k) => {
          obj[k] = ns[k];
          return obj;
        }, {});
      setNs(filtered);
      setMenu({isOpen:false,x:0,y:0,mode:'idle',name:'',idx:0});
    },
  ];

  const rename_cb=(e:any)=>setMenu({...menu, name: e.target.value})

  const localOnKeyDown=(e:React.KeyboardEvent) => {
    if (menu.isOpen) {
      if (e.key === 'ArrowDown') {
        setMenu((prev:any)=>({...prev, idx:Math.min(prev.idx+1,1) }))
      } else if (e.key === 'ArrowUp') {
        setMenu((prev:any)=>({...prev, idx:Math.max(prev.idx-1,0) }))
      } else if (e.key === 'Enter') {
        console.log('enter',e.target)
        if (menu.mode==='idle'){
          idle_cb[menu.idx]();
        }
      } else if (e.key === 'Escape') {
        setMenu((prev:any)=>({...prev,isOpen:false}));
      }
    }

    if (e.key==='Delete') {
      const filtered = Object.keys(ns)
        .filter((k:any) => !(Array.from(curSelected.current).includes(k)))
        .reduce((obj:any,k) => {
          obj[k] = ns[k];
          return obj;
        }, {});
      setNs(filtered)
    }
  };

  return (
    <Box
      className='graphFrame'
      ref={flowRef}
      onDoubleClick={handleWrapperDoubleClick}
      onKeyDown={(e:any)=>{
        localOnKeyDown(e);
      }}
    >
      <ReactFlow
        onNodesChange  = {(e)=>onNodesChange(e)}
        onSelectionEnd = {onSelectionEnd}
        zoomOnDoubleClick={false}
        onPaneClick={onPaneClick}
        onContextMenu={onContextMenu}
        nodesDraggable={false}

        snapGrid   = {[20, 20]}
        snapToGrid = {true}
        minZoom={0.01}
        maxZoom={15.5}
        panOnScroll
        selectionOnDrag
        panOnDrag={[1]}
        proOptions={{hideAttribution:true}}
        fitView

        panOnScrollSpeed  = {1.8}
        selectionMode     = {SelectionMode.Partial}
        zoomOnPinch       = {false}
        onWheel           = {(e:any)=>{
          handleWheel(e)
        }}
        nodes     = {displayNodes}
        edges     = {reactflowEs}
        nodeTypes = {nodeTypes}
        edgeTypes = {edgeTypes}
      >
        {/* <Panel position="top-right">
          <IconButton
            aria-label="center graph"
            variant="subtle"
            size="sm"
            bg="rgba(150, 150, 150, 0.1)" 
            backdropFilter="blur(5px)"
            borderRadius="md"
            onClick={()=>fitView({padding:0.3, duration:200})}
            >
            <MdFilterCenterFocus size="20px" />
          </IconButton>
        </Panel> */}
        <Panel position="top-right">
          <HStack gap="2">
            {/* Кнопка и меню Экспорта */}
            <Box position="relative">
              <IconButton
                aria-label="export graph"
                variant="subtle"
                size="sm"
                bg="rgba(150, 150, 150, 0.1)"
                backdropFilter="blur(5px)"
                borderRadius="md"
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
              >
                <PiExport  size="14px" />
              </IconButton>
              
              {exportMenuOpen && (
                <Box
                  position="absolute"
                  top="100%"
                  right={0}
                  mt="8px"
                  bg="color-mix(in srgb, #445 90%, transparent)"
                  border="1px solid color-mix(in srgb, #666 60%, transparent)"
                  backdropFilter="blur(20px)"
                  p="8px"
                  borderRadius="md"
                  boxShadow="dark-lg"
                  zIndex={1000}
                  w="200px"
                >
                  <VStack align="stretch" gap={2}>
                    <Text fontSize="12px" color="gray.400" mb="-4px">Имя файла</Text>
                    <input 
                      autoFocus
                      value={exportName}
                      onChange={(e) => setExportName(e.target.value)}
                      placeholder="graph"
                      style={{ 
                        background: 'rgba(0,0,0,0.3)', color: 'white', padding: '4px 8px', 
                        border: '1px solid gray', borderRadius: '3px', outline: 0, width: '100%', fontSize: '12px' 
                      }}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') handleExport('png'); // По дефолту при Enter - PNG
                        if (e.key === 'Escape') setExportMenuOpen(false);
                      }}
                    />
                    <HStack gap={1} mt={1}>
                      <Button flex={1} size="sm" height="24px" fontSize="12px" variant="subtle" colorPalette="blue" onClick={() => handleExport('png')}>
                        PNG
                      </Button>
                      <Button flex={1} size="sm" height="24px" fontSize="12px" variant="subtle" colorPalette="blue" onClick={() => handleExport('svg')}>
                        SVG
                      </Button>
                    </HStack>
                  </VStack>
                </Box>
              )}
            </Box>
            <IconButton
              aria-label="center graph"
              variant="subtle"
              size="sm"
              bg="rgba(150, 150, 150, 0.1)" 
              backdropFilter="blur(5px)"
              borderRadius="md"
              onClick={() => fitView({padding:0.3, duration:200})}
            >
              <MdFilterCenterFocus size="20px" />
            </IconButton>
          </HStack>
        </Panel>
      </ReactFlow>

      {menu.isOpen&&createPortal(
        <span css={[dropMenuCSS]}>
          <Box top={menu.y} left={menu.x} className='menuFrame'>
            {menu.mode==='idle'&&(
              <>
                <Text className='tip'>cards action</Text>
                <Button
                  w={'100%'}
                  p={'2px 5px'} borderRadius="sm" fontSize="12px"
                  bg={0===menu.idx? 'blue.600':'transparent'}
                  h={'30px'}
                  variant="ghost"
                  colorPalette={'blue'}
                  onClick={idle_cb[0]}>
                  group
                </Button>
                <Button
                  p={'2px 5px'} borderRadius="sm" fontSize="12px"
                  w={'100%'}
                  h={'30px'}
                  bg={1===menu.idx? 'blue.600':'transparent'}
                  variant="ghost"
                  colorPalette={'blue'}
                  onClick={idle_cb[1]}
                  >
                  add to group
                </Button>
                <Button
                  p={'2px 5px'} borderRadius="sm" fontSize="12px"
                  w={'100%'}
                  h={'30px'}
                  bg={2===menu.idx? 'blue.600':'transparent'}
                  variant="ghost"
                  colorPalette={'red'}
                  onClick={idle_cb[2]}
                  >
                  delete
                </Button>
              </>
            )}
            {menu.mode==='naming'&&(
              <>
                <Text className='tip'>Name new group</Text>
                <input 
                  autoFocus
                  placeholder="enter the name..."
                  value={menu.name}
                  style={{
                    background: 'transparent',
                    color: 'white',
                    padding: '4px 8px',
                    border: '0',
                    outline: 0,
                  }}
                  onChange={rename_cb}
                  onMouseDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter' && menu.name) {
                          handleCreateGroup(menu.name, Array.from(curSelected.current as any));
                          setMenu({isOpen:false,x:0,y:0,mode:'idle',name:'',idx:0});
                      }
                      if (e.key === 'Escape') setMenu({isOpen:false,x:0,y:0,mode:'idle',name:'',idx:0});
                  }}
                />
              </>
            )}
            {menu.mode==='adding_to_group'&&(
              <>
                <Text className='tip'>Select group</Text>
                {Object.keys(groups).length === 0 && <Text fontSize="12px" color="gray.400" mt="3px">No groups available</Text>}
                {Object.keys(groups).map((gName, i) => (
                  <Box key={gName} p={'2px 5px'} borderRadius="sm" fontSize="12px" mt={'3px'}
                        bg={i===menu.idx? 'blue.600':'transparent'}
                        cursor="pointer"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleAddNodesToGroup(gName);
                        }}>
                    {gName}
                  </Box>
                ))}
              </>
            )}
          </Box>
        </span>
    , document.body)}
    </Box>
  )
})


export const Graph=forwardRef(({headerRef}:any,ref:any)=>{
  const{ns,id,name,groups,setGroups}=useGraphCtx()as any;
  const [sel,setSel]=useState(Object.keys(ns));
  // graphmode / textmode
  const [mode,setMode]=useState('eg') as any;
  // name of the graph
  const [curName,setCurName]=useState({'0':name}) as any;
  // reactflow component with editable ns content forward ref
  const flowRef=useRef(null) as any;

  const latestNs = useRef(ns);
  const latestGroups = useRef(groups);
  const latestName = useRef(curName);

  useEffect(() => { latestNs.current = ns; }, [ns]);
  useEffect(() => { latestGroups.current = groups; }, [groups]);
  useEffect(() => { latestName.current = curName; }, [curName]);

  const { nodeToGroup, groupToGroup } = calculateHierarchy(groups);


  const [orderedIds, setOrderedIds] = useState<string[]>(Object.keys(ns).filter(k => sel.includes(k)));
  useEffect(() => {
    setOrderedIds(prev => {
      const newIds = sel.filter((id: string) => !prev.includes(id));
      return[...prev.filter((id: string) => sel.includes(id)), ...newIds];
    });
  }, [sel]);

  const handleMoveCard = (cardId: string, direction: -1 | 1) => {
    setOrderedIds(prev => {
      const idx = prev.indexOf(cardId);
      if (idx === -1) return prev;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  };

  const handleTopSort = () => {
    const sorted = topSort(ns, orderedIds);
    setOrderedIds(sorted.map(s => s.id));
  };

  const prevSelectCb = useRef(null) as any;

  const handleRenameGroup = useCallback((oldName: string, newName: string) => {
    setGroups((prev: any) => {
      const updated = { ...prev };
      updated[newName] = updated[oldName];
      delete updated[oldName];
      return updated;
    });
  },[setGroups]);

  const handleChangeGroupColor = useCallback((groupName: string, newColor: string) => {
    setGroups((prev: any) => ({
      ...prev,
      [groupName]: { ...prev[groupName], color: newColor }
    }));
  }, [setGroups]);

  const renderGraphTreeItem = (type:'group'|'node',itemId:string,depth:number):any=>{
    if (type==='node') {
      if (!orderedIds.includes(itemId)) return null;
      return (
        <Box ml={`${depth*10}px`} key={itemId}>
          <Card id={itemId} content={ns[itemId]} options={{stats:false, twoSides:false, padding:'8px 0px'}} />
        </Box>
      );
    } else {
      const gData = groups[itemId];
      const childGroups = Object.keys(groups).filter(g => groupToGroup[g] === itemId);
      const childNodes = gData.nodes.filter((n: string) => nodeToGroup[n] === itemId);
      const [groupHide,setGroupHide]=useState(false);
      const [groupSelect,setGroupSelect]=useState(false);
      return (
        <Box 
          key={`g_${itemId}`} 
          m={0}
          ml={`${depth*10}px`}
          bg={groupSelect?gData.color.replace('0.1', '0.08'):'transparent'}
          overflow={'hidden'}
          onClick={()=>{
            if (prevSelectCb.current) {
              prevSelectCb.current(false);
            }
            setGroupSelect(true);
            prevSelectCb.current=setGroupSelect
          }}
        >
          <Box
            fontSize="11px"
            fontWeight="bold"
            p={'4px'}
            w={'100%'}
            bg={groupSelect?gData.color:'transparent'}
            display={'flex'}
            flexDirection={'row'}
            >

            <IconButton className={'statButton'} variant={'plain'}
              h={'20px'}
              onClick={(e:any)=>{
                setGroupHide((h:any)=>!h)
                e.stopPropagation();
              }}>
              {groupHide?(<LuChevronRight className={'smIcon'} />):(<LuChevronDown className={'smIcon'} />)}
            </IconButton>
            {itemId}
          </Box>
          {!groupHide&&(
            <>
              {childGroups.map((cg:any) => renderGraphTreeItem('group', cg, depth + 1))}
              {childNodes.map((cn:any) => renderGraphTreeItem('node', cn, depth + 1))}
            </>
          )}
        </Box>
      );
    }
  };

  const renderTextTreeItem = (type: 'group' | 'node', itemId: string, depth: number): any => {
    if (type === 'node') {
      if (!orderedIds.includes(itemId)) return null;
      return (
        <Box ml={`${depth * 15}px`} key={itemId} w={`calc(100% - ${depth * 15}px)`}>
          <Card id={itemId} content={ns[itemId]} options={{ stats: false, twoSides: true, onMove: (dir: number) => handleMoveCard(itemId, dir as -1|1) }} />
        </Box>
      );
    } else {
      const gData = groups[itemId];
      const childGroups = Object.keys(groups).filter(g => groupToGroup[g] === itemId);
      const childNodes = gData.nodes.filter((n: string) => nodeToGroup[n] === itemId);
      return (
        <Box 
          key={`g_${itemId}`} ml={`${depth*10}px`} w={`calc(100% - ${depth*10}px)`}
          bg={gData.color} p="10px" my="10px" borderRadius="10px"
        >
          <Box
            fontSize="14px"
            fontWeight="bold"
            mb={3}
            >
            {itemId}
          </Box>
          {childGroups.map((cg:any) => renderTextTreeItem('group', cg, depth + 1))}
          {childNodes.map((cn:any) => renderTextTreeItem('node', cn, depth + 1))}
        </Box>
      );
    }
  };

  const saveGraph = useCallback(async () => {
    const user = await spaced_account.get();
    const currentUserId = user.$id;
    const currentNs = latestNs.current;
    const currentGroups = latestGroups.current;
    const currentGraphName = latestName.current['0'];
    console.log('Актуальный ns перед сохранением:', currentNs);
    gReq.update(id, {
      content: JSON.stringify(currentNs),
      groups: JSON.stringify(currentGroups),
      name: currentGraphName,
      collaborators: [],
      owner: currentUserId,
    });
  }, [id]);

  const HeaderTabs = (
    // css wrapper
    <span css={graphCSS} key={'header_tabs'}>
      <Tabs.Root className='headerTabs' value={mode} onValueChange={(e)=>setMode(e.value)} variant="plain">
        <Tabs.Trigger className='tabsTrigger' value="eg">
          <BsDiagram2Fill />
        </Tabs.Trigger>
        <Tabs.Trigger className='tabsTrigger' value="tr" ml={'-6px'}>
          <FaParagraph style={{marginLeft:'-1.5px'}}/>
        </Tabs.Trigger>

        <Tabs.Trigger className='tabsTrigger' value="repeat" ml={'-6px'}>
          <RiRepeat2Line />
        </Tabs.Trigger>

        <GraphCtx.Provider value={{ns:curName, setNs:setCurName}}>
            <Card id={'0'} content={name} options={{twoSides:false, fontSize:12}}/>
        </GraphCtx.Provider>
        <Spacer />

        <Button h={'20px'} gap={'3px'} fontWeight={500} p={'0px 4px'} variant={'ghost'} colorPalette={'green'}
          onClick={saveGraph}
        >
          <RiSaveFill style={{height:'13px',width:'13px'}}/>
          save
        </Button>

        <Clip
          props={{
            h:'20px',
            variant:'ghost',
            p:'0',
            w:'20px',
            minW:'20px'}}
          copyIcon={<FaShare style={{width:'13px',height:'13px'}}/>}
          value={APPWRITE_CONFIG.BASE_URL+'/'+id}
          />
      </Tabs.Root>
    </span>
  );

  useEffect(()=>{
    // update header when mode is changed
    if (headerRef&&headerRef.current) {
      const f=async()=>{
        await headerRef.current.resetContent();
        const dc=headerRef.current.getContent();
        headerRef.current.setContent([dc[0], HeaderTabs, dc[2]]);
      }
      f();
    }
  },[mode,groups,curName])

  const handleUngroup = useCallback((groupName: string) => {
    setGroups((prev: any) => {
      const updated = { ...prev };
      delete updated[groupName];
      return updated;
    });
  }, [setGroups]);


  const handleDragStart = useCallback((e: React.DragEvent, dragId: string, type: 'node' | 'group') => {
    e.dataTransfer.setData('application/json', JSON.stringify({ id: dragId, type }));
    e.dataTransfer.effectAllowed = 'move';
  },[]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  },[]);

  const handleDropOnGroup = useCallback((e: React.DragEvent, targetGroupId: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.id === targetGroupId) return;
      if (data.type === 'node') {
        setGroups((prev: any) => {
          const next = { ...prev };
          Object.keys(next).forEach(g => {
            next[g] = { ...next[g], nodes: next[g].nodes.filter((n: string) => n !== data.id) };
          });
          next[targetGroupId] = { ...next[targetGroupId], nodes: [...new Set([...next[targetGroupId].nodes, data.id])] };
          return next;
        });
      }
    } catch(err) {}
  }, [setGroups]);

  const handleDropOnNode = useCallback((e: React.DragEvent, targetNodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.id === targetNodeId) return;
      if (data.type === 'node') {
        // Change order
        setOrderedIds((prev) => {
          const next = [...prev];
          const fromIdx = next.indexOf(data.id);
          const toIdx = next.indexOf(targetNodeId);
          if (fromIdx !== -1 && toIdx !== -1) {
            next.splice(fromIdx, 1);
            next.splice(toIdx, 0, data.id);
          }
          return next;
        });
        
        // Adopt the group of the target node
        const targetGroup = nodeToGroup[targetNodeId];
        setGroups((prev: any) => {
          const next = { ...prev };
          Object.keys(next).forEach(g => {
            next[g] = { ...next[g], nodes: next[g].nodes.filter((n: string) => n !== data.id) };
          });
          if (targetGroup && next[targetGroup]) {
            next[targetGroup] = { ...next[targetGroup], nodes: [...new Set([...next[targetGroup].nodes, data.id])] };
          }
          return next;
        });
      }
    } catch(err) {}
  }, [nodeToGroup, setGroups]);

  const handleDropOnRoot = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.type === 'node') {
        // Remove from groups to make it root
        setGroups((prev: any) => {
          const next = { ...prev };
          Object.keys(next).forEach(g => {
            next[g] = { ...next[g], nodes: next[g].nodes.filter((n: string) => n !== data.id) };
          });
          return next;
        });
      }
    } catch(err) {}
  }, [setGroups]);

  const Editor = (
  <Tabs.Root css={graphCSS} defaultValue="tr" variant="plain" className={'graphTabs'}>
    {mode==='eg'&&(
      <HStack className='GraphmodeSides'>
        <VStack className='GraphmodeStack' onDragOver={handleDragOver} onDrop={handleDropOnRoot}>
        {Object.keys(groups).filter(g=>!groupToGroup[g]).map(g=>(
          <GraphTreeGroup
            key={g}itemId={g}depth={0}
            groups={groups} groupToGroup={groupToGroup}
            nodeToGroup={nodeToGroup} ns={ns}
            orderedIds={orderedIds}
            prevSelectCb={prevSelectCb}
            handleRenameGroup={handleRenameGroup}
            handleChangeGroupColor={handleChangeGroupColor}
            handleUngroup={handleUngroup}

            onDragStart={handleDragStart} onDragOver={handleDragOver} onDropOnGroup={handleDropOnGroup} onDropOnNode={handleDropOnNode}
            />
        ))}
        {orderedIds.filter(id=>!nodeToGroup[id]).map(n=>(
          <GraphTreeNode
            key={n}itemId={n}depth={0}
            ns={ns}orderedIds={orderedIds}

            onDragStart={handleDragStart} onDragOver={handleDragOver} onDropOnNode={handleDropOnNode}
            />
        ))}
        </VStack>
        <Separator orientation={'vertical'} w={'1px'} h={'100%'}/>
        <ReactFlowProvider> {/* to user useReactFlow() inside */}
          <Flow ref={flowRef}/>
        </ReactFlowProvider>
      </HStack>
    )}

    {mode==='tr'&&(
      <>
        <VStack className='TextmodeStack'>
          <Box className='textmodeToolsPanel'>
            <Button className='thinButton' variant="subtle" onClick={handleTopSort}>
              <BsDiagram2Fill style={{height:'13px',width:'13px',marginRight: '5px'}}/>
              top sort
            </Button>
          </Box>
          {orderedIds.map((curId:any)=>{
            return <Card
              key={curId}
              id={curId}
              content={ns[curId]}
              options={{ 
                stats: false, 
                twoSides: true, 
                onMove: (dir: number) => handleMoveCard(curId, dir as -1|1)
              }}
            />
          })}
        </VStack>
      </>
    )}

    {mode==='repeat'&&(
      <Feed/>
    )}
  </Tabs.Root>)

  useImperativeHandle(ref,()=>({
    select: (ids:any)=>{
      setSel(ids);
    },
    selected:()=>{
      return sel;
    },
    unselectGroupStack:()=>{
      if (prevSelectCb.current) {
        prevSelectCb.current(false);
      }
      prevSelectCb.current = null;
    },
  }))

  return (
    <div css={graphCSS}>
      {Editor}
    </div>
  )
});