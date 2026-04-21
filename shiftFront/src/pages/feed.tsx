import React from 'react';
import { Header } from '../components/header';
/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';
import { Box, Button, HStack, Input, Separator, VStack } from '@chakra-ui/react';
import { Profile } from './profile';
import { FaBook } from "react-icons/fa6";
import { ID } from 'appwrite';
import { History } from './utils';

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
                {/* continue study */}
                <HStack w={'100%'}>
                    <Input w={'100%'} placeholder="search" />
                    <Button
                        fontWeight={600} p={'10px 4px'}
                        gap={'3px'}
                        onClick={()=>{
                            const id: string = ID.unique();
                            History.push('/')
                        }}
                    >
                        new
                        <FaBook style={{marginTop:'1px',height: '15px', width: '15px'}}/>
                    </Button>
                </HStack>
                {/* <Separator w={'100%'} h={'1px'}/> */}
                Continue Study
                <Separator w={'100%'} h={'1px'}/>
                Available Courses
                {/* <Separator w={'100%'} h={'1px'}/> */}
                {/* editor of selected graphs */}
                {/* randing material */}
                {/* ask questions */}
                {/* feed */}
            </VStack>
        </div>
    )
}