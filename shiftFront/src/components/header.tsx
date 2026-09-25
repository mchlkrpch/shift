/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';

import { Box, Button, HStack, IconButton, Input, Menu, Portal, Separator, Spacer, Tabs, Text, VStack } from '@chakra-ui/react';
import { GoHomeFill } from "react-icons/go";
import { History } from '../pages/utils';
import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import store from '../storage';
import { SpAvatar } from '../pages/profile';
import { GraphCtx, useGraphCtx } from '../App';
import { Card } from '../sh/card/card';
import { LuCheck, LuChevronDown, LuChevronRight, LuMinus, LuMoon, LuPlus, LuSun, LuTrash2 } from 'react-icons/lu';
import { createPortal } from 'react-dom';
import { useTheme } from 'next-themes';
import { Minigraph } from '../sh/editor/minigraph';
import { addCSS } from '../sh/editor/tree/unifiedTreeview';
import {
	gReq,
	spaced_account,
	uReq
} from '../appwrite/service';
import { Query } from 'appwrite';

const headerStyle = css`
width: 100%;
height: 100%;
pointer-events: none;
padding: 0;


position: absolute;
bottom: 0px;
left: 0;
right: 0;
z-index: 1000;
background-color: transparent;
justify-content: flex-end;


.blur-panel {
	pointer-events: auto;
	background-color: color-mix(in srgb, var(--chakra-colors-bg) 50%, transparent);

	backdrop-filter: blur(22px);
	-webkit-backdrop-filter: blur(22px);

	padding: 5px;
	border-radius: 20px;

	border: 0.2px solid color-mix(in srgb, var(--chakra-colors-border-emphasized) 50%, transparent);
	display: flex;
	width: 100%;
}

.panel {
	margin: 0px 20px;
	padding: 0px;
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
				History.push('/graphs')
			}}
			m={'5px 0px'}
			h={'20px'}
			minW={'20px'}
			w={'20px'}
			variant={'subtle'}
			alignItems={'center'}
			bg={'color-mix(in srgb, #556 20%, transparent)'}
			border={'1.2px solid color-mix(in srgb, #666 14%, transparent)'}
			pointerEvents={'auto'}
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
			pointerEvents={'auto'}
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




const headerCSS = css`
height: fit-content;
width: 100%;
display: flex;
flex-direction: column;
display: flex;
align-items: flex-start;
gap: 0px;
width: 100%;
overflow: hidden;


.unified-toolbar {
  display: flex;
  align-items: center;
  padding: 5px;
  gap: 12px;
  flex-wrap: nowrap;
	min-width: 0;
	pointer-events: auto;
	width: 100%;
	position: relative;
}

.graph-title {
  --title-weight: 500;
  --title-fs: 13px;
  padding: 2px;
  padding-right: 6px;
  min-width: fit-content;

  font-size: --graph-title-fs;
  font-weight: var(--graph-title-weight);
	
	background-color: var(--chakra-colors-bg);
	border-radius: 5px;

  :hover{
		// background-color: var(--chakra-colors-bg-emphasized);
		background-color: color-mix(in srgb, var(--chakra-colors-bg-inverted) 10%, var(--chakra-colors-bg));
		border-radius: 5px;
  }
}

.tabsTrigger {
	background-color: var(--chakra-colors-bg);
}

.tabsTrigger[aria-selected="true"] {
	background-color: color-mix(in srgb, var(--chakra-colors-bg-inverted) 10%, var(--chakra-colors-bg));
}

.menu-bar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-left: 5px;
  padding: 2px;
  pointer-events: auto;
}

.menu-dropdown-trigger {
  font-size: 10px;
  padding: 2px;

  background: transparent;
  border: none;
  cursor: pointer;
  border-radius: 4px;
  color: inherit;
  
  &:hover {
	background: color-mix(in srgb, var(--chakra-colors-bg-inverted) 10%, transparent);
  }
}

.font-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  height: 15px;
}

.splitter-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  border-top: 1px solid color-mix(in srgb, var(--chakra-colors-bg) 95%, transparent);
  padding: 2px;
  cursor: grab;
  user-select: none;
  font-size: 10px;
  height: 25px;
  color: color-mix(in srgb, var(--chakra-colors-bg-inverted) 20%, transparent);

  &:hover {
	background: color-mix(in srgb, var(--chakra-colors-bg-inverted) 10%, transparent);
  }

  &:active {
	cursor: grabbing;
  }
}

.headerTabs {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  // padding: 4px 8px;
	padding: 0;

  button {
	height: 20px;
	gap: 3px;
	padding: 0px 4px;
	font-size: 11px;
  }

  button .icon {
	height: 13px;
	width: 13px;
  }
}


.blur-panel {
	pointer-events: auto;
	background-color: color-mix(in srgb, var(--chakra-colors-bg) 80%, transparent);

	backdrop-filter: blur(16px);
	-webkit-backdrop-filter: blur(16px);

	padding: 5px;
	border-radius: 14px;

	box-shadow: 0px 5px 10px 1px color-mix(in srgb, var(--chakra-colors-bg) 50%, transparent);
	border: 0.2px solid color-mix(in srgb, var(--chakra-colors-border-emphasized) 50%, transparent);
	display: flex;

	overflow: hidden;
}
`;



const ROLE_OPTIONS: { value: 'editor'|'viewer'|'banned', label: string }[] = [
  { value: 'editor', label: 'Редактор' },
  { value: 'viewer', label: 'Зритель' },
  { value: 'banned', label: 'Забанен' },
];

const roleLabel = (role: string) => {
  switch (role) {
    case 'editor': return 'редактор';
    case 'banned': return 'забанен';
    default: return 'зритель';
  }
};

const RoleMenu = ({ value, onChange }: any) => {
  const [open, setOpen] = useState(false);
  const current = ROLE_OPTIONS.find(r => r.value === value) || ROLE_OPTIONS[0];
  return (
    <Menu.Root open={open} onOpenChange={(e) => setOpen(e.open)} positioning={{ placement: "bottom-start" }}>
      <Menu.Trigger asChild>
        <Button
          size="xs" variant="outline"
          // h="22px"
          h={'100%'}
          fontSize="11px" px="6px"
        >
          {current.label}
          <LuChevronDown style={{ width: '10px', height: '10px', marginLeft: '4px' }} />
        </Button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner style={{ zIndex: 10001 }} css={addCSS}>
          <Menu.Content
            style={{
              border: '1px solid var(--chakra-colors-bg-emphasized)',
              borderRadius: '6px', padding: '4px',
              backdropFilter: 'blur(10px)',
              background: 'var(--chakra-colors-bg)',
              fontSize: '12px', outline: 'none',
            }}
          >
            {ROLE_OPTIONS.map(opt => (
              <Menu.Item
                key={opt.value}
                value={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Box w="12px">{value === opt.value && <LuCheck style={{ width: '11px', height: '11px' }} />}</Box>
                {opt.label}
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};




const ProfileDropdown = ({editorRef}:any) => {
  const [localFs, setLocalFs] = useState(editorRef.current.getFontSize().current)
  const userData = store.getState().userData;
  const { theme, setTheme } = useTheme();
  const isLight = theme === "light";
  const toggleTheme = () => setTheme(isLight ? "dark" : "light");

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const profileMenuTimeout = useRef<any>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleProfileMenuEnter = () => {
	if (profileMenuTimeout.current) clearTimeout(profileMenuTimeout.current);
	if (triggerRef.current) {
	  const rect = triggerRef.current.getBoundingClientRect();
	  setCoords({
		top: rect.bottom + 8,
		left: rect.right,
	  });
	}
	setIsProfileMenuOpen(true);
  };

  const handleProfileMenuLeave = () => {
	profileMenuTimeout.current = setTimeout(() => setIsProfileMenuOpen(false), 150);
  };


  const shortcuts = [
	{ key: 'Enter', desc: 'Разделить блок' },
	{ key: 'Shift+Enter', desc: 'Новая строка (\\n)' },
	{ key: 'Backspace (начало)', desc: 'Слить с предыдущим блоком' },
	{ key: 'Ctrl/Cmd+Q', desc: 'Переключить рендеринг блока' },
	{ key: 'Ctrl/Cmd+G', desc: 'Сгруппировать выделенные блоки' },
	{ key: 'Ctrl/Cmd+S', desc: 'Сохранить' },
	{ key: '/', desc: 'Открыть меню упоминаний' },
	{ key: 'Alt+↑/↓', desc: 'Переместить строку вверх/вниз' },
	{ key: 'Alt+Shift+↑/↓', desc: 'Переместить блок вверх/вниз' },
  ];

  return (
	<>
	  <Box
		ref={triggerRef}
		onClick={() => { setIsProfileMenuOpen(false); History.push('/profile'); }}
		onMouseEnter={handleProfileMenuEnter}
		onMouseLeave={handleProfileMenuLeave}
		p="0px"
		borderRadius="100px"
		display="flex"
		alignItems="center"
		justifyContent="center"
		border="1.2px solid color-mix(in srgb, white 10%, transparent)"
		cursor="pointer"
	  >
		<SpAvatar src={userData.photo_url} username={userData.username} h="15px" w="15px" />
	  </Box>

	  {isProfileMenuOpen && coords && createPortal(
		<Box
		  position="fixed"
		  top={`${coords.top}px`}
		  left={`${coords.left}px`}
		  transform="translateX(-100%)" // прижимаем правым краем к триггеру
		  onMouseEnter={handleProfileMenuEnter}
		  onMouseLeave={handleProfileMenuLeave}
		  style={{
			border: '1px solid var(--chakra-colors-bg-emphasized)',
			borderRadius: '6px',
			padding: '4px',
			backdropFilter: 'blur(10px)',
			minWidth: '320px',
			fontSize: '12px',
			zIndex: 10000,
			background: 'var(--chakra-colors-bg)',
		  }}
		>
		  <Box
			onClick={toggleTheme}
			style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '6px', cursor: 'pointer', borderRadius: '4px' }}
		  >
			{isLight ? <LuMoon /> : <LuSun />}
			{isLight ? "Тёмная тема" : "Светлая тема"}
		  </Box>

		  <Box
			style={{
			  display: 'flex', alignItems: 'center',
			  padding: '6px', marginTop: '4px',
			  borderTop: '1px solid color-mix(in srgb, var(--chakra-colors-bg-inverted) 10%, transparent)',
			  gap: 0,
			}}
		  >
			<IconButton
			  aria-label="Уменьшить шрифт"
			  size="sm"
			  variant="ghost"
			  p={'2px'}
			  h={'15px'}
			  w={'15px'}
			  minH={'15px'}
			  minW={'15px'}
			  onClick={() => {
					const fs = editorRef.current.getFontSize()
					editorRef.current.setFontSize(Math.max(5, fs.current - 1))
			  }}
			>
			  <LuMinus style={{ width: '13px', height: '13px' }} />
			</IconButton>
			
			<Text
			  fontSize="xs" 
			  fontFamily="monospace" 
			  minW="40px" 
			  textAlign="center"
			  userSelect="none"
			>
			  {localFs}px
			</Text>
			
			<IconButton
			  aria-label="Увеличить шрифт"
			  size="sm"
			  variant="ghost"
			  p={'2px'}
			  h={'15px'}
			  minH={'15px'}
			  w={'15px'}
			  minW={'15px'}
			  onClick={() => {
					let fs = editorRef.current.getFontSize()
					// fs.current = JSON.parse(JSON.stringify(Math.min(32, fs.current + 1)))
					fs = Math.min(32, fs.current + 1)
					editorRef.current.setFontSize(fs)
					setLocalFs(fs)
			  }}
			>
			  <LuPlus style={{ width: '13px', height: '13px' }} />
			</IconButton>
			<Spacer/>
			Размер шрифта
		  </Box>
		  <Separator />
		  <Box fontSize={'10px'}>
			{shortcuts.map((shortcut: any, i: number) => (
			  <HStack justifyContent={`space-between`} key={`hstack-${i}`}>
				<Text opacity={0.7}>{shortcut.desc}</Text>
				<Text fontWeight="bold" fontFamily="monospace">{shortcut.key}</Text>
			  </HStack>
			))}
		  </Box>
		</Box>,
		document.body
	  )}
	</>
  );
};



const CollaboratorsMenu = ({ graphId, isOwner }: { graphId: string; isOwner: boolean }) => {
  const [loading, setLoading] = useState(false);
  const [localCols, setLocalCols] = useState<any[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newRole, setNewRole] = useState<'editor'|'viewer'|'banned'>('editor');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const { collaborators } = useGraphCtx() as any;
  const loadCollaboratorsProfiles = useCallback(async () => {
    const dict = collaborators?.current || {};
    const ids = Object.keys(dict);
    if (ids.length === 0) {
      setLocalCols([]);
      return;
    }

    setLoading(true);
    try {
      const profiles = await uReq.search([Query.equal('$id', ids)]);
      const map = new Map((profiles || []).map((p: any) => [p.$id, p]));

      setLocalCols(
        ids.map((userId) => ({
          userId,
          role: dict[userId],
          username: map.get(userId)?.username,
          photo_url: map.get(userId)?.photo_url,
        }))
      );
    } catch (e) {
      console.error('[collaborators] load profiles error', e);
    } finally {
      setLoading(false);
    }
  }, [collaborators, graphId]);

	const f = async()=>{
		const jwt = await spaced_account.createJWT();
		console.log(jwt.jwt);
	}
	f();

  useEffect(() => {
    loadCollaboratorsProfiles();
  }, [loadCollaboratorsProfiles]);

  const persist = useCallback(async (nextList: any[]) => {
    const dict: Record<string, string> = {};
    nextList.forEach((c: any) => { dict[c.userId] = c.role; });

    try {
      await gReq.update(graphId, { collaborators: JSON.stringify(dict) });
      if (collaborators) collaborators.current = dict;
    } catch (e) {
      console.error('[collaborators] persist error', e);
    }
  }, [graphId, collaborators]);

  const handleRemove = async (userId: string) => {
    const next = localCols.filter(c => c.userId !== userId);
    setLocalCols(next);
    try { await persist(next); } catch (e) { console.error(e); }
  };

  useEffect(() => {
    const q = newUsername.trim();
    if (!q) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await uReq.search([Query.startsWith('username', q), Query.limit(5)]);
        setSuggestions(res || []);
      } catch (e) {
        setSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [newUsername]);

  const handleAdd = async (pickedUser?: any) => {
    const targetUsername = pickedUser?.username || newUsername.trim();
    if (!targetUsername) return;
    setIsAdding(true);
    try {
      let user = pickedUser;
      if (!user) {
        const res = await uReq.search([Query.equal('username', targetUsername), Query.limit(1)]);
        user = res && res[0];
      }
      if (!user) {
        console.warn('[collaborators] user not found:', targetUsername);
        return;
      }
      if (localCols.some(c => c.userId === user.$id)) {
        console.warn('[collaborators] already added');
        return;
      }
      const next = [...localCols, {
        userId: user.$id, role: newRole,
        username: user.username, photo_url: user.photo_url,
      }];
      setLocalCols(next);
      await persist(next);
      setNewUsername('');
      setSuggestions([]);
    } catch (e) {
      console.error('[collaborators] add error', e);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Box
      w="100%"
      h="100%"
      display="flex"
      flexDirection="column"
      zIndex={10000}
      pointerEvents="auto">
      <Text fontSize="10px" fontWeight={600} opacity={0.6} px="4px" pb="4px"
        flexShrink={0}
      >
        Доступ к графу
      </Text>

      <VStack
        gap="2px" align="stretch"
        overflowY="auto"
        flex={1}
        minH={0}
        p={'0px 4px'}
      >
        {loading && <Text fontSize="11px" opacity={0.5} px="4px">Загрузка...</Text>}
        {!loading && localCols.length === 0 && (
          <Text fontSize="11px" opacity={0.5} px="4px">Пока нет редакторов</Text>
        )}
        {localCols.map(c => (
          <HStack
            key={c.userId} w="100%" gap="6px" px="4px" py="3px" borderRadius="6px"
            _hover={{ background: 'color-mix(in srgb, var(--chakra-colors-bg-inverted) 6%, transparent)' }}
          >
            <SpAvatar src={c.photo_url} username={c.username} h="18px" w="18px" />
            <VStack gap={0} align="flex-start" flex={1} minW={0}>
              <Text fontSize="11px" fontWeight={500} truncate>{c.username || c.userId}</Text>
              <Text fontSize="10px" fontStyle="italic" opacity={0.5}>{roleLabel(c.role)}</Text>
            </VStack>
            {isOwner&& (
              <IconButton
                aria-label="Удалить"
                size="xs" variant="ghost" h="18px" w="18px" minW="18px"
                onClick={() => handleRemove(c.userId)}
              >
                <LuTrash2 style={{ width: '12px', height: '12px' }} />
              </IconButton>
            )}
          </HStack>
        ))}
      </VStack>


      {isOwner&& (
        <Box position="relative"
          p={'0px 4px'}
          flexShrink={0}
          mb={'20px'}
        >
          <HStack gap="4px">
            <Input
              size="xs"
              fontSize="11px"
              h={'100%'}
              placeholder="никнейм..."
              style={{
                border: '1px solid var(--chakra-colors-bg-emphasized)',
                borderRadius: '3px',
                outline: 'none',
                backgroundColor: 'transparent',
              }}
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            />
            <RoleMenu value={newRole} onChange={setNewRole} />
            <IconButton
              aria-label="Добавить"
              size="xs" variant="solid"
              h="100%" w="22px"
              minW="22px"
              disabled={isAdding || !newUsername.trim()}
              onClick={() => handleAdd()}
            >
              <LuPlus style={{ width: '13px', height: '13px' }} />
            </IconButton>
          </HStack>

          {suggestions.length > 0 && (
            <Box
              zIndex={10001}
              style={{
                backgroundColor: 'var(--chakra-colors-bg)',
                borderRadius: '6px',
                padding: '2px',
              }}
            >
              {suggestions.map((u: any) => (
                <HStack
                  key={u.$id} gap="6px" px="4px" py="3px" cursor="pointer" borderRadius="4px"
                  _hover={{ background: 'color-mix(in srgb, var(--chakra-colors-bg-inverted) 8%, transparent)' }}
                  onClick={() => handleAdd(u)}
                >
                  <SpAvatar src={u.photo_url} username={u.username} h="16px" w="16px" />
                  <Text fontSize="11px">{u.username}</Text>
                </HStack>
              ))}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};



export const UpperHeader = ({
  selfRef,
  treeRef,
  editorRef,
	readOnly,
}: any) => {
  const tabsRef = useRef(null) as any;
  const [localTab, setLocalTab] = useState(selfRef.current?.getMode() || 'eg');
  const [minigraphIds, setMinigraphIds] = useState<string[]>([]);
	const [collabMenuOpen, setCollabMenuOpen] = useState(false) as any;
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady) return; // ждём, пока рефы точно готовы
    if (editorRef?.current?.subscribeMinigraphIds) {
      // подтягиваем актуальные id сразу при подписке
      setMinigraphIds(editorRef.current.getMinigraphIds?.() || []);
      const unsubscribe = editorRef.current.subscribeMinigraphIds(() => {
        setMinigraphIds(editorRef.current.getMinigraphIds());
      });
      return unsubscribe;
    }
  }, [editorRef, isReady]);

  const { id: graphId, owner } = useGraphCtx() as any;
  const currentUser = store.getState().user;
  const isOwner = !!currentUser && !!owner && currentUser.$id === owner;

  const minigraphActionsRef = useRef<any>({});
  minigraphActionsRef.current = {
    onDelete: (ids: string[]) => treeRef.current?.onDelete?.(ids),
    onRepeat: (ids: string[]) => treeRef.current?.onRepeat?.(ids),
    onClose: () => {
      treeRef.current?.onClose?.();
      setMinigraphIds([]);
    },
  };

  // ── Условный ранний выход ТОЛЬКО после всех хуков ──
  if (!isReady || !treeRef?.current || !editorRef?.current) {
    return null;
  }
	const curName=editorRef.current.getName();

  const hasMinigraph = minigraphIds.length > 0;

  return (
    <Box
      className='headerFrame'
      css={headerCSS}
      display={'flex'}
      position={'absolute'}
      flexDirection={'column'}
      gap={'0px'}
      top={'10px'}
      left={'0px'}
      right={'0px'}
      pointerEvents={'none'}
      zIndex={11}
      w={'100%'}
      maxW={'100%'}
      px={'20px'}
      overflow={'hidden'}
    >
      <VStack
        className={'blur-panel'}
        p={'0 !important'}
        gap={0}
        minW={0}
        w={'100%'}
        position={'relative'}
        h={(hasMinigraph||collabMenuOpen) ? '320px' : 'fit-content'}
        transition={'height 0.15s ease'}
        overflow={'hidden'}
      >
        {hasMinigraph && (
          <Box position={'absolute'} inset={0} pointerEvents={'auto'} zIndex={0}>
            <Minigraph ids={minigraphIds} editorRef={minigraphActionsRef} isFloat={false} />
          </Box>
        )}

        <Box className="unified-toolbar">
					{!readOnly && <IconButton
						aria-label="Редакторы"
						size="xs"
						variant="ghost"
						h="20px" w="10px"
						minW={'10px'}
						onClick={()=>{
							setCollabMenuOpen((p:any)=>!p)
						}}
						pointerEvents="auto"
					>
						{collabMenuOpen
							? <LuChevronDown style={{ width: '13px', height: '13px' }} />
							: <LuChevronRight style={{ width: '13px', height: '13px' }} />}
					</IconButton>}

          <GraphCtx.Provider value={{ 
              selfRef: tabsRef, 
              blocks: curName, 
              setBlocks: (p:any)=>{curName.current=p['0']},
              ns: curName,
              setNs: async (p:any)=>{curName.current=p['0'];}
            }}>
              <Box p={0}
								ml={(!readOnly)? '-10px': ''}
                onClickCapture={(e: any) => { if (e.altKey) e.stopPropagation(); }}
                className={'graph-title'}
                overflowX={'auto'}
                scrollbarWidth={'none'}
                textWrap={'nowrap'}
                clip={'auto'}
              >
                <Card
                  id={'0'}
                  content={curName.current as any}
                  options={{ twoSides: false, fontSize: 13, onBlur: (newVal: any) => curName.current = newVal }}
                />
              </Box>
          </GraphCtx.Provider>

          <Spacer/>
          <Tabs.Root
            className='headerTabs'
            value={localTab}
            variant="plain"
            onValueChange={(e: any) => {
              const newValue = e.value;
              setLocalTab(newValue);
              selfRef.current.setMode(newValue); 
            }}
          >
            <Tabs.Trigger className='tabsTrigger' value="eg">Tree view</Tabs.Trigger>
            <Tabs.Trigger className='tabsTrigger' value="repeat" ml={'-6px'}>Feed</Tabs.Trigger>
          </Tabs.Root>
          <ProfileDropdown editorRef={editorRef} />
        </Box>
				{collabMenuOpen && !hasMinigraph && (
					<CollaboratorsMenu graphId={graphId} isOwner={isOwner} />
				)}
      </VStack>
    </Box>
  );
};