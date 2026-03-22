import { Account, Client, Databases, Permission, Query, Role, TablesDB } from "appwrite";
import store from "../storage";

const DATABASE_ID:string='69bdb002002e102b695c';
const PROJECT_ID:string ='69baae7d0010fa0c541d';
const NODE_ID:string    ='nodes';
// const USER_ID:string    ='user';
const USER_ID:string='user'

export const spaced_client = new Client()
    .setEndpoint('https://fra.cloud.appwrite.io/v1')
    .setProject(PROJECT_ID);
export const spaced_account = new Account(spaced_client);
export const spaced_databases = new Databases(spaced_client);

export const getNode = async () => {
	try {
		const response = await spaced_databases
            .listDocuments(
                DATABASE_ID,
                NODE_ID,
            );
		return response.documents;
	} catch (error) {
		console.error('Error fetching users:', error);
		return [];
	}
};

async function UD_create(u: any) {
	try {
		console.log('ud create:',u)
		const cell = {
			// 0: JSON.stringify(u),
			'username': u.name,
			'email': u.email,
			'photo_url': null,
			'bio': '',
		}
		await spaced_databases.createDocument(
			DATABASE_ID,
			USER_ID,
			u.$id,
			cell,
		)
		return cell
	} catch(e) {
		console.error('ud_create:', e)
	}
}

export const getUser = async (id:string) => {
	try {
		const response = await spaced_databases.listDocuments(
			DATABASE_ID,
			USER_ID,
			[
				Query.equal('$id', id),
				Query.limit(1),
			],
		);
		return response.documents[0];
	} catch (error) {
		console.error('Error fetching users:', error);
		return [];
	}
};

export const getUserData = async (u: any) => {
	// get all users from collection
	const response = await spaced_databases.listDocuments(
		DATABASE_ID,
		USER_ID,
		[
			Query.equal('$id', u.$id),
			Query.limit(1)
		]
	)
	const found = response.documents.length > 0
	console.log('response.documents',response.documents)
	
	if (found == true) {
		const ud =  response.documents[0]
		if (ud.repeats === null||ud.repeats===undefined) {
			ud.repeats = {};
		} else {
			ud.repeats = JSON.parse(ud.repeats);
		}
		console.log('ud[getUserData]:', ud);
		return ud;
	}
	const ud = await UD_create(u)
	return ud
};

export async function updateUserData(
	user: any,
	userData: any,
	force_replace: boolean=false,
) {
	const response = await spaced_databases.listDocuments(
		DATABASE_ID,
		USER_ID,
		[
			Query.equal('$id', user.$id),
			Query.limit(1)
		]
	);
	const found = response.documents.length > 0
	if (found && force_replace) {
		const newUserData = {
			'username': userData.username,
			'photo_url': userData.photo_url,
			'bg_url': userData.bg_url,
			'bio': userData.bio,
			'repeats': JSON.stringify(userData.repeats),
		}
		await spaced_databases.updateDocument(
			DATABASE_ID,
			USER_ID,
			user.$id,
			newUserData,
		);
		newUserData.repeats = JSON.parse(newUserData.repeats||'{}')
		store.dispatch({
			type:'set_user',
			payload: [user,newUserData],
		})
	}
	if (!found) {
		await UD_create(user)
	}
}

export async function fetch_user(acc: any) {
	try {
		const u = await acc.get();
		const ud = await getUserData(u)
		console.log('ud in fetch user:', ud)
		store.dispatch({
			type: 'set_user',
			payload: [u, ud]
		})
		const auth_el = store.getState().components['SpaceRouter']
		auth_el.setState({
			user: u,
		})
		return u
	} catch(e:any) {
		console.error('[fetch_user]',e.code, e)
	}
}