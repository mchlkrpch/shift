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
display: flex;
width: 100%;
justify-content: center;
align-items: center;
// border-bottom: 1px solid color-mix(in srgb, #ccc 10%, transparent);

.panel{
    margin: 0px 20px;
    gap: 10px;
    display:flex;
    flex-direction: row;
}

.hItem{
    display: flex;
    padding: 2px 5px;
    height: 20px;
    align-items:center;
    justify-content: center;
    // border: 1px solid color-mix(in srgb, #ccc 10%, transparent)
}
.hItem:hover{
    background-color: color-mix(in srgb, #ccc 5%, transparent)
}
`;

export const Header=React.forwardRef((props:any,ref:any)=>{
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
            p={0}
            display={'flex'}
            alignItems={'center'}
            justifyContent={'center'}
        >
            <SpAvatar
                src={userData.photo_url}
                username={userData.username}
                border={'1.2px solid color-mix(in srgb, #666 14%, transparent)'}
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
            <Box w={'100%'}
                className='panel'
                justifySelf={'center'}>
                {localContent}
            </Box>
        </div>

    </>)
})