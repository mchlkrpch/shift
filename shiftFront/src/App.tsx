import { createContext, useContext, useState } from "react";
import { Box } from "@chakra-ui/react";
import { Card } from "./sh/card/card";
import 'katex/dist/katex.min.css';

interface SpEditorI {
	// id: string;
	// current editor mode to display
	// mode: EditorModeTp; setMode: (m: EditorModeTp)=>void;
	// user views (including canonical partitioning)
	// views: any; setViews: (vs: any)=>void;

	// current subgraph to view content
	// g:SpSubgraphView;setG: (g: SpSubgraphView)=>void;
	// saveG:SpSubgraphView,setSaveG:(g: SpSubgraphView)=>void;
	ns:any;setNs:any;
	// saveNs:any,setSaveNs:any;
	// es:any;setEs:any;
	
	// selectedNs:any;setSelectedNs:any;
	// progress:any;setProgress:any;
	// editViewMode:any;setEditViewMode:any;
	
	// editor panel instance
	// editor:any;setEditor:any;
	// id of current considered view
	// viewId:string;setViewId:(id:string)=>void;
	// ranker:any,
	// isMobile:boolean;
	// nodesToSave:Set<string>;setNodesToSave:(n:any)=>void;
	// feedRef:any;
}

export const GraphCtx = createContext<SpEditorI|null>(null);
export const useGraphCtx = ()=>{
	const ctx = useContext(GraphCtx);
	if (!ctx) {
		throw new Error('use graph context');
	}
	return ctx;
}

const cntStr=`first
@@@
second<id=2>third<id=2>fourth
\`\`\`python
import typing;
def add_numbers(a, b)->typng.Any:
	"""Function to return the sum of two numbers."""
	return a + b
\`\`\`
===
second
@@@
segssges sgds
`;
const inner2:string=`inner
@@@
inner complex definition of something <id=3>`;
const inner3:string=`inner second def
@@@
more simple definition`;

const ns: object={
  '1': cntStr,
  '2': inner2,
  '3': inner3,
};

// const cntStr=`first
// ---
// first
// ===
// second
// ---
// second
// ===
// third
// ---
// third
// ===
// fourth
// ---
// fourth
// ===
// fifth
// ---
// fifth
// `

function App() {
  const [curNs,setNs]=useState(ns) as any;
  return (
    <>
      <Box
        w={'400px'}
        p={'10px'}
      >
        <GraphCtx.Provider value={{
          ns:curNs,setNs:setNs,
        }}>
          <Card
            id={'1'}
            content={cntStr}
            tp={'ghost'}
          />
        </GraphCtx.Provider>
      </Box>
    </>
  )
}

export default App
