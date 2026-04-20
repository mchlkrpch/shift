// import createStore from 'redux/dist/redux.min.js';

import { createStore } from 'redux';
//import * as Redux from 'redux';
//const createStore = Redux.createStore;
// import { legacy_createStore as createStore } from 'redux';
// import { configureStore } from '@reduxjs/toolkit';

const initState = {
	// user of current session
	user: null,
	userData: null,

	// components seciton inside initState
	// dictionary[nm_of_component: str, component: any]
	components: {},
	// nodes elements dictionary
	ns: {},
	ns_to_repeat: {},

	g_id: "",
	g: {},
	owner: {},
	// keyboard state to handle shortucts
	keyboard: {},
	inner_blocks: {},

	header_ref: null,
}

const reducer = (state = initState, action: any) => {
	switch (action.type) {
		case 'set_g':
			return {
				...state,
				g: action.payload,
			}

		case 'keydown':{
			const new_keyboard: any = state.keyboard
			new_keyboard[action.payload] = true
			return {
				...state,
				keyboard: new_keyboard,
			}
		}

		case 'keyup': {
			const new_keyboard: any = state.keyboard
			new_keyboard[action.payload] = false
			return {
				...state,
				keyboard: new_keyboard,
			}
		}
		
		case 'set_user':
			// set authorized user to redux-storage
			return {
				...state,
				user: action.payload[0],
				userData: action.payload[1],
			}

		case 'set_current_owner':
			// set authorized user to redux-storage
			return {
				...state,
				owner: action.payload,
			}
		
		case 'set_g_id':
			return {
				...state,
				g_id: action.payload,
			}
		
		case 'set_ns_to_repeat':
			return {
				...state,
				ns_to_repeat: action.payload,
			}
		
		case 'load_component':{
			const components: any = state.components
			const component_key = action.payload.key
			const component = action.payload.component
			components[component_key] = component
			return {
				...state,
				components: components,
			}
		}

		case 'load_n': {
			const ns: any = state.ns
			const d = action.payload
			if (d.data.id != undefined) {
				ns[d.data.id] = {
					data: d.data,
					select: d.select,
					el_ref: d.el_ref,
					badges: d.badges
				}
			}
			return {...state, ns: ns}
		}

		case 'load_inner_block': {
			const inner_blocks = state.inner_blocks as any;
			inner_blocks[action.payload.id] = action.payload.value
			return {
				...state,
				inner_blocks: inner_blocks
			}
		}

		case 'set_header': {
			return {
				...state,
				header_ref: action.payload,
			}
		}

		default:
			return state
	}
}

const store = createStore(reducer)

export default store