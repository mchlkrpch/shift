import { createContext, useContext } from "react";
import 'katex/dist/katex.min.css';

interface SpEditorI {
	ns?:any;setNs?:any;       // nodes with content
	groups?:any,setGroups?:any, // inner hierarchy in graph

	gRef?:any,    // Graph's-forwardRef reference
	id?:string,   // Appwrite ID of the graph
	name?:string, // name of the graph
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
