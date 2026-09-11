/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';

import { Box, Button, Spacer } from '@chakra-ui/react';
// import React from 'react';
import { GoHomeFill } from "react-icons/go";
import { History } from '../pages/utils';
import React, { useEffect, useImperativeHandle, useState } from 'react';
import store from '../storage';
import { SpAvatar } from '../pages/profile';

const headerStyle = css`
// display: flex;
width: 100%;
height: 100%;
pointer-events: none;


position: absolute;
bottom: 0px;
left: 0;
right: 0;
z-index: 1000;
background-color: transparent;
justify-content: flex-end;


.blur-panel {
	pointer-events: auto;
	background-color: rgba(18, 18, 22, 0.65);
	backdrop-filter: blur(22px);
	-webkit-backdrop-filter: blur(22px);
	padding: 10px;
	border-radius: 20px;
	border: 2px solid color-mix(in srgb, white 8%, transparent);
	display: flex;
	width: 100%;
	box-shadow: 0px 0px 45px color-mix(in srgb, black 50%, rgba(18, 18, 22, 1.0));
}

padding: 6px 0;

.panel {
	margin: 0px 20px;
	gap: 10px;
	display: flex;
	flex-direction: row;
	align-items: flex-end;
	width: 100%;
	justify-content: center;
}

.hItem {
	display: flex;
	padding: 2px 5px;
	height: 20px;
	align-items: center;
	justify-content: center;
}

.hItem:hover {
	background-color: color-mix(in srgb, #ccc 5%, transparent);
}
`;

export const Header=React.forwardRef((_props:any,ref:any)=>{
	const userData=store.getState().userData;
	const defaultContent=[
		<Button
			key={1}
			className={'hItem'}
			rounded={'full'}
			onClick={()=>{
				History.push('/')
			}}
			m={'5px 0px'}
			h={'20px'}
			minW={'20px'}
			w={'20px'}
			variant={'subtle'}
			alignItems={'center'}
			bg={'color-mix(in srgb, #556 20%, transparent)'}
			border={'1.2px solid color-mix(in srgb, #666 14%, transparent)'}
		>
			<GoHomeFill
				style={{
					height:'12px',
					width:'12px',
				}}
				size={'12px'}
			/>
		</Button>,

		<Spacer key={2}/>,

		<Box
			key={3}
			onClick={()=>{
				History.push('/profile')
			}}
			p={'0px'}
			borderRadius={'100px'}
			display={'flex'}
			alignItems={'center'}
			justifyContent={'center'}
			border={'1.2px solid color-mix(in srgb, white 10%, transparent)'}
		>
			<SpAvatar
				src={userData.photo_url}
				username={userData.username}
				h={'20px'}
				w={'20px'}/>
		</Box>
	]
	const [localContent,setLocalContent]=useState(defaultContent) as any;
	useEffect(()=>{
	},[localContent])

	useImperativeHandle(ref,()=>({
		setContent:(cnt:any[])=>{
			setLocalContent(cnt);
		},
		resetContent:async()=>setLocalContent(defaultContent),
		getContent:()=>localContent,
	}))
	
	return (<>
		<div
			css={headerStyle}>
			<Box w={'100%'} h={'100%'}
				className='panel'
				justifySelf={'center'}>
				{localContent}
			</Box>
		</div>

	</>)
})