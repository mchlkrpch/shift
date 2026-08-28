import { createContext, useContext } from "react";
import 'katex/dist/katex.min.css';

interface SpEditorI {
	ns?:any;setNs?:any;       // nodes with content
	groups?:any,setGroups?:any, // inner hierarchy in graph

	gRef?:any,    // Graph's-forwardRef reference
	id?:string,   // Appwrite ID of the graph
	name?:string, // name of the graph
	repeats?:any,setRepeats?:any,

	minigraphRef?:any, setMinigraphRef?: any; // minigraph configure
	headerRef?:any, setHeaderRef?: any; // for setup header special elements
	// feedRef?:any, setFeedRef?: any;   // feed configure
	// treeRef?:any, setTreeRef?: any; // treeview configure
	selfRef:any,
	blocks:any,setBlocks:any,
}

export const GraphCtx = createContext<SpEditorI|null>(null);
export const useGraphCtx = ()=>{
	const ctx = useContext(GraphCtx);
	if (!ctx) {
		throw new Error('use graph context');
	}
	return ctx;
}

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
