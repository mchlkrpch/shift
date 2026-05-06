/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';
// @ts-expect-error: to ignore empy import react 
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
	HStack,
	Input,
	VStack,
	Box,
	Text,
	Spinner,
	Button,
	Separator,
	Spacer,
	SkeletonText,
	Dialog,
} from '@chakra-ui/react'
import { Image } from "@chakra-ui/react";
import store from '../storage';

import {
	APPWRITE_CONFIG,
	gReq,
	spaced_account,
	uReq,
} from '../appwrite/service';
import {
	logOut
} from './auth';
import {
	GraphCtx
} from '../App';
import {
	Header
} from '../components/header';
import {
	Card
} from '../sh/card/card';
import {
	History
} from './utils';
import {
	ID,
	Query
} from 'appwrite';
import {
	GraphPage
} from './graph';
import {
	FaShare
} from 'react-icons/fa';
import { HiMiniViewfinderCircle } from "react-icons/hi2";
import { RiDeleteBin6Line } from "react-icons/ri";
import {
	HiDocumentAdd
} from "react-icons/hi";
import {
	Clip
} from '../sh/clip';
import { ContextMenu, useContextMenu } from '../sh/menu';

export const unknownPhotoUrl: string = "https://i.postimg.cc/MKZzBCG2/spaced-gray.png";

export function SpAvatar(props:any) {
	let url = unknownPhotoUrl
	if (props.src && props.src.slice(0,5)==='https') {
		url=props.src
	}
	return (
		<Box
			border={props.border}
			w={props.w}
			h={props.w}
			rounded={'full'}
			{...props}
			>
			<Image
				w={'100%'}
				h={'100%'}
				rounded={'full'}
				src={url}
				opacity={url===unknownPhotoUrl?0.15:1.0}
			/>
		</Box>
	)
}


const profileStyle=css`
display: flex;
flex-direction: column;
align-items: center;
width: 100%;
max-width: 450px;
margin-left: auto;
margin-right: auto;

.profilePg {
	margin-top: 25px;
	width :100%;
	max-width: 100%;
	mx:10px;
	gap: 20px;
	overflow-y: auto;
	scrollbar-width: none;
}
`;

const inputStackCSS = css`
display: flex;
flex-direction: column;
width: 100%;
align-items: stretch;

.block {
	width: 100%;
	display: flex;
	flex-direction: column;
	border-radius: 10px;

	background-color: color-mix(in srgb, #556 20%, transparent);
	align-items: center;
}

input{
	border: none;
	outline: none;
}

.body {
	display: flex;
	flex-direction: column;

	pdding:0;
	margin:0;

	width: 100%;
	align-items: center;

	gap: 0;
}

.item {
	display: flex;
	flex-direction: row;

	width: 100%;
	cursor: pointer;

	padding: 6px;
	align-items: center;

	font-size: 22px;
	font-weight: 500;
	color: color-mix(in srgb, var(--chakra-colors-fg) 80%, transparent);
}

.item:hover {
	color: color-mix(in srgb, var(--chakra-colors-fg) 100%, transparent);
}
`
export const InputStack=(props:any)=>{
	return (
		<div css={inputStackCSS}>
			<Box className='block'>
				{props.els.map((el:any,i:number)=>{
					if (el.tp === 'input') {
						return (
							<Box p={0}m={0} key={i} w={'100%'} alignItems={'center'} display={'flex'} flexDirection={'column'}>
								{i!==0&&<Separator w={'95%'}/>}
								<Input key={i} ref={el.ref} defaultValue={el.d} placeholder={el.p}/>
							</Box>
						)
					}
					if (el.tp === 'card') {
						const [localNs,setLocalNs]=useState({'0':el.d})
						return (
							<Box className={'body'} key={i}>
								{i!==0&&<Separator w={'95%'}/>}
								<Box m={0} alignItems={'start'} w={'100%'} p={'5px 10px'}>
									<GraphCtx.Provider value={{
										ns:localNs,setNs:setLocalNs,
										gRef:el.ref,
										id:'',
										name:'',
									}}>
										<Card
											ref={el.ref}
											id={'0'}
											content={localNs['0']}
											options={{stats:false,textEdit:false,twoSides:false}}
											focus={false}
											/>
									</GraphCtx.Provider>
								</Box>
							</Box>
						)
					}
					return <></>
				})}
			</Box>
		</div>
	)
}


const DeleteConfirmDialog = ({ 
	graphName, 
	onConfirm, 
	onCancel 
}: { 
	graphName: string; 
	onConfirm: ()=>void; 
	onCancel: ()=>void;
}) => {
	return (
		<Dialog.Root open={true}>
			<Dialog.Backdrop />
			<Dialog.Positioner>
				<Dialog.Content p={'20px'} maxW={'320px'}>
					<Dialog.CloseTrigger />
					<Dialog.Header w={'100%'} p={'0px 20px'}>
						<Dialog.Title fontSize={'16px'} fontWeight={600}>
							Delete graph "{graphName}"?
						</Dialog.Title>
					</Dialog.Header>
					<Dialog.Body 
						w={'100%'} 
						alignItems={'start'} 
						p={'0px 20px'}
						textAlign={'start'} 
						fontSize={'12px'} 
						fontWeight={300}
						color={'color-mix(in srgb, var(--chakra-colors-fg) 70%, transparent)'}
					>
						Content will be deleted without ability to restore it.
						<HStack mt={'20px'} gap={'10px'} w={'100%'}>
							<Button 
								flex={1} 
								variant={'subtle'} 
								onClick={onCancel}
								h={'32px'}
								fontSize={'12px'}
							>
								Cancel
							</Button>
							<Button 
								flex={1} 
								variant={'solid'} 
								colorPalette={'red'} 
								h={'32px'}
								fontSize={'12px'}
								onClick={onConfirm}
							>
								Delete
							</Button>
						</HStack>
					</Dialog.Body>
				</Dialog.Content>
			</Dialog.Positioner>
		</Dialog.Root>
	);
};

const GraphItem = ({ 
	g, 
	onDelete, 
	onGraphRenamed,
}: { 
	g: any; 
	onDelete: (id: string) => void;
	onGraphRenamed?: (id: string, newName: string) => void;
}) => {
    const [_,setHover] = useState(false);
	const [renameVal,setRenameVal] = useState(g.name);
	const [showDeleteDialog,setShowDeleteDialog] = useState(false);
	const menuRef=useRef(null) as any;
	
	const { open, props: menuProps, close } = useContextMenu();

    const handleRename = async (id: string, newName: string) => {
		try {
			await gReq.update(id, { name: newName });
			if (onGraphRenamed) {
				onGraphRenamed(id, newName);
			}
		} catch (err) {
			console.error('Failed to rename graph:', err);
		}
	};
    
    const menuItems: any[] = [
		{
			el: <><HiMiniViewfinderCircle/> <span>View graph</span></>,
			onClick: () => History.push(`/${g.$id}`)
		},
		{
			el: <>rename</>,
			children: [{
				el: (
					<input 
						autoFocus
						placeholder="New name..."
						value={renameVal}
						onChange={(e)=>setRenameVal(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && renameVal.trim()) {
								handleRename(g.$id, renameVal.trim());
								menuRef.current.setPath([])
								close();
							}
						}}
						onClick={(e) => e.stopPropagation()} // ⚠️ чтобы клик не закрывал меню
						style={{ 
							flex: 1, 
							background: 'transparent', 
							color: 'white', 
							border: '1px solid #4a5568', 
							borderRadius: '4px', 
							padding: '4px 8px', 
							fontSize: '12px', 
							outline: 'none' 
						}}
					/>
				)
			}]
		},
		{
			el: <Separator
				borderColor={'color-mix(in srgb, var(--chakra-colors-fg) 10%, transparent)'}
				w={'100%'}
				h={'1px'}
			/>,
			disabled: true,
		},
		{
			el: <><RiDeleteBin6Line/> delete</>,
			danger:true,
			onClick: () => {
				close();
				setShowDeleteDialog(true);
			}
		},
	];

    return (
        <>
            <Box 
                className={'item'}
                onContextMenu={(e) => {
					e.preventDefault();
					e.stopPropagation();
					open(e);
				}}
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
            >
                <GraphCtx.Provider value={{ 
					ns: null, 
					setNs: null, 
					gRef: null, 
					id: g.$id, 
					name: g.name 
				}}>
                    <GraphPage mode={'brief'} name={g.name} id={g.$id}/>
                </GraphCtx.Provider>
            </Box>
			<ContextMenu
				ref={menuRef}
				{...menuProps}
				items={menuItems}
				/>

			{showDeleteDialog && (
				<DeleteConfirmDialog 
					graphName={g.name}
					onCancel={() => setShowDeleteDialog(false)}
					onConfirm={async () => {
						await onDelete(g.$id);
						setShowDeleteDialog(false);
					}}
				/>
			)}
        </>
    );
};

export const MyGraphs = ({ 
	onGraphUpdated 
}: { 
	onGraphUpdated?: (id: string, updates: Partial<any>) => void 
} = {}) => {
    const [graphData, setGraphData] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [_, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchGraphData = async () => {
            try {
                const user = await spaced_account.get();
                const currentUserId = user.$id;
                const filters = [
                    Query.equal('owner', currentUserId),
                    Query.select(['$id', 'owner', 'name'])
                ];
                const myDocuments = await gReq.search(filters);
                if (myDocuments) {
                    setGraphData(myDocuments);
                }
            } catch (err) {
                setError("err");
            } finally {
                setLoading(false);
            }
        };
        fetchGraphData();
    }, []);

    const handleDelete = async(id:string)=>{
        await gReq.delete(id);
        setGraphData((prev: any[]) => prev.filter((gr: any) => gr.$id !== id));
    };

	const handleGraphRenamed = (id: string, newName: string) => {
		setGraphData((prev: any[]) => 
			prev.map((gr: any) => 
				gr.$id === id ? { ...gr, name: newName } : gr
			)
		);
		if (onGraphUpdated) {
			onGraphUpdated(id, { name: newName });
		}
	};

    return (
        <div css={inputStackCSS}>
            <VStack className={'body block'}>
                {loading && (
                    <>
                        <SkeletonText noOfLines={1} h={'32px'} />
                        <SkeletonText noOfLines={1} h={'32px'} mt={'5px'}/>
                        <SkeletonText noOfLines={1} h={'32px'} mt={'5px'}/>
                        <SkeletonText noOfLines={1} h={'32px'} mt={'5px'}/>
                    </>
                )}

                {graphData&&graphData.map((g: any) => (
                    <GraphItem
						key={g.$id}
						g={g}
						onDelete={handleDelete}
						onGraphRenamed={handleGraphRenamed}
						/>
                ))}
            </VStack>
        </div>
    );
};

export function Profile(props:any){
	let userData=undefined;
	let user=undefined;

	const [loading,setLoading]=useState(true);

	if (props.id === undefined) {
		user=store.getState().user;
		userData=store.getState().userData;
	}
	console.log('userData',userData)

	const [localUserData,setLocalUserData] = useState(userData);
	const usernameRef = useRef<HTMLInputElement>(null);
	const avatarRef = useRef<HTMLInputElement>(null);
	const bioRef = useRef<HTMLInputElement>(null);
	const headerRef=useRef(null) as any;

	const f = async()=>{
		const newOtherUserData = await uReq.read(props.id) as any;
		setLoading(false);
		setLocalUserData(newOtherUserData)
	}
	if (localUserData===undefined){
		f();
	}
	if (loading && props.id) {
		return (
			<Spinner/>
		)
	} else {
		if (props.preview === false) {
			return (
				<>
					<Header ref={headerRef}/>
					<div css={profileStyle}>
						<VStack className='profilePg'>
							<SpAvatar
								src={localUserData.photo_url}
								username={localUserData.username}
								backgroundColor={'white'}
								h={'70px'}
								w={'70px'}/>

							<HStack mb={'-15px'} gap={'2px'} opacity={.4}>
								<Text fontSize={'12px'}>Profile</Text>
								<Clip
									props={{
										h:'20px',
										variant:'plain',
										p:'0',
										w:'20px',
										minW:'20px',
									}}
									copyIcon={<FaShare style={{width:'13px',height:'13px'}}/>}
									value={APPWRITE_CONFIG.BASE_URL+'/u'+localUserData.$id}
									/>
							</HStack>

							<InputStack
								els={[
									{ref:usernameRef,p:'username',   d:localUserData.username,  tp:'input'},
									{ref:avatarRef,  p:'avatar link',d:localUserData.photo_url, tp:'input'},
									{ref:bioRef,     p:'about you',  d:localUserData.bio, tp:'card'}
								]} />
	
							<HStack p={'0px 10px'} m={0} w={'100%'} mb={'-15px'}>
								<Text opacity={0.4} fontSize={'12px'}>My courses</Text>
								<Spacer/>
								<Button
									gap={'3px'}
									h={'fit-content'} colorPalette={'green'}
									w={'fit-content'}
									fontSize={'12px'}
									p={0}
									variant={'plain'}
									onClick={async()=>{
										const user = await spaced_account.get();
          								const currentUserId = user.$id;
										const gId = ID.unique();
										await gReq.create({
											content:'{}',
											collaborators:[],
											owner:currentUserId,
										},gId);
										History.push(`/${gId}`)
									}}
								>
									<HiDocumentAdd style={{width:'13px',height:'13px'}}/> create
								</Button>
							</HStack>
							<MyGraphs/>

							<HStack w={'100%'}
								alignItems={'stretch'}
								justifyContent={'stretch'}
							>
								<Button
									flex={1}
									variant={'outline'}
									onClick={async ()=>{
										const newUserData = JSON.parse(JSON.stringify(localUserData))
										newUserData.username = usernameRef.current?.value||'';
										newUserData.photo_url = avatarRef.current?.value||'';
										newUserData.bio = (bioRef.current as any).getContent()||'';

										await uReq.update(
											newUserData.$id,
											{
												username:  newUserData.username,
												photo_url: newUserData.photo_url,
												bio:       newUserData.bio,
											},
										)
										setLocalUserData(newUserData);
									}}
								>
									save
								</Button>
								<Button
									flex={1}
									variant={'outline'}
									colorPalette={'red'}
									onClick={()=>{
										const SpaceRouter=store.getState().components['SpaceRouter']
										SpaceRouter.setState({
											user:null,
										})
										logOut()
									}}
								>
									log out
								</Button>
							</HStack>
						</VStack>
					</div>
				</>
			)
		}
		if (props.preview === true) {
			return (
				<>
					<HStack fontSize={'13px'}>
						<SpAvatar
							src={localUserData.photo_url}
							username={localUserData.username}
							backgroundColor={'white'}
							h={'18px'}
							w={'18px'}
						/>
						{localUserData.username}
					</HStack>
				</>
			)
		}
	}
}