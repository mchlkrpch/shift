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
  Spacer,
  Tabs,
  VStack
} from '@chakra-ui/react';
import { calcG, OPTION_SPLIT_SYM, Sh, SIDE_SPLIT_SYM, topSort } from '../card/utility';
import { Card } from '../card/card';
import { FaParagraph } from "react-icons/fa6";
import { BsDiagram2Fill } from "react-icons/bs";
import { gReq, spaced_account } from "../../appwrite/service";
import { Panel } from '@xyflow/react';
import { MdFilterCenterFocus } from "react-icons/md";

export const graphCSS = css`
display:flex;
flex:1;
margin: 0;

.graphStack{
  overflow-y: hidden;
}

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
  gap: 20px;
  display: flex;
  flex: 1;
  min-height:0;
  min-width: 50%;
  max-width: 50%;
  overflow-y: auto;
  scrollbar-width: none;
  overflow-x: auto;
}

.TextEditorStack {
  align-items: stretch;
  gap: 0;
  display: flex;
  flex: 1;
  min-height:0;
  overflow-y: auto;
  scrollbar-width: none;
}

//////////////////////////////////////////////////////
// graph frame
//////////////////////////////////////////////////////

.graphFrame {
  flex: 1;
  position: relative;
  min-height: 500px;
  // border-radius: 20px;
  overflow: hidden;
  background-color: color-mix(in srgb, #666 10%, transparent);
}

.defNode {
}
`;

export const SpDefinition = (card: any) => {
  const {data} = card;
  if (!data.tp) {
    data.tp = 'Def';
  }

  const { colorMode } = useColorMode();
  const firstLine = data.forward[0];

  const content = (
    <Box className='defNode'>
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
        className={`SpDef-frame feed-block-${data.tp}`}
        borderRadius={'5px'}
        w={'fit-content'}
        maxW={'250px'}
        minH={'30px'}>
        <Sh value={firstLine} isInner={true}/>
      </CardRoot>
    </Box>
  );

  if (colorMode == 'light') {
    return <LightMode>{content}</LightMode>;
  }
  return <DarkMode>{content}</DarkMode>;
};

export const TempDefinition = ({ data, id }: any) => {
  const fakeGCtx = {
    ns: { [id]: data.content },
    setNs: (newNs: any) => data.setContent(newNs[id]),
    name:'',
    id:'',
    ref:null,
  };
  const { colorMode } = useColorMode();
  const content= (
    <Box 
      className='defNode'
      onClick={(e) => e.stopPropagation()} 
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <CardRoot
        className={`SpDef-frame feed-block-Def`}
        borderRadius={'5px'}
        w={'350px'}
        minH={'30px'}
        boxShadow={'0px 0px 20px rgba(0, 0, 0, 0.4)'}
      >
        <GraphCtx.Provider value={fakeGCtx}>
          <Card 
            id={id} 
            content={data.content}
            focus
            options={{textEdit:false, stats:false}} 
          />
        </GraphCtx.Provider>
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


const nodeTypes = {SpDef:SpDefinition, TempDef:TempDefinition}
const edgeTypes = {SpEdge: SpEdge}


function getContent(data:any) {
  console.log('data:',data);
  return data.forward.map((f_s:string,i:number)=>(
    f_s
    + `\n${SIDE_SPLIT_SYM}\n`
    + data.backward[i]
  )).join(`\n${OPTION_SPLIT_SYM}\n`)
}

const Flow=React.forwardRef((props:any,r:any)=>{
  const gCtx=useGraphCtx()as any;
  const{ns,setNs,ref}=gCtx;
  const [react_ns,react_es] = calcG(ns);
  const tempSelRef = useRef(new Set());
  const flowRef = useRef(null) as any;

  const[tempNode, setTempNode] = useState<any>(null);
  const tempContentRef = useRef('');
  const[nodeToZoomId, setNodeToZoomId] = useState<string | null>(null);

  const {
    setViewport,
    getViewport,
    getZoom,
    fitView,
    screenToFlowPosition,
    setCenter,
    getNodes
  }=useReactFlow();

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
  },[react_ns, nodeToZoomId, getNodes, setCenter]);


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
          }
        }
      };
      return [...react_ns, tNode];
    }
    return react_ns;
  }, [react_ns, tempNode]);


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
  }, [tempNode, setNs]);



  // //////////////////////////////////////////////////////////////////////////////////////////////
  useImperativeHandle(r,()=>({
    getNodes:()=>displayNodes.reduce((acc:any,n:any)=>{
      // console.log('N',n);
      acc[n.id]=getContent(n.data);
      return acc;
    }, {} as Record<string,any>),
  }))

  return (
    <Box
      className='graphFrame'
      ref={flowRef}
      onDoubleClick={handleWrapperDoubleClick}
    >
      <ReactFlow
        onNodesChange  = {(e)=>onNodesChange(e)}
        onSelectionEnd = {onSelectionEnd}
        zoomOnDoubleClick={false}
        onPaneClick={onPaneClick}

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
        // nodes     = {react_ns}
        nodes={displayNodes}
        edges     = {react_es}
        nodeTypes = {nodeTypes}
        edgeTypes = {edgeTypes}
      >
        <Panel position="top-right">
          <IconButton
            aria-label="Центрировать граф"
            variant="subtle"
            size="sm"
            bg="rgba(150, 150, 150, 0.1)" 
            backdropFilter="blur(5px)"
            borderRadius="md"
            onClick={() => {
              fitView({ padding: 0.2, duration: 800 });
            }}
          >
            <MdFilterCenterFocus size="20px" />
          </IconButton>
        </Panel>
      </ReactFlow>
    </Box>
  )
})


export const Graph = forwardRef(({headerRef}:any,ref:any)=>{
  const gCtx=useGraphCtx()as any;
  const{ns,id,name}=gCtx;
  const [sel,setSel]=useState(Object.keys(ns));
  const [mode,setMode]=useState('eg') as any;
  const [curName,setCurName]=useState({'0':name}) as any;
  const flowRef=useRef(null) as any;

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

  const TabsHeader = (
    <Tabs.Root css={graphCSS} value={mode} onValueChange={(e) => setMode(e.value)} variant="plain"
      display={'flex'}
      flexDirection={'row'}
      w={'100%'}
      alignItems={'center'}
      gap={'10px'}
    >
      <GraphCtx.Provider value={{
        ns:curName, setNs:setCurName,
        ref:null, id:'',
        name: '',
      }}>
          <Card id={'0'} content={name} options={{}}/>
      </GraphCtx.Provider>
      
      <Tabs.List bg="bg.muted" rounded="4px" p="3px" minH="fit-content" alignItems={'center'} justifyContent={'center'}>
        <Tabs.Trigger className='tabsTrigger' value="eg">
          <BsDiagram2Fill /> graph
        </Tabs.Trigger>
        <Tabs.Trigger className='tabsTrigger' value="tr">
          <FaParagraph /> text
        </Tabs.Trigger>
        <Tabs.Indicator />
      </Tabs.List>
      <Spacer />
      <Button h={'20px'} variant={'subtle'} colorPalette={'green'}
        onClick={async()=>{
          const user = await spaced_account.get();
          const currentUserId = user.$id;
          const newNs = flowRef.current.getNodes();

          gReq.update(id,{
            content:JSON.stringify(newNs),
            name:curName['0'],
            collaborators:[],
            owner:currentUserId,
          })
        }}
      >
        commit
      </Button>
    </Tabs.Root>
  );

  useEffect(()=>{
    if (headerRef&&headerRef.current) {
      const f=async()=>{
        await headerRef.current.resetContent();
        const dc=headerRef.current.getContent();
        console.log(dc)
        headerRef.current.setContent([
          dc[0],
          TabsHeader,
          dc[2],
        ]);
  
        console.log(headerRef.current.getContent())
      }
      f();
    }
  },[mode])

  const GraphTabs = (
  <Tabs.Root defaultValue="GraphEditor" variant="plain" className={'graphTabs'}
      w={'100%'}
      display="flex" flexDirection="column" gap={0}
      minH={0}
      flex={1}
      >
    {mode==='eg'&&(
      <HStack w={'100%'}
        flex={1}
        minH={0}
        alignItems={'stretch'} gap={0}>
        <VStack className='GraphEditorStack' flex={1} minH={0}>
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
          <Flow ref={flowRef}/>
        </ReactFlowProvider>
      </HStack>
    )}
    {mode==='tr'&&(
      <VStack className='TextEditorStack'
        flex={1}
        minH={0}
        overflowY={'auto'}
        >
      {sorted_ns.map((item:any)=>{
        return <Card
          key={item.id}
          id={item.id}
          content={item.content}
          options={{stats: false, textEdit:mode==='eg'?false:true}}
        />
      })}
      </VStack>
    )}
  </Tabs.Root>)

  return (
    <div css={graphCSS}
      style={{ position: 'relative', flex: 1, width: '100%', minHeight: 0 }}>
      <Box position="absolute" inset={0} display="flex" flexDirection="column">
        <VStack className={'graphStack'} flex={1} minH={0} gap={0}>
          {GraphTabs}
        </VStack>
      </Box>
    </div>
  )
});