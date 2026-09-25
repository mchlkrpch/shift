/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';

import { useEffect, useRef } from 'react';
import { Header } from '../components/header';
import {
	Box, Button, HStack, Input, Spinner, Text, VStack
} from '@chakra-ui/react';
import { FaBook } from "react-icons/fa6";
import { History } from './utils';
import { useCallback, useState } from "react";
import { Query, type Models } from "appwrite";
import { gReq } from '../appwrite/service';

const PAGE_SIZE = 10;

export function useGraphsFeed() {
	const [graphs, setGraphs] = useState<Models.Document[]>([]);
	const [loading, setLoading] = useState(false);
	const [hasMore, setHasMore] = useState(true);
	const cursorRef = useRef<string | null>(null);
	const isFetchingRef = useRef(false);

	const loadMore = useCallback(async () => {
		if (isFetchingRef.current || !hasMore) return;
		isFetchingRef.current = true;
		setLoading(true);
		try {
			const queries = [
				Query.limit(PAGE_SIZE),
				Query.orderDesc("$createdAt"),
			];
			if (cursorRef.current) {
				queries.push(Query.cursorAfter(cursorRef.current));
			}
			const docs = await gReq.list(queries);

			if (docs.length > 0) {
				cursorRef.current = docs[docs.length - 1].$id;
				setGraphs(prev => {
					// на случай StrictMode-двойного вызова / гонок — не дублируем
					const existing = new Set(prev.map(d => d.$id));
					const fresh = docs.filter(d => !existing.has(d.$id));
					return [...prev, ...fresh];
				});
			}
			if (docs.length < PAGE_SIZE) setHasMore(false);
		} catch (e) {
			console.error("[useGraphsFeed] load error:", e);
		} finally {
			isFetchingRef.current = false;
			setLoading(false);
		}
	}, [hasMore]);

	const reset = useCallback(() => {
		cursorRef.current = null;
		setGraphs([]);
		setHasMore(true);
	}, []);

	return { graphs, loading, hasMore, loadMore, reset };
}

const feedStyle = css`
display: flex;
flex-direction: column;
align-items: center;
width: 100%;
`;

const graphCardStyle = css`
width: 100%;
padding: 10px 12px;
border-radius: 8px;
cursor: pointer;
background-color: color-mix(in srgb, var(--chakra-colors-bg-inverted) 5%, var(--chakra-colors-bg));
transition: background 0.15s ease;

&:hover {
	background-color: color-mix(in srgb, var(--chakra-colors-bg-inverted) 10%, var(--chakra-colors-bg));
}
`;

const GraphCard = ({ graph }: { graph: any }) => {
	const title = graph.title || graph.name || 'Untitled graph';
	return (
		<Box
			css={graphCardStyle}
			onClick={() => History.push(`/${graph.$id}`)}
		>
			<Text fontWeight={600} fontSize="14px" truncate>{title}</Text>
			<Text fontSize="11px" opacity={0.5}>
				{new Date(graph.$createdAt).toLocaleDateString()}
			</Text>
		</Box>
	);
};

export const LibraryPage = () => {
	const headerRef = useRef(null) as any;
	const sentinelRef = useRef<HTMLDivElement>(null);
	const { graphs, loading, hasMore, loadMore } = useGraphsFeed();

	useEffect(() => {
		loadMore();
	}, []);

	useEffect(() => {
		const el = sentinelRef.current;
		if (!el) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) loadMore();
			},
			{ root: null, rootMargin: '300px', threshold: 0 }
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, [loadMore]);

	return (
		<>
			<div css={feedStyle}>
				<VStack
					mt={'25px'}
					w={'100%'}
					maxW={'450px'}
					mx={'auto'}
					gap={"20px"}
					overflowY={'auto'}
					scrollbarWidth={'none'}
					pb={'40px'}
				>
					<HStack w={'100%'}>
						<Input w={'100%'} placeholder="search" />
						<Button
							fontWeight={600} p={'10px 4px'}
							gap={'3px'}
							onClick={() => { History.push('/') }}
						>
							new
							<FaBook style={{ marginTop: '1px', height: '15px', width: '15px' }} />
						</Button>
					</HStack>

					<VStack w={'100%'} gap={'8px'} align="stretch" alignItems={'center'}>
						{graphs.map(g => (
							<GraphCard key={g.$id} graph={g} />
						))}
						{!hasMore && graphs.length === 0 && (
							<Text opacity={0.5} fontSize="11px">Графы не найдены</Text>
						)}
						{!hasMore && graphs.length > 0 && (
							<Text opacity={0.4} fontSize="12px" py="10px">
								Это все графы 🎉
							</Text>
						)}
						<Box h={'50vh'}/>
					</VStack>

					{hasMore && (<Box ref={sentinelRef} w="100%" display="flex" justifyContent="center" py="10px">
						{loading && <Spinner size="sm" />}
					</Box>)}
				</VStack>
			</div>
			<Header ref={headerRef} />
		</>
	)
}