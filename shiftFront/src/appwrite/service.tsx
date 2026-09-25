import { Databases, ID, Query, Client, Account, type Models, Permission, Role, Functions } from "appwrite";
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
    },
    BASE_URL:'localhost:5173',
};



export const UPDATE_COLLABORATORS_FUNCTION_ID = '6ab2ffe700061b41344f';
export const READ_DOCUMENT_FUNCTION_ID = '6ab43d5a00183b843e42';


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
					// return await this.db.updateDocument<T>(
					//     this.dbId,
					//     this.colId,
					//     id,
					//     data,
					// );
					const execution = await spaced_functions.createExecution(
							UPDATE_COLLABORATORS_FUNCTION_ID,
							JSON.stringify({
								databaseId: this.dbId,
								tableId: this.colId,
								id,
								data,
							}),
						false,
					);

					const body = JSON.parse(execution.responseBody || '{}');
					if (execution.responseStatusCode >= 400) {
						throw new Error(body.error || 'Failed to update graph content');
					}
					return body;
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

// export const UPDATE_COLLABORATORS_FUNCTION_ID = '6ab2ffe700061b41344f';
// export const READ_DOCUMENT_FUNCTION_ID = '6ab43d5a00183b843e42';

export const spaced_account = new Account(spaced_client);
const spaced_databases = new Databases(spaced_client);
export const spaced_functions = new Functions(spaced_client);
// export async function updateGraphCollaborators(
//   graphId,
//   collaborators,
// ) {
//   const execution = await spaced_functions.createExecution(
//     UPDATE_COLLABORATORS_FUNCTION_ID,
//     JSON.stringify({
//       databaseId: APPWRITE_CONFIG.DATABASE_ID,
//       tableId: APPWRITE_CONFIG.COLLECTIONS.GRAPHS_ID,
//       graphId,
//       collaborators,
//     }),
//     false,
//   );
//   const body = JSON.parse(execution.responseBody || '{}');
//   if (execution.responseStatusCode >= 400) {
//     throw new Error(body.error || 'Failed to update collaborators');
//   }
//   return body;
// }


export async function updateGraphCollaborators(
  graphId: string,
  data: { content?: string; name?: string; groups?: any }
) {
  const execution = await spaced_functions.createExecution(
    UPDATE_COLLABORATORS_FUNCTION_ID,
    JSON.stringify({
      databaseId: APPWRITE_CONFIG.DATABASE_ID,
      tableId: APPWRITE_CONFIG.COLLECTIONS.GRAPHS_ID,
      graphId,
      data,
    }),
    false,
  );
  const body = JSON.parse(execution.responseBody || '{}');
  if (execution.responseStatusCode >= 400) {
    throw new Error(body.error || 'Failed to update graph content');
  }
  return body;
}

export const gReq = new Repo(
    spaced_databases,
    APPWRITE_CONFIG.DATABASE_ID,
    APPWRITE_CONFIG.COLLECTIONS.GRAPHS_ID);

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

    async updateRepeats(gId:string,gRepeats:any) {
        const ud = store.getState().userData;
        const repeats = ud.repeats;
        repeats[gId] = gRepeats;
        ud.repeats = repeats
        await super.update(
            ud.$id,
            {
                repeats: JSON.stringify(repeats),
            },
        )
    }
}

export const uReq = new UserService(
    spaced_databases,
    APPWRITE_CONFIG.DATABASE_ID,
    APPWRITE_CONFIG.COLLECTIONS.USERS_ID);

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

if (typeof window !== 'undefined') {
  (window as any).__debug = {
    // updateGraphCollaborators,
    spaced_account,
    spaced_functions,
    APPWRITE_CONFIG,
  };
}