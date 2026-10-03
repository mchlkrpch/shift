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
        CURSORS: '6ac160f900044d467519',
    },
    BASE_URL:'localhost:5173',
};



export const UPDATE_COLLABORATORS_FUNCTION_ID = '6ab2ffe700061b41344f';
export const READ_DOCUMENT_FUNCTION_ID = '6ab43d5a00183b843e42';


import { useEffect, useState, useRef } from 'react';
import { getBlockInfoFromNode } from "../sh/editor/tree/unifiedHooks";

// 1. УМНЫЙ THROTTLE: Отправляет СРАЗУ при первом действии, 
// затем накапливает и отправляет последнюю позицию не чаще чем раз в limit.
const throttleImmediate = (func: Function, limit: number) => {
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let lastRan = 0;

    return (...args: any[]) => {
        const now = Date.now();
        if (now - lastRan >= limit) {
            // Если мы давно не отправляли (или это первый клик) - отправляем МОМЕНТАЛЬНО
            func(...args);
            lastRan = now;
        } else {
            // Если мы печатаем прямо сейчас - ждем конца окна времени и отправляем
            if (timerId) clearTimeout(timerId);
            timerId = setTimeout(() => {
                func(...args);
                lastRan = Date.now();
            }, limit - (now - lastRan));
        }
    };
};

const getColorForUser = (userId: string) => {
    const hue = parseInt(userId.substring(0, 8), 16) % 360;
    return `hsl(${hue}, 75%, 55%)`;
};

export const useAppwriteCursors = (
    graphId: string, 
    currentUser: { $id: string, name: string },
    editorRef: any,
) => {
    const [cursors, setCursors] = useState<any[]>([]);
    const cursorsMapRef = useRef<Map<string, any>>(new Map());
    const userNamesCacheRef = useRef<Map<string, string>>(new Map());
    
    // Флаг, который показывает, что по сети пришли новые данные
    const isDirtyRef = useRef(false);

    const updateCursorsState = () => {
        const newCursors: any[] = [];
        const missingUserIds: string[] = [];

        for (const [userId, cursor] of cursorsMapRef.current.entries()) {
            if (!userNamesCacheRef.current.has(userId)) {
                missingUserIds.push(userId);
                userNamesCacheRef.current.set(userId, '...'); 
            }
            newCursors.push({
                ...cursor,
                name: userNamesCacheRef.current.get(userId),
                color: getColorForUser(userId)
            });
        }
        setCursors(newCursors);

        missingUserIds.forEach(async (uid) => {
            try {
                const response = await spaced_databases.listDocuments(
                    APPWRITE_CONFIG.DATABASE_ID,
                    APPWRITE_CONFIG.COLLECTIONS.USERS_ID,
                    [Query.equal('$id', uid), Query.limit(1)]
                );
                const name = response.documents.length > 0 ? response.documents[0].username : 'Аноним';
                userNamesCacheRef.current.set(uid, name);
                
                // Форсируем обновление UI, когда имя подгрузилось
                isDirtyRef.current = true;
            } catch (e) {
                userNamesCacheRef.current.set(uid, 'Аноним');
            }
        });
    };

    // [СЛУШАТЕЛЬ REALTIME] — Сохраняем в фоне, UI не трогаем
    useEffect(() => {
        if (!graphId || !currentUser) return;

        const unsubscribe = spaced_client.subscribe(
            `databases.${APPWRITE_CONFIG.DATABASE_ID}.collections.${APPWRITE_CONFIG.COLLECTIONS.CURSORS}.documents`,
            (response: any) => {
                const data = response.payload;
                if (data.graphId !== graphId || data.userId === currentUser.$id) return;

                if (response.events.includes('databases.*.collections.*.documents.*.delete')) {
                    cursorsMapRef.current.delete(data.userId);
                } else {
                    cursorsMapRef.current.set(data.userId, data);
                }
                
                // Просто ставим флаг, что данные обновились
                isDirtyRef.current = true; 
            }
        );

        return () => unsubscribe();
    }, [graphId, currentUser]);

    // [ЧИТАЮЩИЙ ТАЙМЕР] — Рендерит курсоры раз в 300мс (и делает Garbage Collection)
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            
            // 1. Очистка старых курсоров
            for (const [userId, cursor] of cursorsMapRef.current.entries()) {
                if (now - cursor.updatedAt > 15000) { // 15 секунд неактивности
                    cursorsMapRef.current.delete(userId);
                    isDirtyRef.current = true;
                }
            }

            // 2. Обновляем React-стейт ТОЛЬКО если были изменения
            if (isDirtyRef.current) {
                updateCursorsState();
                isDirtyRef.current = false;
            }
        }, 300); // 300мс = ~3 кадра в секунду (оптимально для курсоров)

        return () => clearInterval(interval);
    }, []);

    // 3. [ОТПРАВЛЯЮЩИЙ БЛОК] — Работает через throttleImmediate
    useEffect(() => {
        if (!graphId || !currentUser) return;

        // ❗️ ИСПРАВЛЕНИЕ 1: Документ курсора должен принадлежать конкретному юзеру
        const cursorDocId = currentUser.$id;

        const rawSendToAppwrite = async (blockId: string, offset: number) => {
            console.log(`🚀 [Appwrite] Фактическая отправка в БД! Block: ${blockId}, Offset: ${offset}`);
            
            // ❗️ ИСПРАВЛЕНИЕ 2: Убрали $id и $updatedAt. 
            // Appwrite принимает ID документа как отдельный аргумент, а не внутри тела.
            // updatedAt - это ваше кастомное поле базы, оно должно быть без знака $.
            const payload = {
                graphId,
                userId: currentUser.$id,
                blockId,
                offset,
                $updatedAt: Date.now(), 
            };

            try {
                // Пытаемся обновить существующий документ
                await spaced_databases.updateDocument(
                    APPWRITE_CONFIG.DATABASE_ID,
                    APPWRITE_CONFIG.COLLECTIONS.CURSORS,
                    cursorDocId,
                    payload,
                );
            } catch (error: any) {
                // Если документа нет (ошибка 404), создаем его
                if (error.code === 404) {
                    try {
                        await spaced_databases.createDocument(
                            APPWRITE_CONFIG.DATABASE_ID,
                            APPWRITE_CONFIG.COLLECTIONS.CURSORS,
                            cursorDocId,
                            payload,
                            [
                                Permission.read(Role.users()), 
                                Permission.update(Role.user(currentUser.$id)),
                                Permission.delete(Role.user(currentUser.$id)),
                            ]
                        );
                    } catch (createError) {
                        console.error("❌ Appwrite Create Cursor Error:", createError);
                    }
                } else {
                    console.error("❌ Appwrite Update Cursor Error:", error);
                }
            }
        };

        const throttledSendCursor = throttleImmediate(rawSendToAppwrite, 400);

        const handleSelectionChange = () => {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0 || !editorRef.current) return;
            
            const range = sel.getRangeAt(0);
            if (!editorRef.current.contains(range.startContainer)) return;

            let blockId: string | null | undefined = null;
            let offset = 0;

            try {
                const info = getBlockInfoFromNode(range.startContainer, range.startOffset, editorRef.current);
                if (info) {
                    blockId = info.blockElement.closest('.tv-block-wrapper')?.getAttribute('data-id');
                    offset = info.offset;
                }
            } catch (e) {}

            if (!blockId) {
                const node = range.startContainer.nodeType === Node.ELEMENT_NODE 
                    ? (range.startContainer as Element) 
                    : range.startContainer.parentElement;
                
                const wrapper = node?.closest('.tv-block-wrapper');
                if (wrapper) {
                    blockId = wrapper.getAttribute('data-id');
                    offset = range.startOffset; 
                }
            }

            if (blockId) {
                throttledSendCursor(blockId, offset);
            }
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (!editorRef.current || !editorRef.current.contains(e.target as Node)) return;
            setTimeout(() => { handleSelectionChange(); }, 0);
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                setTimeout(handleSelectionChange, 0);
            }
        };

        const handleForceCursor = (e: Event) => {
            const customEvent = e as CustomEvent;
            const { blockId, offset } = customEvent.detail;
            console.log(`⚡ [Appwrite] Принудительная отправка курсора: Block ${blockId}, Offset ${offset}`);
            rawSendToAppwrite(blockId, offset);
        };

        document.addEventListener('selectionchange', handleSelectionChange);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('keyup', handleKeyUp);
        document.addEventListener('force-appwrite-cursor', handleForceCursor);

        return () => {
            document.removeEventListener('selectionchange', handleSelectionChange);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('keyup', handleKeyUp);
            document.removeEventListener('force-appwrite-cursor', handleForceCursor);
            
            spaced_databases.deleteDocument(
                APPWRITE_CONFIG.DATABASE_ID,
                APPWRITE_CONFIG.COLLECTIONS.CURSORS,
                cursorDocId
            ).catch(() => {});
        };
    }, [graphId, currentUser, editorRef]);

    // Инициальная загрузка существующих курсоров
    useEffect(() => {
        if (!graphId) return;
        spaced_databases.listDocuments(
            APPWRITE_CONFIG.DATABASE_ID,
            APPWRITE_CONFIG.COLLECTIONS.CURSORS,
            [Query.equal('graphId', graphId)]
        ).then(res => {
            const now = Date.now();
            res.documents.forEach(doc => {
                if (doc.userId !== currentUser.$id && now - doc.updatedAt <= 15000) {
                    cursorsMapRef.current.set(doc.userId, doc);
                }
            });
            isDirtyRef.current = true;
        }).catch(() => {});
    }, [graphId]);

    return cursors;
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