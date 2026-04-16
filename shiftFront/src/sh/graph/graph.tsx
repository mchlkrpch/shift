/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import '@xyflow/react/dist/style.css';

import {
  getSmoothStepPath,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useReactFlow
} from '@xyflow/react'
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState
} from 'react'
import {
  useGraphCtx
} from '../../App';
import {
  DarkMode,
  LightMode,
  useColorMode
} from '../../main';
import {
  Box,
  CardHeader,
  CardRoot,
  HStack,
  Tabs,
  Text,
  VStack
} from '@chakra-ui/react';
import { calcG, Sh, topSort } from '../card/utility';
import { Card } from '../card/card';
import { FaParagraph } from "react-icons/fa6";
import { BsDiagram2Fill } from "react-icons/bs";

export const graphCSS = css`

//////////////////////////////////////////////////////
// graph tabs
//////////////////////////////////////////////////////

.graphTabs {
  width: 100%;
}

.tabsTrigger {
  border-radius: 2px;
  height: 20px;
  padding: 2px 4px;
  gap: 2px;
}


.GraphEditorStack {
  align-items: stretch;
  gap: 2px;
  display: flex;
  flex: 1;

  // mx: auto;
  min-width: 50%;
  max-width: 50%;
}

.TextEditorStack {
  align-items: stretch;
  gap: 0;
  display: flex;
  flex: 1;
  mx: auto;
}
`;

export const SpDefinition = (card: any) => {
  const { data } = card;
  const { editViewMode } = useGraphCtx() as any;

  if (!data.tp) {
    data.tp = 'Def';
  }

  const { colorMode } = useColorMode();
  const firstLine = data.forward[0];

  const content = (
    <Box backgroundColor={'transparent'}>
      <Box>
        <Handle
          type='target'
          position={Position.Top}
          style={{ top: '100%', opacity: '0%' }}
          isConnectable={false}
        />
        <Handle
          type="source"
          style={{ top: '100%', opacity: '0%' }}
          position={Position.Top}
          isConnectable={false}
        />
      </Box>
      <CardRoot
        className={`SpDef-frame feed-block-${data.tp}`}
        borderRadius={'15px'}
        w={'fit-content'}
        minW={'80px'}
        maxW={'250px'}
        h={'fit-content'}
        minH={'30px'}
        display={'flex'}
        alignContent={'center'}
        alignItems={'center'}
      >
        <CardHeader
          p={'5px'}
          overflow={'hidden'}
          whiteSpace={'normal'}
          wordBreak={'break-word'}
          mt={'auto'}
          mb={'auto'}
          w={'100%'}
        >
          <Sh value={firstLine} isInner={true}/>
        </CardHeader>
        {editViewMode === 'repeat' &&
          <HStack ml={'auto'} mr={'auto'}>
            <Text fontSize={'10px'} opacity={0.4}>
              {/* {progress[data.id].float} */}
            </Text>
          </HStack>
        }
      </CardRoot>
    </Box>
  );

  if (colorMode == 'light') {
    return <LightMode>{content}</LightMode>;
  }
  return <DarkMode>{content}</DarkMode>;
};


export function SpEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  // @ts-expect-error: expected style parameter by default
  // eslint-disable-next-line
  style = {},
  markerEnd,
  selected,
  borderRadius = 15,
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
        // fill={'transparnt'}
        stroke="color-mix(in srgb, white 10%, transparent)"
        d={edgePath}
        strokeWidth={selected ? 2 : 1.5}
        markerEnd={markerEnd}
      />
      <path
        d={edgePath}
        fill="transparent"
        stroke="transparent"
        strokeWidth={18}
      />
    </>
  );
}


const nodeTypes = {SpDef:  SpDefinition}
const edgeTypes = {SpEdge: SpEdge}

const Flow=()=>{
  const gCtx=useGraphCtx()as any;
  const{ns,ref}=gCtx;
  const [react_ns,react_es] = calcG(ns);
  const tempSelRef = useRef(new Set());
  const flowRef = useRef(null) as any;
  const { setViewport, getViewport, getZoom } = useReactFlow();

  const handleWheel = useCallback((event:any) => {
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

  const onSelectionEnd = () => {
    const finalSelectionArray = Array.from(tempSelRef.current);
    console.log("Окончательное выделение:", finalSelectionArray);
    ref.current.select(finalSelectionArray);
    tempSelRef.current=new Set()
  };

  const onNodesChange = (changes: any) => {
    changes = changes.filter((ch: any) => ch.type !== 'position');
    for (const ch of changes) {
      if (ch.type === 'select') {
        if (ch.selected === true) {
          tempSelRef.current.add(ch.id);
        } else {
          tempSelRef.current.delete(ch.id);
        }
      }
    }
  };
  

  return (
    <Box
      flex={1}
      position="relative"
      ref={flowRef}
      minH={'500px'}
    >
      <ReactFlow
        onNodesChange  = {(e)=>onNodesChange(e)}
        onSelectionEnd = {onSelectionEnd}
        // onPaneClick    = {onPaneClick}
        // onKeyDown={handleKeyDown}
        snapGrid   = {[20, 20]}
        snapToGrid = {true}
        minZoom={0.01}
        maxZoom={15.5}
        panOnScroll
        selectionOnDrag
        panOnDrag={[1]}
        proOptions={{ hideAttribution: true }}
        // onMoveStart={onMoveStart}
        // onPaneContextMenu={onPaneContextMenu}
        // onNodeContextMenu={onNodeContextMenu}
        // onPaneContextMenu={}
        panOnScrollSpeed  = {1.8}
        selectionMode     = {SelectionMode.Partial}
        zoomOnPinch={false}
        onWheel={(e:any)=>{
          handleWheel(e)
        }}
        nodes     = {react_ns}
        edges     = {react_es}
        nodeTypes = {nodeTypes}
        edgeTypes = {edgeTypes}
      >
      </ReactFlow>
    </Box>
  )
}


export const Graph = forwardRef((_:any,ref:any)=>{
  const gCtx=useGraphCtx()as any;
  const{ns}=gCtx;
  const [sel,setSel]=useState(Object.keys(ns));
  const [mode,setMode]=useState('eg') as any;
  useImperativeHandle(ref,()=>({
    select: (ids:any)=>{
      setSel(ids);
    },
    selected:()=>{
      return sel;
    }
  }))


  const sorted_ns = topSort(
    Object.keys(ns)
      .filter(key => sel.includes(key)) 
      .reduce((obj: any, key: any) => {obj[key] = ns[key]; return obj;}, {}) as any);


  const GraphTabs = <Tabs.Root defaultValue="GraphEditor" variant="plain" className={'graphTabs'}>
    <Tabs.List bg="bg.muted" rounded="4px" p="3px" minH={'fit-content'}>
      <Tabs.Trigger value="GraphEditor" className='tabsTrigger' onClick={()=>setMode('eg')}>
        <BsDiagram2Fill/> graph
      </Tabs.Trigger>
      <Tabs.Trigger value="TextEditor" className='tabsTrigger' onClick={()=>{setMode('tr')}}>
        <FaParagraph style={{width:'15px', height:'15px'}}/> text
      </Tabs.Trigger>
      <Tabs.Indicator />
    </Tabs.List>

    <Tabs.Content value="GraphEditor">
      <HStack w={'100%'} h={'100%'} alignItems={'stretch'} gap={0}>
        <VStack className='GraphEditorStack'>
        {sorted_ns.map((item:any)=>{
          return <Card
            key={item.id}
            id={item.id}
            content={item.content}
            options={{stats: false}}
          />
        })}
        </VStack>
        <ReactFlowProvider>
          <Flow/>
        </ReactFlowProvider>
      </HStack>
    </Tabs.Content>

    <Tabs.Content value="TextEditor">
      <VStack className='TextEditorStack'>
      {sorted_ns.map((item:any)=>{
        return <Card
          key={item.id}
          id={item.id}
          content={item.content}
          options={{stats: false, textEdit:mode==='eg'?false:true}}
        />
      })}
      </VStack>
    </Tabs.Content>
  </Tabs.Root>

  return (
    <VStack css={graphCSS}>
      {GraphTabs}
    </VStack>
  )
});