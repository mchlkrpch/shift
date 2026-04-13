// @ts-expect-error: to ignore empy import react 
import React, { useMemo, useRef, useState } from 'react'
import {
	HStack,
	Input,
	VStack,
	Box,
	Text,
	Spinner,
	Button,
} from '@chakra-ui/react'
import { Image } from "@chakra-ui/react";
import store from '../storage';

/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';
import {
    uReq,
} from '../appwrite/service';
import { logOut } from './auth';
import { Card } from '../sh/card/card';
import { GraphCtx } from '../App';
import { Header } from '../components/header';
import { topSort } from '../sh/card/utility';
import { Graph } from '../sh/graph/graph';

export const unknownPhotoUrl: string = "https://i.postimg.cc/MKZzBCG2/spaced-gray.png";

export function SpAvatar(props:any) {
	let url = unknownPhotoUrl
	console.log('props.src',props.src)
	if (props.src && props.src.slice(0,5)==='https') {
		url=props.src
	}
	console.log('url:',url)
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

const ns: object={
  '1': cntStr,
  '2': inner2,
  '3': inner3,
};


const profileStyle=css`
display: flex;
flex-direction: column;
align-items: center;
width: 100%;
max-width: 450px;
margin-left: auto;
margin-right: auto;

input{
    border: none;
    outline: none;
}
.block{
    display: flex;
    width: 100%;
    padding: 5px;
    font-size: 14px;
    color: color-mix(in srgb,#fff 90%,transparent);
    border-radius: 7px;
    background-color: color-mix(in srgb, #555 10%, transparent);
    border: 1px solid color-mix(in srgb, #555 20%, transparent);
}
`;

export function Profile(props:any){
	let userData=undefined;
	let user=undefined;

	const [loading,setLoading]=useState(true);

	if (props.id === undefined) {
		user=store.getState().user;
		userData=store.getState().userData;	
	}

	const [localUserData,setLocalUserData] = useState(userData);
    console.log('ld',localUserData)

	const usernameRef = useRef<HTMLInputElement>(null);
	const avatarRef = useRef<HTMLInputElement>(null);
	const bioRef = useRef<HTMLInputElement>(null);
    const [curNs,setNs]=useState(ns) as any;
    const sorted = topSort(ns as any);

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
        console.log(props.display)
        if (props.preview === false) {
            return (
                <>
                    <Header/>
                    <div
                        // @ts-expect-error
                        css={profileStyle}
                        >
                        <VStack
                            mt={'25px'}
                            w={'100%'}
                            maxW={'100%'}
                            mx={'auto'}
                            gap={"20px"}
                            overflowY={'auto'}
                            scrollbarWidth={'none'}
                        >
                            <Box
                                minH={'70px'}
                                maxW={'70px'}
                                h={'70px'}
                                w={'70px'}
                                mb={'-15px'}
                                >
                                <SpAvatar
                                    src={localUserData.photo_url}
                                    username={localUserData.username}
                                    backgroundColor={'white'}
                                    h={'70px'}
                                    w={'70px'}
                                />
                            </Box>
    
                            <Text opacity={0.4} fontSize={'12px'}>Profile settings</Text>
                            <Box
                                className={'block'}
                                mt={'-15px'}
                            >
                                <Input ref={usernameRef} placeholder='username'
                                    defaultValue={localUserData.username}
                                />
                                <Input ref={avatarRef} placeholder='avatar link'
                                    defaultValue={localUserData.photo_url}
                                />
                            </Box>
    
                            <Text opacity={0.4} fontSize={'12px'}>bio</Text>
                            <Box mt={'-15px'} w={'100%'} className={'block'}>
                                {/* <GraphCtx.Provider value={{
                                    ns:curNs,setNs:setNs,
                                }}>
                                    <VStack
                                        alignItems={'stretch'}
                                        gap={'2px'}
                                        display={'flex'}
                                        w={'100%'}
                                        mx={'auto'}
                                    >
                                        {sorted.map((item:any)=>{
                                            return <>
                                                <Card
                                                    id={item.id}
                                                    content={item.content}
                                                    tp={'ghost'}
                                                />
                                            </>
                                        })}
                                    </VStack>
                                </GraphCtx.Provider> */}
                                <GraphCtx.Provider value={{
                                    ns:curNs,setNs:setNs,
                                }}>
                                    <Graph/>
                                </GraphCtx.Provider>
                            </Box>
    
                            {/* stats */}
    
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
                                        newUserData.bio = bioRef.current?.value||'';
                                        await uReq.update(
                                            user,
                                            newUserData,
                                            // true
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