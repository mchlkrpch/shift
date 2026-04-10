import React from 'react';
import { Header } from '../components/header';
/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';
import { VStack } from '@chakra-ui/react';

const feedStyle=css`
display: flex;
flex-direction: column;
align-items: center;
width: 100%;
max-width: 450px;
margin-left: auto;
margin-right: auto;
`;

export const Feed=()=>{
    return (
        // @ts-ignore
        <div css={feedStyle}>
            <Header/>
            <VStack
                mt={'25px'}
                w={'100%'}
                maxW={'450px'}
                mx={'auto'}
                gap={"20px"}
                overflowY={'auto'}
                scrollbarWidth={'none'}
            >
                {/* editor of selected graphs */}
                {/* randing material */}
                {/* ask questions */}
                feed
            </VStack>
        </div>
    )
}