/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';

import { Box, Spacer } from '@chakra-ui/react';
// import React from 'react';
import { GrHomeRounded } from "react-icons/gr";
import { History } from '../pages/utils';
import React, { useEffect, useImperativeHandle, useState } from 'react';
import store from '../storage';
import { SpAvatar } from '../pages/profile';

const headerStyle = css`
display: flex;
width: 100%;
justify-content: center;
align-items: center;
// background-color: color-mix(in srgb, #ccc 5%, transparent);
border-bottom: 1px solid color-mix(in srgb, #ccc 10%, transparent);
// gap: 10px;

.panel{
    margin: 10px 10px;
    gap: 10px;
    display:flex;
    flex-direction: row;
}

.hItem{
    display: flex;
    padding: 2px 5px;
    height: 30px;
    align-items:center;
    justify-content: center;
    border: 1px solid color-mix(in srgb, #ccc 10%, transparent)
}
.hItem:hover{
    background-color: color-mix(in srgb, #ccc 5%, transparent)
}
`;

export const Header=React.forwardRef((props:any,ref:any)=>{
    const userData=store.getState().userData;
    const defaultContent=[
        <Box
            key={1}
            className={'hItem'}
            rounded={'full'}
            onClick={()=>{
                History.push('/')
            }}
            h={'30px'}
            w={'30px'}
            alignItems={'center'}
        >
            <GrHomeRounded
                size={'12px'}
            />
        </Box>,
        <Spacer key={2}/>,
        <Box
            key={3}
            rounded={'full'}
            onClick={()=>{
                History.push('/profile')
            }}
            p={0}
            
        >
            <SpAvatar
                src={userData.photo_url}
                username={userData.username}
                backgroundColor={'white'}
                h={'30px'}
                w={'30px'}/>
        </Box>
    ]
    const [localContent,setLocalContent]=useState(defaultContent) as any;
    useEffect(()=>{
    },[localContent])

    useImperativeHandle(ref,()=>({
        setContent:(cnt:any[])=>{
            console.log('setCnt',cnt);
            setLocalContent(cnt);
        },
        resetContent:async()=>setLocalContent(defaultContent),
        getContent:()=>localContent,
    }))
    return (<>
        <div
            css={headerStyle}>
            <Box w={'100%'}
                className='panel'
                justifySelf={'center'}>
                {localContent}
            </Box>
        </div>

    </>)
})