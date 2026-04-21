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
	IconButton,
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
import { logOut } from './auth';
import { GraphCtx } from '../App';
import { Header } from '../components/header';
import { Graph } from '../sh/graph/graphEditor';
import { Card } from '../sh/card/card';
import { History } from './utils';
import { ID, Query } from 'appwrite';
import { GraphPage } from './graph';
import { FaRegTrashAlt, FaShare } from 'react-icons/fa';
import { HiDocumentAdd } from "react-icons/hi";
import { FiShare } from "react-icons/fi";
import { Clip } from '../sh/clip';

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

const cntStr=`first
@@@
second<id=2>third<id=2>fourth
\`\`\`python
import typing;
def add_numbers(a, b)->typng.Any:
	"""Function to return the sum of two numbers."""
	return a + b
\`\`\`
this code provide strong power of wibe coding
===
second
@@@
segssges sgds
`;


const inner2:string=`inner
@@@
inner complex definition of something <id=3>`;


const inner3:string=`inner second def
@@@
more simple definition`;


const inner4:string=`Аффинные многообразия
@@@
Пусть k — алгебраически замкнутое поле (в классической алгебраической геометрии
— поле комплексных чисел);
$\{\\displaystyle \\mathbb \{A\}^\{n\}\}$ — n-мерное аффинное пространство над k.
Существует теорема из классического анализа, утверждающая, что замкнутые подмножества

$\{\\displaystyle \\mathbb {R} ^{n}} — это в точности множества нулей всевозможных
бесконечно дифференцируемых функций.[4] Топология Зарисского в некотором смысле
переносит это свойство на случай полиномиальных функций: при определении топологии
Зарисского каждому множеству многочленов от n переменных сопоставляется множество точек
аффинного пространства, на которых все эти многочлены равны нулю:

\$\{\\displaystyle Z(S)=\\{x\\in \\mathbb {A}^{n}\\mid f(x)=0\;\\forall f\\in S\\}}$
Замкнутые множества в топологии Зарисского на 
\{\\displaystyle \\mathbb {A}^{n}}$
— это все множества вида Z(S), также эти замкнутые множества называются
алгебраическими множествами. Аффинное алгебраическое многообразие
— это алгебраическое множество, которое нельзя представить в виде объединения
двух меньших алгебраических множеств
`;

const ns: object={
  '1': cntStr,
  '2': inner2,
  '3': inner3,
  '4':inner4,
};


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
	background-color: color-mix(in srgb, #999 10%, transparent);
	align-items: center;
}

input{
	border: none;
	outline: none;
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
							<Box p={0}m={0} key={i} w={'100%'} alignItems={'center'} display={'flex'} flexDirection={'column'}>
								{i!==0&&<Separator w={'95%'}/>}
								<Box m={0} alignItems={'start'} w={'100%'} p={'5px 10px'}>
									<GraphCtx.Provider value={{
										ns:localNs,setNs:setLocalNs,
										ref:el.ref,
										id:'',
										name:'',
									}}>
										<Card
											ref={el.ref}
											id={'0'}
											content={localNs['0']}
											options={{stats:false,textEdit:false}}
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


export const MyGraphs=()=>{
	const [graphData,setGraphData] = useState<any>(null);
	const [loading,setLoading] = useState<boolean>(true);
	const [error,setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchGraphData = async()=>{
			try {
				const user = await spaced_account.get();
        		const currentUserId = user.$id;
				const filters =[
					Query.equal('owner', currentUserId),
					Query.select(['$id', 'owner', 'name'])
				];

				const myDocuments = await gReq.search(filters);
				if (myDocuments) {
					setGraphData(myDocuments)
					setLoading(false)
				}
			} catch (err) {
				setError("err");
			} finally {
				setLoading(false);
			}
		};
		fetchGraphData();
	},[]);
	return (
		<div css={inputStackCSS}>
			<VStack w={'100%'} alignItems={'stretch'} className={'block'} p={'10px'} gap={'5px'}>
				{loading&&(
					<>
						<SkeletonText noOfLines={1} h={'32px'} />
						<SkeletonText noOfLines={1} h={'32px'} mt={'5px'}/>
						<SkeletonText noOfLines={1} h={'32px'} mt={'5px'}/>
						<SkeletonText noOfLines={1} h={'32px'} mt={'5px'}/>
					</>
				)}
				{graphData&&graphData.map((g:any,i:number)=>{
					return(
						<Box m={0} p={0} w={'100%'} key={`g_${g.$id}_i`}>
							{i!==0&&<Separator w={'100%'}/>}
							<Box
								w={'100%'} cursor={'pointer'} display={'flex'} flexDirection={'row'}
								p={0} alignItems={'center'}
								>
								<GraphCtx.Provider value={{
									ns:null,setNs:null,
									ref:null,
									id:g.$id,
									name:'',
								}}>
									<GraphPage mode={'brief'} name={g.name} id={g.$id}/>
								</GraphCtx.Provider>
								<Spacer/>
								
								<Dialog.Root>
									<Dialog.Trigger>
										<Box cursor={'pointer'} h={'30px'} colorPalette={'red'} w={'30px'} justifyItems={'center'} alignContent={'center'}>
											<FaRegTrashAlt style={{width:'13px',height:'13px'}}/>
										</Box>
									</Dialog.Trigger>
									<Dialog.Backdrop />
									<Dialog.Positioner>
										<Dialog.Content p={'20px'}>
											<Dialog.CloseTrigger />
											<Dialog.Header w={'100%'} p={'0px 20px'}>
												<Dialog.Title>Delete graph "{g.name}"?</Dialog.Title>
											</Dialog.Header>
											<Dialog.Body
												w={'100%'} alignItems={'start'} p={'0px 20px'}
												textAlign={'start'}
												fontSize={'12px'}
												fontWeight={300}
											>
												Content will be deleted without ability to restore it.
												<Button
													mt={'20px'}
													w={'100%'}
													variant={'subtle'}
													colorPalette={'red'}
													h={'20px'}
													onClick={async()=>{
														await gReq.delete(g.$id);
														setGraphData(graphData.filter((gr:any)=>gr.$id !== g.$id));
													}}
													>
													Delete
												</Button>
											</Dialog.Body>
										</Dialog.Content>
									</Dialog.Positioner>
								</Dialog.Root>
							</Box>
						</Box>
					)
				})}
			</VStack>
		</div>
	)
}

export function Profile(props:any){
	let userData=undefined;
	let user=undefined;

	const [loading,setLoading]=useState(true);

	if (props.id === undefined) {
		user=store.getState().user;
		userData=store.getState().userData;	
	}

	const [localUserData,setLocalUserData] = useState(userData);
	const usernameRef = useRef<HTMLInputElement>(null);
	const avatarRef = useRef<HTMLInputElement>(null);
	const bioRef = useRef<HTMLInputElement>(null);
	const [curNs,setNs]=useState(ns) as any;
	const gRef=React.createRef() as any;
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
								<Text opacity={0.4} fontSize={'12px'}>my graphs</Text>
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