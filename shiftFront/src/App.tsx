import { createContext, useContext } from "react";
import 'katex/dist/katex.min.css';

interface SpEditorI {
	ns?:any;setNs?:any;
	gRef?:any,
	id?:string,
	name?:string,
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
