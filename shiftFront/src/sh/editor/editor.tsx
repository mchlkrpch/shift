/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import {
  forwardRef,
  useRef,
  useState,
  useImperativeHandle,
  useCallback,
  useMemo,
} from 'react';
import {
  Box,
  Tabs,
} from "@chakra-ui/react";
import '@xyflow/react/dist/style.css';
import { ContextMenu, useContextMenu } from "./contextMenu";
import { useGraphCtx } from "../../App";
import { UpperHeader } from "../../components/header";
import { Feed } from "./feed/feed";
import { UnifiedTreeView } from "./tree/unifiedTreeview";
import { gReq } from "../../appwrite/service";
import { RiSaveFill } from "react-icons/ri";
import { buildNestedTreeFromUnified, convertNestedToUnifiedBlocks } from "./utility";
import { useTreeKeyboard } from "./tree/unifiedUtils";
import store from "../../storage";



export const editorCSS = css`
display:flex;
flex:1;
height: 100%;
position: relative;
margin: 0;
width: 100%;
min-height: 0;
flex-direction: column;

.thinButton {
  height: 20px;
  gap: 3px;
  padding:0px 10px;
}

.graphTabs {
  width: 100%; display: flex; flex-direction:column; gap:0; min-height:0; flex:1; margin: 0;
  background-color: color-mix(in srgb, #556 20%, transparent); overflow: hidden;
  border: 1.2px solid color-mix(in srgb, #666 14%, transparent);
  tab-index: 0;
  display: flex;
  flex-direction: column;
  outline: none;
  overflow-y: hidden;
}

[data-part="content"] {
  padding: 0;
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
  font-weight: 400;
}
.tabsTrigger[aria-selected="false"]:hover {
  background-color: color-mix(in srgb, var(--chakra-colors-bg-inverted) 10%, transparent);
  transition: all .1s;
}
.tabsTrigger[aria-selected="true"] {
  background-color: color-mix(in srgb, var(--chakra-colors-bg-inverted) 5%, transparent);
  font-weight: 500;
}

.smIcon { width: 12px; height: 12px; }

.search-line {
  padding: 8px;
  background-color: color-mix(in srgb, #445 40%, transparent);
  border-bottom: 1px solid color-mix(in srgb, #666 60%, transparent);
}
.search-line input {
  width: 100%;
  background-color: rgba(0,0,0,0.3);
  color: white;
  padding: 4px 8px;
  border: 1px solid gray;
  border-radius: 3px;
  outline: 0;
  font-size: 12px;
}


.tabs-tree-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

.save-badge {
  display: flex;
  position: fixed;
  left: 50%;
  z-index: 9999;
  align-items: center;

  background-color: color-mix(in srgb, var(--chakra-colors-green-500) 80%, transparent);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--chakra-colors-bg) 15%, transparent);
  padding: 16px 8px;
  border-radius: 8px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  font-weight: 500;
  font-size: 13px;

  transform: translateX(-50%);
}
`;



const Search = forwardRef(({init_input_str}:any, _ref:any)=>{
  const inputRef = useRef(null) as any;
  const [searchInput, setSearchInput] = useState(init_input_str||"");
  // useImperativeHandle(ref, ()=>{
  // })
  return (
    <Box className="search-line">
      <input
        ref={inputRef} value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
        placeholder="Search... (Esc to close)"
        onKeyDown={(e:any) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            setSearchInput("");
          }
        }}
      />
    </Box>
  )
})



export const Editor=forwardRef(({}:any,ref:any)=>{
  const[mode,setMode]=useState('eg') as any;
  const {id, name, searchRef, selfRef, blocks, owner, collaborators}=useGraphCtx() as any;
  const [isSearchOpen, _setIsSearchOpen] = useState(false);
  const feedRef = useRef(null);
  const treeRef = useRef(null) as any;
  const fsRef = useRef(10);
  const {
    open: _openMenu,
    close: _closeMenu,
    props: menuProps
  } = useContextMenu();
  const curName = useRef(name);
  const currentUser = store.getState().user;
  // check if user among collaborators
  // if (!currentUser || !owner ||!currentUser.$id || !collaborators.current) {
  //   return
  // }
  let isOwner = !!currentUser && !!owner && currentUser.$id === owner;
  Object.keys(collaborators?.current||{}).map((c:any)=>{
    isOwner = isOwner || (currentUser.$id === c);
  })
  const readOnly = !isOwner;

  const [blocksData, setBlocksData] = useState(blocks || []);
  const [showSaveBanner, setShowSaveBanner] = useState(false);
  const blocksDataRef = useRef(blocksData);
  const initialUnifiedBlocks = useMemo(() => {
    return convertNestedToUnifiedBlocks(blocksData);
  }, []);



  const saveGraph = useCallback(async (isAutoSave = false) => {
    try {
      const unifiedBlocks = treeRef.current?.getBlocks() || [];
      const obviousBlocs = buildNestedTreeFromUnified(unifiedBlocks)
      const updatedFields = {
        content: JSON.stringify(obviousBlocs),
        name: curName.current,
      };
      await gReq.update(id, updatedFields);
      if (!isAutoSave) {
        console.info('Graph saved successfully');
        setShowSaveBanner(true);
        setTimeout(() => setShowSaveBanner(false), 1500); 
      }
      blocksDataRef.current = unifiedBlocks;
      setBlocksData(unifiedBlocks);
      
    } catch (error) {
      console.error("Failed to save graph:", error);
    }
  }, [id]);



  const handleGlobalKeyDown = useTreeKeyboard({
    setBlocksData,
    saveGraph,
    readOnly,
  });



  useImperativeHandle(ref, () => ({
    setPopup: () => {},
    setHeader: () => {},
    setMode: (m:any) => {setMode(m)},
    getMode: () => mode,
    getName: () => curName,
    getFontSize: () => fsRef,
    setFontSize: (v:any) => fsRef.current = v,
    getMinigraphIds: () => treeRef.current?.getMinigraphIds?.() || [],
    subscribeMinigraphIds: (cb: any) => treeRef.current?.subscribeMinigraphIds?.(cb),
    clearMinigraphIds: () => treeRef.current?.clearMinigraphIds?.(),
  }));



  return (
    <Tabs.Root
      ref={ref}
      css={editorCSS}
      value={mode}
      variant="plain"
      className={'graphTabs'}
      onKeyDown={handleGlobalKeyDown}
    >
      <UpperHeader selfRef={selfRef} treeRef={treeRef} editorRef={ref} readOnly={readOnly} />

      <Box className={'save-badge'} top={showSaveBanner? "20px":"-50px"} opacity={showSaveBanner? 1 : 0}>
        <RiSaveFill /> Успешно сохранено
      </Box>

      <Tabs.Content value={'eg'} className={'tabs-tree-content'}>
        {isSearchOpen && (<Search ref={searchRef}/>)}

        <UnifiedTreeView
          ref={treeRef}
          initialBlocks={initialUnifiedBlocks}
          fontSize={fsRef.current}
          mainTree
          readOnly={readOnly}
          onSave={() => {
            const unifiedBlocks = treeRef.current?.getBlocks() || [];
            const parsedBlocks = buildNestedTreeFromUnified(unifiedBlocks);
            setBlocksData(parsedBlocks);
          }}
        />
        <ContextMenu {...menuProps} items={[]} />
      </Tabs.Content>

      <Tabs.Content value={'repeat'} overflowY={'hidden'} style={{flex:1, minHeight:0}}>
        <Feed ref={feedRef} />
      </Tabs.Content>
    </Tabs.Root>
  )
});