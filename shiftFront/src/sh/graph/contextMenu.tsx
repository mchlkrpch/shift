/** @jsxImportSource @emotion/react */
import { Box, HStack, Separator, Spacer } from "@chakra-ui/react";
import { css } from "@emotion/react";
import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FaChevronRight } from "react-icons/fa";
import { LuChevronLeft } from "react-icons/lu";


// ============================================================================
// CONTEXT MENU (Custom Dropdown Logic)
// ============================================================================


export const dropMenuCSS=css`
.menuFrame{
  position: fixed;
  backdrop-filter:blur(20px);
  background-color: color-mix(in srgb, #223 60%, transparent);
  border: 1px solid color-mix(in srgb, #666 60%, transparent);
  border-radius: 5px;
  padding: 5px;
  max-height: 200px;
  overflow-y: auto;
  min-width: 150px;

  display: flex;
  flex-direction: column;
  gap: 5px;

  font-weight: 400;
  z-index: 12000;
}

.menuFrame .tip{
  font-size: 11px;
  opacity: 0.3;
  font-weight: 400;
}

.item {
  width: 100%;
  font-size:12px;
  display:flex;
  align-items:center;
  gap: 8px;
  border-radius: 3px;
  cursor: pointer;
}
`;


export interface MenuItem {
    id?: string;
    el?: React.ReactNode | 'separator';
    children?: MenuItem[];
    onClick?: (e: React.MouseEvent<HTMLDivElement> | any, data?: any) => void;
    disabled?: boolean;
    danger?: boolean;
    shortcut?: string | React.ReactNode;
    data?: any;
}

export interface MenuProps{
    isOpen: boolean;
    x: number;
    y: number;
    items: MenuItem[];
    onClose: () => void;
    onAction?: (itemId: string, data?: any) => void;
    width?: number;
    zIndex?: number;
}

export const useContextMenu = () => {
    const[menu, setMenu] = useState<any>({ isOpen: false, x: 0, y: 0 });

    const open = useCallback((e: any) => {
        e.preventDefault();
        setMenu({ isOpen: true, x: e.clientX, y: e.clientY });
    },[]);

    const close = useCallback(() => {
        setMenu((prev: any) => ({ ...prev, isOpen: false }));
    },[]);

    return {
        menu, open, close,
        props: {
            isOpen: menu.isOpen,
            x: menu.x,
            y: menu.y,
            onClose: close,
        },
    };
};

const normalizeItems = (menuItems: MenuItem[], prefix = 'item-'): MenuItem[] => {
    return menuItems.map((item, index) => {
        const id = item.id ?? `${prefix}${index}`;
        return {
            ...item,
            id,
            children: item.children ? normalizeItems(item.children, `${id}-`) : undefined,
        };
    });
};

export const ContextMenu = React.forwardRef(({
    isOpen,
    x,
    y,
    items,
    onClose,
    onAction,
}:any,ref:any)=>{
    const menuRef = useRef<HTMLDivElement>(null);
    const[pt,setPt] = useState<string[]>([]);
    const[focusedIndex, setFocusedIndex] = useState<number>(0);
    const normalizedItems = useMemo(() => normalizeItems(items), [items]);

    useImperativeHandle(ref,()=>({
        setPath:(pt:any)=>setPt(pt),
    }))

    const currentItems = useMemo(() => {
        let current = normalizedItems;
        for (const id of pt) {
            const parent = current.find((i) => i.id === id);
            if (parent?.children) current = parent.children;
            else break;
        }
        return current;
    }, [normalizedItems, pt]);

    useEffect(() => {
        let first = 0;
        while (first < currentItems.length && (currentItems[first].el === 'separator' || currentItems[first].disabled)) {
            first++;
        }
        setFocusedIndex(first < currentItems.length ? first : 0);
    }, [pt, currentItems]);

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
                setPt([]);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            const activeTag = document.activeElement?.tagName.toLowerCase();
            const isInput =['input', 'textarea', 'select'].includes(activeTag || '');

            if (e.key === 'Escape') {
                if (pt.length > 0) {
                    setPt((prev) => prev.slice(0, -1));
                } else {
                    onClose();
                }
                return;
            }

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                let next = focusedIndex + 1;
                while (next < currentItems.length && (currentItems[next].el === 'separator' || currentItems[next].disabled)) {
                    next++;
                }
                if (next < currentItems.length) setFocusedIndex(next);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                let prev = focusedIndex - 1;
                while (prev >= 0 && (currentItems[prev].el === 'separator' || currentItems[prev].disabled)) {
                    prev--;
                }
                if (prev >= 0) setFocusedIndex(prev);
            } else if (e.key === 'ArrowRight' && !isInput) {
                e.preventDefault();
                const item = currentItems[focusedIndex];
                if (item?.children && item.children.length > 0) {
                    setPt((prev) => [...prev, item.id!]);
                }
            } else if (e.key === 'ArrowLeft' && !isInput) {
                e.preventDefault();
                if (pt.length > 0) {
                    setPt((prev) => prev.slice(0, -1));
                }
            } else if (e.key === 'Enter' && !isInput) {
                e.preventDefault();
                const item = currentItems[focusedIndex];
                if (item && item.el !== 'separator' && !item.disabled) {
                    if (item.children && item.children.length > 0) {
                        setPt((prev) =>[...prev, item.id!]);
                    } else {
                        item.onClick?.(e, item.data);
                        if (item.id) {
                            onAction?.(item.id, item.data);
                        }
                        onClose();
                        setPt([]);
                    }
                }
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    },[isOpen, pt, focusedIndex, currentItems, onClose, onAction]);

    if (!isOpen) return null;

    const getActiveItem = (): MenuItem | null => {
        if (pt.length===0) {
            return null;
        }
        let current = normalizedItems;
        let activeItem: MenuItem | null = null;
        for (const id of pt) {
            activeItem = current.find((i) => i.id === id) || null;
            if (activeItem?.children) current = activeItem.children;
        }
        return activeItem;
    };

    const handleItemClick = (e: React.MouseEvent<HTMLDivElement>, item: MenuItem) => {
        if (item.disabled || item.el === 'separator') return;
        if (item.children && item.children.length > 0) {
            setPt((prev) => [...prev, item.id!]);
            return;
        }
        const target = e.target as HTMLElement;
        const tagName = target.tagName.toLowerCase();
        if (['input', 'textarea', 'select', 'button'].includes(tagName)) {
            return;
        }

        item.onClick?.(e, item.data);
        if (item.id) {
            onAction?.(item.id, item.data);
        }
        onClose();
        setPt([]);
    };

    const renderMenuItem = (x:MenuItem, index: number) => {
        if (x.el==='separator'){
            return (<Separator key={x.id} borderColor={'color-mix(in srgb, var(--chakra-colors-fg) 30%, transparent)'}/>);
        }

        const hasChildren = !!x.children?.length;
        const isFocused = index === focusedIndex;
        const bgColor=x.danger
            ? 'rgba(220, 38, 38, 0.2)'
            : 'color-mix(in srgb, blue 50%, transparent)';

        return (
            <div
                key={x.id}
                onClick={(e) => handleItemClick(e, x)}
                onMouseEnter={() => {
                    if (!x.disabled) {
                        setFocusedIndex(index);
                    }
                }}
                className={'item'}
                style={{
                    padding:x.disabled?'0px':'4px 6px',
                    color:x.danger?'#fc8181':'inherit',
                    background:isFocused&&!x.disabled? bgColor:'transparent',
                }}
            >
                {x.el}
                <Spacer />
                {hasChildren&&<FaChevronRight size={10} opacity={.6}/>}
                {x.shortcut && (
                <span css={css`font-size: 10px; opacity: 0.5; margin-left: auto;`}>
                    {x.shortcut}
                </span>)}
            </div>
        );
    };

    const activeParentItem = getActiveItem();

    return createPortal(
        <span ref={menuRef} css={dropMenuCSS}>
            <Box className='menuFrame' top={y} left={x}>
                <HStack className={'tip'} gap={'2px'}>
                    {activeParentItem&&(<LuChevronLeft size={'12px'}/>)}
                    {activeParentItem ? activeParentItem.el : 'cards to mention'}
                </HStack>
                {currentItems.map((x:any,i:number)=>renderMenuItem(x,i))}
            </Box>
        </span>,document.body
    );
})