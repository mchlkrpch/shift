import { createContext, useContext } from "react";
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
	ref:any,
	// sel:any;setSel:any;
	// sel:any, //set_ns_s_ref:any,
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
import { Provider } from 'react-redux';
import store from "./storage";
import SpaceRouter from "./pages/auth";
import { BrowserRouter } from "react-router-dom";
import { NavigateSetter } from "./pages/utils";

function App() {
  return (
    <>
		<Provider store={store}>
		<BrowserRouter>
			<NavigateSetter />
			<SpaceRouter />
		</BrowserRouter>
		</Provider>
    </>
  )
}

export default App
