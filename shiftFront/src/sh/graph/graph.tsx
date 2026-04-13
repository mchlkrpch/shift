import { getSmoothStepPath, Handle, Position, ReactFlow, ReactFlowProvider, SelectionMode, useReactFlow } from '@xyflow/react'
import react, { useCallback, useRef } from 'react'
import { GraphCtx, useGraphCtx } from '../../App';
import { DarkMode, LightMode, useColorMode } from '../../main';
import { Box, CardHeader, CardRoot, HStack, Text, VStack } from '@chakra-ui/react';
import { calcG, Sh, topSort } from '../card/utility';
import { Card } from '../card/card';

export const SpDefinition = (card: any) => {
  const{
    data,
  }=card;
  console.log('data:',data)

  const {
    editViewMode,
  } = useGraphCtx() as any;

  if (!data.tp){
    data.tp='Def'
  }
  
  const {
    colorMode
  } = useColorMode();
  const firstLine = data.forward[0];
  console.log('fl:',firstLine)
  let calcPadding = '3px'
  if (editViewMode === 'repeat') {
    calcPadding = '3px';
  }

  const content = (
    <Box
      backgroundColor={'transparent'}
    >
      <Box>
        <Handle
          type='target'
          position={Position.Top}
          style={{ top: '100%', opacity: '0%', }}
          isConnectable={false}
        />

        <Handle
          type="source"
          style={{ top: '100%', opacity: '0%', }}
          position={Position.Top}
          isConnectable={false}
        />
      </Box>
      <CardRoot
        className={`SpDef-frame feed-block-${data.tp}`}
        borderRadius={'full'}
        // 2. Устанавливаем максимальную ширину и высоту для ноды.
        maxW={`${80}px`}
        w={`${80}px`}
        h={`${30}px`}
        display={'flex'}
        alignContent={'center'}
        alignItems={'center'}
        p={calcPadding}
      >
        {/* 3. Применяем стили для усечения текста к Card.Header */}
        <CardHeader
          p={0}
          pl={'13px'}
          pr={'13px'}
          overflow={'hidden'}      // Скрываем все, что не помещается
          whiteSpace={'nowrap'}    // Запрещаем перенос текста
          lineClamp="1"
          mt={'auto'}
          mb={'auto'}
          maxW={`${80}`}
        >
          <Sh value={firstLine} isInner={true}/>
        </CardHeader>
        {editViewMode === 'repeat' &&
          <HStack
            ml={'auto'} mr={'auto'}
          >
            <Text
              fontSize={'10px'}
              opacity={0.4}
            >
              {/* {progress[data.id].float} */}
            </Text>
          </HStack>
        }
      </CardRoot>
    </Box>
  )

  if (colorMode == 'light') {
    return (
      <LightMode>
        {content}
      </LightMode>
    )
  }
  return (
    <DarkMode>
      {content}
    </DarkMode>
  );
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
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius,
  });

  return (
    <>
      <path
        id={id}
        stroke="color-mix(in srgb, white 10%, transparent)"
        d={edgePath}
        strokeWidth={selected ? 2 : 1.5}
        markerEnd={markerEnd}
      />
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={18}
      />
    </>
  );
}

const nodeTypes = {
  SpDef:  SpDefinition,
}
const edgeTypes = {
  SpEdge: SpEdge,
}

const Flow=()=>{
  const gCtx=useGraphCtx()as any;
  const{
    ns,
  }=gCtx;
  const [react_ns,react_es] = calcG(ns);
  console.log('es:',react_es)
  console.log('ns:', react_ns)
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
  return (
    <Box
      flex={1}
      position="relative"
      ref={flowRef}
      // maxW={'50%'}
    >
      <ReactFlow
        // ref={gRef}
        // onNodesChange  = {(e)=>onNodesChange(e)}
        // onSelectionEnd = {onSelectionEnd}
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

export const Graph=()=>{
    const gCtx=useGraphCtx()as any;
    const{
        ns,
        setNs,
    }=gCtx;
    const sorted = topSort(ns as any);
    return (
        <HStack w={'100%'} h={'100%'} alignItems={'stretch'} gap={0}>
            <VStack
                alignItems={'stretch'}
                gap={'2px'}
                display={'flex'}
                flex={1}
                mx={'auto'}
            >
            {sorted.map((item:any)=>{
                return <>
                    <Card
                        id={item.id}
                        content={item.content}
                        tp={'ghost'}
                    />
                </>
            })}
            </VStack>
            <ReactFlowProvider>
                <Flow/>
            </ReactFlowProvider>
        </HStack>
    )
}