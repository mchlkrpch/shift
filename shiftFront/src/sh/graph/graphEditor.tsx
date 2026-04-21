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
  Separator,
  Spacer,
  Tabs,
  VStack
} from '@chakra-ui/react';
import { calcG, OPTION_SPLIT_SYM, Sh, SIDE_SPLIT_SYM, topSort } from '../card/utility';
import { Card } from '../card/card';
import { FaParagraph } from "react-icons/fa6";
import { BsDiagram2Fill } from "react-icons/bs";
import { APPWRITE_CONFIG, gReq, spaced_account } from "../../appwrite/service";
import { Panel } from '@xyflow/react';
import { MdFilterCenterFocus } from "react-icons/md";
import { Clip } from "../clip";
import { FaShare } from "react-icons/fa";
import { RiSaveFill } from "react-icons/ri";

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
  gap: 5px;
}

.graphTabs {
  width: 100%;
  display: flex
  flex-direction:column;
  gap:0;
  min-height:0;
  flex:1;
}

.tabsTrigger {
  border-radius: 2px;
  height: 20px;
  padding: 2px 5px;
  gap: 2px;
}


// for selected mode(graph/text) in header
[aria-selected="true"] {
  background-color: color-mix(in srgb, #666 20%, transparent);
  // border: 1px solid color-mix(in srgb, #666 20%, transparent);
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
  padding: 0px 10px;

  gap: 20px;
  min-width: 50%;
  max-width: 50%;
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

  background-color: color-mix(in srgb, var(--chakra-colors-bg) 80%, transparent);
  backdrop-filter:blur(10px);
  border-bottom: 1px solid color-mix(in srgb, #666 20%, transparent);
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

export const SpDef=({data}:any)=>{
  return (
    <Colored content={(
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
          <Sh value={data.forward[0]} isInner={true}/>
        </CardRoot>
      </Box>
    )}/>
  )
};

export const TempDef = ({data,id}: any) => {
  const fakeGCtx = {
    ns:{[id]:data.content},
    setNs:(newNs:any)=>data.setContent(newNs[id]),
    name:'', id:'',
    ref:null,
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
        <GraphCtx.Provider value={fakeGCtx}>
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


export function SpEdge({
  id,
  sourceX,sourceY,
  targetX,targetY,
  sourcePosition,targetPosition,
  markerEnd,selected,borderRadius = 15,
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


const nodeTypes = {SpDef:SpDef, TempDef:TempDef}
const edgeTypes = {SpEdge: SpEdge}


// to user useReactFlow() inside
const Flow=React.forwardRef((props:any,ref:any)=>{
  const gCtx=useGraphCtx()as any;
  const{ns,setNs,gRef}=gCtx;
  const [reactflowNs,reactflowEs] = calcG(ns); // calculates dagre graph with connections between cards
  const flowRef = useRef(null) as any;
  const selectedNodesIds = useRef(new Set());

  const[tempNode, setTempNode] = useState<any>(null);
  const tempContentRef = useRef('');
  const[nodeToZoomId, setNodeToZoomId] = useState<string|null>(null);

  const {
    setViewport,getViewport,
    getZoom,fitView,
    screenToFlowPosition,
    setCenter,getNodes,
  }=useReactFlow();

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
          }
        }
      };
      return [...reactflowNs, tNode];
    }
    return reactflowNs;
  }, [reactflowNs, tempNode]);


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


  useImperativeHandle(ref,()=>({
    getNodes:()=>displayNodes.reduce((acc:any,n:any)=>{
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
        // nodes     = {reactflowNs}
        nodes={displayNodes}
        edges     = {reactflowEs}
        nodeTypes = {nodeTypes}
        edgeTypes = {edgeTypes}
      >
        <Panel position="top-right">
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
        </Panel>
      </ReactFlow>
    </Box>
  )
})


export const Graph=forwardRef(({headerRef}:any,ref:any)=>{
  const{ns,id,name}=useGraphCtx()as any;
  const [sel,setSel]=useState(Object.keys(ns));
  // graphmode / textmode
  const [mode,setMode]=useState('tr') as any;
  // name of the graph
  const [curName,setCurName]=useState({'0':name}) as any;
  // reactflow component with editable ns content forward ref
  const flowRef=useRef(null) as any;


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

  const graphNodes = orderedIds.map(id => ({ id, content: ns[id] }));

  const HeaderTabs = (
    // css wrapper
    <span css={graphCSS} key={'header_tabs'}>
      <Tabs.Root className='headerTabs' value={mode} onValueChange={(e)=>setMode(e.value)} variant="plain">
        <Tabs.Trigger className='tabsTrigger' value="eg">
          <BsDiagram2Fill /> graph
        </Tabs.Trigger>
        <Tabs.Trigger className='tabsTrigger' value="tr" ml={'-6px'}>
          <FaParagraph /> text
        </Tabs.Trigger>

        <GraphCtx.Provider value={{ns:curName, setNs:setCurName}}>
            <Card id={'0'} content={name} options={{}}/>
        </GraphCtx.Provider>
        <Spacer />

        <Button h={'20px'} gap={'3px'} fontWeight={500} p={'0px 4px'} variant={'subtle'} colorPalette={'green'}
          onClick={async()=>{
            // get user id to autorize; get current node from curstom
            // hook of fwdRef of flow and push to appwrite
            const user = await spaced_account.get();
            const currentUserId = user.$id;
            gReq.update(id,{
              content:JSON.stringify(ns),
              name:curName['0'],
              collaborators:[],
              owner:currentUserId,
            })
          }}
        >
          <RiSaveFill style={{height:'13px',width:'13px'}}/>
          save</Button>
        <Clip
          props={{
            h:'20px',
            variant:'subtle',
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
  },[mode])

  const Editor = (
  <Tabs.Root defaultValue="tr" variant="plain" className={'graphTabs'}>
    {mode==='eg'&&(
      <HStack className='GraphmodeSides'>
        <VStack className='GraphmodeStack'>
        {graphNodes.map((item:any)=>{
          return <Card
            key={item.id}
            id={item.id}
            content={item.content}
            options={{stats:false, twoSides:false}}
          />
        })}
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
  </Tabs.Root>)

  useImperativeHandle(ref,()=>({
    select: (ids:any)=>{
      setSel(ids);
    },
    selected:()=>{
      return sel;
    }
  }))

  return (
    <div css={graphCSS}>
      {Editor}
    </div>
  )
});