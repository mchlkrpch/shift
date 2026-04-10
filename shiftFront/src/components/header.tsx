// @ts-expect-error: to ignore empy import react 

/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';

import { Box, Spacer } from '@chakra-ui/react';
// import React from 'react';
import { GrHomeRounded } from "react-icons/gr";

const headerStyle = css`
display: flex;
width: 100%;
justify-content: center;

.panel{
    margin: 10px 10px;
    gap: 10px;
    display:flex;
    flex-direction: row;
}

.hItem{
    display: flex;
    padding: 10px;
    background-color: color-mix(in srgb, #ccc 10%, transparent)
}
.hItem:hover{
    background-color: color-mix(in srgb, #ccc 15%, transparent)
}
`;

export const Header=()=>{
    return (<>
        <div
            css={headerStyle}>
            <Box w={'450px'}
                className='panel'
                justifySelf={'center'}>
                <Box className={'hItem'} rounded={'full'}>
                    <GrHomeRounded size={'22px'}/>
                </Box>
                <Spacer/>
            </Box>
        </div>

    </>)
}