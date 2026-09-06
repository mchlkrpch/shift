/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import {
  forwardRef,
  useRef,
  useState,
  useImperativeHandle,
} from 'react';
import {
  Box,
  Tabs,
} from "@chakra-ui/react";
import '@xyflow/react/dist/style.css';
import { Feed } from "./feed/feed";
import { ContextMenu, useContextMenu } from "./contextMenu";
import { Header } from "../../components/header";
import { TreeView } from "./tree/treeview";
import { useGraphCtx } from "../../App";



export const editorCSS = css`
display:flex;
flex:1;
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
  display: flex; border-radius: 5px; height: 20px; padding: 2px 5px; gap: 2px;
  min-width: fit-content; align-content: center; justify-content: center; border: 1.2px solid transparent;
}
.tabsTrigger[aria-selected="false"]:hover { background-color: color-mix(in srgb, white 10%, transparent); color: white; transition: all .1s; }
.tabsTrigger[aria-selected="true"] { background-color: color-mix(in srgb, #556 40%, transparent); }

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
`;

const Search = forwardRef(({init_input_str}:any, ref:any)=>{
  const inputRef = useRef(null) as any;
  const [searchInput, setSearchInput] = useState(init_input_str||"");

  useImperativeHandle(ref, ()=>{

  })
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
  const {headerRef,searchRef}=useGraphCtx() as any;
  const [isSearchOpen, _setIsSearchOpen] = useState(false);
  const feedRef = useRef(null);
  const treeRef=useRef(null) as any;
  const { open: _openMenu, close: _closeMenu, props: menuProps } = useContextMenu();
  // const minigraphRef = useRef(null) as any;
  // const minigraphProps=useState<{
  //   isOpen:boolean,
  //   id:any,type:string,
  //   targetNodes:string[],targetGroups:string[],
  //   x:number,y:number,
  //   ns:any,groups:any,
  //   onClose:any,onDelete:any,onRepeat:any,
  // }>({isOpen:false,} as any) as any;

  useImperativeHandle(ref,()=>({
    setPopup: ()=>{},
    setHeader: ()=>{},
    setMode: (m:any)=>{
      setMode(m)
      // console.log('m:',m)
    },
    getMode: ()=>mode,
  }));


  return (
    <Tabs.Root
      ref={ref}
      css={editorCSS}
      value={mode}
      variant="plain"
      className={'graphTabs'}
    >
      <Header ref={headerRef}/>
      <Tabs.Content value={'eg'}
        overflowY={'hidden'}
      >
        {isSearchOpen && (<Search ref={searchRef}/>)}

        <TreeView ref={treeRef} />

        <ContextMenu {...menuProps} items={[]} />
      </Tabs.Content>

      <Tabs.Content value={'repeat'} overflowY={'hidden'} style={{ flex: 1, minHeight: 0 }}>
        <Feed ref={feedRef} />
      </Tabs.Content>
    </Tabs.Root>
  )
});