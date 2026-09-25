/** @jsxImportSource @emotion/react */
import { useCallback, useRef, useState } from "react";
import { genAI, getContextForAi, REMOTE_GPT_MODEL, sendToRemoteGPT } from "../../aichat/aichat";
import ollama from 'ollama/browser';
import { Button, HStack, Portal, Spacer } from "@chakra-ui/react";
import { Menu } from "@ark-ui/react";
import { menuCSS, UnifiedTreeView } from "./unifiedTreeview";
import { LuBook, LuBookDashed, LuChevronDown, LuChevronUp, LuLink } from "react-icons/lu";
import { MdClose } from "react-icons/md";


export const SuggestionAIChat = ({
	block,
	isHidden,
	depthPadding,
	onUpdate,
	onAttach,
	onCancel,
	fontSize,
	gCtx,
}: any) => {
	const [model, setModel] = useState(REMOTE_GPT_MODEL);
	const [useContext, setUseContext] = useState(false);
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const [insertLinkMode, setInsertLinkMode] = useState(false);
	const closeMenuTimeoutRef = useRef<any>(null);
	const [initialBlocks] = useState(() => block.chatMessages || []);
	const subTreeRef = useRef<any>(null);

	const handleMenuEnter = () => {
		if (closeMenuTimeoutRef.current) clearTimeout(closeMenuTimeoutRef.current);
		setIsMenuOpen(true);
	};

	const handleMenuLeave = () => {
		closeMenuTimeoutRef.current = setTimeout(() => setIsMenuOpen(false), 150);
	};

	const handleGenerateAI = useCallback(async (promptText: string, spinnerBlockId: string) => {
		try {
			let finalPrompt = promptText;
			if (useContext) {
				const nsDict: any = {};
				const traverseNs = (blocksArray: any[]) => {
					blocksArray.forEach(b => {
						nsDict[b.id] = b.metainfo?.content || b.metainfo?.title || '';
						if (b.children) traverseNs(b.children);
					});
				};
				traverseNs(gCtx.blocks || []);
				const contextStr = getContextForAi(nsDict);
				if (contextStr) finalPrompt = `${contextStr}\n${finalPrompt}`;
			}
			let answer = '';
			if (model === 'qwen2.5vl:7b') {
				const response = await ollama.chat({ model, messages: [{ role: 'user', content: finalPrompt }] });
				answer = response.message.content;
			} else if (model === REMOTE_GPT_MODEL) {
				answer = await sendToRemoteGPT(finalPrompt);
			} else {
				const response = await genAI.models.generateContent({ model, contents: finalPrompt });
				answer = response.text || '';
			}
			subTreeRef.current?.updateBlock(spinnerBlockId, { isSpinner: false, text: answer, role: 'ai', isRendered: true });
		} catch (e) {
			console.error("AI Request Error:", e);
			subTreeRef.current?.updateBlock(spinnerBlockId, { isSpinner: false, text: '[Ошибка обработки запроса]', role: 'ai' });
		}
	}, [model, useContext, gCtx]);

	const leftMargin = depthPadding + (block.isGroup ? 20 : 34);
	const marginTopStr = block.customOffsetTop !== undefined ? `${block.customOffsetTop}px` : '8px';
	const hasSelection = !!(block.selectedText && block.selectedText.trim().length > 0);

	return (
		<div
			css={menuCSS}
			className="tv-block-wrapper tv-ai-chat-card menuFrame" 
			data-id={block.id}
			data-parent-id={block.parentId || ''}
			data-is-ai-chat="true"
			data-chat-messages={JSON.stringify(block.chatMessages || [])}
			data-offset-top={block.customOffsetTop ?? ''} // Сохраняем отступ в DOM для syncDOMToState
			data-selected-text={block.selectedText || ''}
			data-source-block-id={block.sourceBlockId || ''}
			contentEditable={false}
			data-highlight-rects={JSON.stringify(block.highlightRects || [])} 
			style={{ 
				display: isHidden ? 'none' : 'flex', 
				fontSize: `${fontSize}px`,
				marginLeft: `${leftMargin}px`,
				width: `calc(100% - ${leftMargin}px - 8px)`,
				marginTop: marginTopStr
			}}
		>
			<div style={{ "--tv-min-height": "10px" } as any}>
				<UnifiedTreeView
					ref={subTreeRef}
					initialBlocks={initialBlocks}
					fontSize={fontSize}
					topPadding="0px" 
					bottomPadding="0px"
					onGenerateAI={handleGenerateAI}
					onChange={(newBlocks: any) => onUpdate(newBlocks)} 
				/>
			</div>

			<HStack mt={'5px'} >
				<Menu.Root open={isMenuOpen} onOpenChange={(e) => setIsMenuOpen(e.open)}>
					<Menu.Trigger asChild>
						<Button size="xs" variant="ghost" onMouseEnter={handleMenuEnter} onMouseLeave={handleMenuLeave}
							className="item">
							{isMenuOpen ? <LuChevronDown /> : <LuChevronUp/>}
						</Button>
					</Menu.Trigger>
					<Portal>
						<Menu.Positioner css={menuCSS} >
								<Menu.Content onMouseEnter={handleMenuEnter} onMouseLeave={handleMenuLeave}
									className={'menuFrame'}
								>
										<Menu.Item value="gemini-3.6-flash" onClick={() => { setModel("gemini-3.6-flash"); setIsMenuOpen(false); }} className="item">
												gemini-3.6-flash
										</Menu.Item>
										<Menu.Item value="qwen2.5vl:7b" onClick={() => { setModel("qwen2.5vl:7b"); setIsMenuOpen(false); }} className="item">
												qwen2.5vl:7b
										</Menu.Item>
										<Menu.Item value={REMOTE_GPT_MODEL} onClick={() => { setModel(REMOTE_GPT_MODEL); setIsMenuOpen(false); }} className="item">
												ChatGPT
										</Menu.Item>
										<div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
										<Menu.Item value="use-context" onClick={(e) => { e.preventDefault(); setUseContext(!useContext); }} className="item">
												{useContext ? <LuBook color="var(--chakra-colors-blue-400)" /> : <LuBookDashed />} Контекст
										</Menu.Item>
								</Menu.Content>
						</Menu.Positioner>
					</Portal>
				</Menu.Root>

				{hasSelection && (
					<Button
						size="xs"
						variant="ghost"
						className="item"
						width={'fit-content'}
						onClick={() => setInsertLinkMode(v => !v)}
						title="Вставить как ссылку"
					>
						вставить как ссылку
						<LuLink color={insertLinkMode ? "var(--chakra-colors-blue-400)" : undefined} />
					</Button>
				)}
				<Spacer />
				<Button 
					size="xs" 
					bg="white" 
					color="black" 
					minH={'25px'}
					h={'25px'}
					colorPalette={'green'}
					_hover={{ bg: "gray.200" }} 
					onClick={() => {
						const msgs = subTreeRef.current?.getBlocks() || [];
						if (insertLinkMode && hasSelection) {
							onAttach(msgs, {
								insertLink: true,
								selectedText: block.selectedText,
								sourceBlockId: block.sourceBlockId,
							});
						} else {
							onAttach(msgs);
						}
					}} 
					title="Attach to document"
				>
					Attach
				</Button>
				<Button size="xs" variant="ghost" onClick={onCancel} title="Close"
					className={'item'}
				>
					<MdClose size={16} />
				</Button>
			</HStack>
		</div>
	);
};