import { Databases, ID, Query, Client, Account, type Models, Permission, Role } from "appwrite";
import store from "../storage";


export const APPWRITE_CONFIG = {
    ENDPOINT: 'https://fra.cloud.appwrite.io/v1',
    PROJECT_ID: '69baae7d0010fa0c541d',
    DATABASE_ID: '69bdb002002e102b695c',
    COLLECTIONS: {
        USERS_ID: 'user',
        NODES: 'nodes',
        CARDS: 'cards',
        GRAPHS_ID: 'graphs',
    }
};


export class Repo<T extends Models.Document> {
	protected db: Databases;
    protected dbId: string;
    protected colId: string;

    constructor(db: Databases, dbId: string, colId: string) {
        this.db = db;
        this.dbId = dbId;
        this.colId = colId;
    }

    async create(data: any, documentId: string = ID.unique()): Promise<T> {
        try {
            const user = await spaced_account.get();
		    const userId = user.$id;
            return await this.db.createDocument<T>(
                this.dbId,
                this.colId,
                documentId,
                data,
                [
                    Permission.read(Role.any()),
                    Permission.update(Role.user(userId)),
                    Permission.delete(Role.user(userId)),
                ]
            );
        } catch (error) {
            console.error(`[create] Error in ${this.colId}:`, error);
            throw error;
        }
    }

    async read(id: string): Promise<T|null> {
        try {
            const response = await this.db.listDocuments<T>(
                this.dbId,
                this.colId,
                [Query.equal('$id', id), Query.limit(1)]
            );
            return response.documents.length > 0 ? response.documents[0] : null;
        } catch (error) {
            console.error(`[read] Error in ${this.colId}:`, error);
            return null;
        }
    }

    async search(filters:any): Promise<T[]|null> {
        try {
            const response = await this.db.listDocuments<T>(
                this.dbId,
                this.colId,
                filters,
            );
            return response.documents.length > 0 ? response.documents : null;
        } catch (error) {
            console.error(`[read] Error in ${this.colId}:`, error);
            return null;
        }
    }

    async list(queries: string[] = []): Promise<T[]> {
        try {
            const response = await this.db.listDocuments<T>(
                this.dbId,
                this.colId,
                queries
            );
            return response.documents;
        } catch (error) {
            console.error(`[list] Error in ${this.colId}:`, error);
            return [];
        }
    }

    async update(id: string, data: any): Promise<T> {
        try {
            return await this.db.updateDocument<T>(
                this.dbId,
                this.colId,
                id,
                data,
            );
        } catch (error) {
            console.error(`[update] Error in ${this.colId}:`, error);
            throw error;
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.db.deleteDocument(
                this.dbId,
                this.colId,
                id
            );
        } catch (error) {
            console.error(`[delete] Error in ${this.colId}:`, error);
            throw error;
        }
    }
}


export const spaced_client = new Client()
    .setEndpoint(APPWRITE_CONFIG.ENDPOINT)
    .setProject(APPWRITE_CONFIG.PROJECT_ID);

export const spaced_account = new Account(spaced_client);
const spaced_databases = new Databases(spaced_client);

// export const nReq = new Repo(spaced_databases, APPWRITE_CONFIG.DATABASE_ID, APPWRITE_CONFIG.COLLECTIONS.NODES);
// export const cReq = new Repo(spaced_databases, APPWRITE_CONFIG.DATABASE_ID, APPWRITE_CONFIG.COLLECTIONS.CARDS);
export const gReq = new Repo(spaced_databases, APPWRITE_CONFIG.DATABASE_ID, APPWRITE_CONFIG.COLLECTIONS.GRAPHS_ID);

class UserService extends Repo<any> {
    async create(u: any) {
        try {
            const cell = {
                'username': u.name,
                'email': u.email,
                'photo_url': null,
                'bio': '',
            }
            await spaced_databases.createDocument(
                this.dbId,
                this.colId,
                u.$id,
                cell,
            )
            return cell
        } catch(e) {
            console.error('ud_create:', e)
	    }
    }

    async getUserData(u:any) {
        const response = await spaced_databases.listDocuments(
            this.dbId,
            this.colId,
            [
                Query.equal('$id', u.$id),
                Query.limit(1)
            ]
        )
        const found = response.documents.length > 0
        if (found == true) {
            const ud =  response.documents[0]
            if (ud.repeats === null||ud.repeats===undefined) {
                ud.repeats = {};
            } else {
                ud.repeats = JSON.parse(ud.repeats);
            }
            return ud;
        }
        const ud = await this.create(u)
        return ud
    }
}

export const uReq = new UserService(spaced_databases, APPWRITE_CONFIG.DATABASE_ID, APPWRITE_CONFIG.COLLECTIONS.USERS_ID);


// import { Account, Client, Databases, Permission, Query, Role, TablesDB } from "appwrite";
// import store from "../storage";

// const PROJECT_ID:string ='69baae7d0010fa0c541d';
// const DATABASE_ID:string='69bdb002002e102b695c';
// const NODE_ID:string    ='nodes';
// // const USER_ID:string    ='user';
// const USER_ID:string='user'

// export const spaced_client = new Client()
//     .setEndpoint('https://fra.cloud.appwrite.io/v1')
//     .setProject(PROJECT_ID);
// export const spaced_account = new Account(spaced_client);
// export const spaced_databases = new Databases(spaced_client);

// export const getNode = async () => {
// 	try {
// 		const response = await spaced_databases
//             .listDocuments(
//                 DATABASE_ID,
//                 NODE_ID,
//             );
// 		return response.documents;
// 	} catch (error) {
// 		console.error('Error fetching users:', error);
// 		return [];
// 	}
// };

// async function UD_create(u: any) {
// 	try {
// 		console.log('ud create:',u)
// 		const cell = {
// 			'username': u.name,
// 			'email': u.email,
// 			'photo_url': null,
// 			'bio': '',
// 		}
// 		await spaced_databases.createDocument(
// 			DATABASE_ID,
// 			USER_ID,
// 			u.$id,
// 			cell,
// 		)
// 		return cell
// 	} catch(e) {
// 		console.error('ud_create:', e)
// 	}
// }

// export const getUser = async (id:string) => {
// 	try {
// 		const response = await spaced_databases.listDocuments(
// 			DATABASE_ID,
// 			USER_ID,
// 			[
// 				Query.equal('$id', id),
// 				Query.limit(1),
// 			],
// 		);
// 		return response.documents[0];
// 	} catch (error) {
// 		console.error('Error fetching users:', error);
// 		return [];
// 	}
// };

// export const getUserData = async (u: any) => {
// 	// get all users from collection
// 	const response = await spaced_databases.listDocuments(
// 		DATABASE_ID,
// 		USER_ID,
// 		[
// 			Query.equal('$id', u.$id),
// 			Query.limit(1)
// 		]
// 	)
// 	const found = response.documents.length > 0
// 	console.log('response.documents',response.documents)
	
// 	if (found == true) {
// 		const ud =  response.documents[0]
// 		if (ud.repeats === null||ud.repeats===undefined) {
// 			ud.repeats = {};
// 		} else {
// 			ud.repeats = JSON.parse(ud.repeats);
// 		}
// 		console.log('ud[getUserData]:', ud);
// 		return ud;
// 	}
// 	const ud = await UD_create(u)
// 	return ud
// };

// export async function updateUserData(
// 	user: any,
// 	userData: any,
// 	force_replace: boolean=false,
// ) {
// 	const response = await spaced_databases.listDocuments(
// 		DATABASE_ID,
// 		USER_ID,
// 		[
// 			Query.equal('$id', user.$id),
// 			Query.limit(1)
// 		]
// 	);
// 	const found = response.documents.length > 0
// 	if (found && force_replace) {
// 		const newUserData = {
// 			'username': userData.username,
// 			'photo_url': userData.photo_url,
// 			'bg_url': userData.bg_url,
// 			'bio': userData.bio,
// 			'repeats': JSON.stringify(userData.repeats),
// 		}
// 		await spaced_databases.updateDocument(
// 			DATABASE_ID,
// 			USER_ID,
// 			user.$id,
// 			newUserData,
// 		);
// 		newUserData.repeats = JSON.parse(newUserData.repeats||'{}')
// 		store.dispatch({
// 			type:'set_user',
// 			payload: [user,newUserData],
// 		})
// 	}
// 	if (!found) {
// 		await UD_create(user)
// 	}
// }

export async function fetch_user(acc: any) {
	try {
		const u = await acc.get();
		const ud = await uReq.getUserData(u)
		store.dispatch({
			type: 'set_user',
			payload: [u,ud]
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