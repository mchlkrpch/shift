/** @jsxImportSource @emotion/react */
import { Box, HStack, Separator, Spacer } from "@chakra-ui/react";
import { css } from "@emotion/react";
import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FaChevronRight } from "react-icons/fa";
import { LuChevronLeft } from "react-icons/lu";


export const dropMenuCSS = css`
.menuFrame {
  position: fixed;
  backdrop-filter: blur(20px);
  
  background-color: var(--chakra-colors-bg);
  border: 1.5px solid color-mix(in srgb, var(--chakra-colors-bg-inverted) 10%, var(--chakra-colors-bg));
  
  border-radius: 5px;
  padding: 3px;
  overflow-y: auto;
  min-width: 100px;

  display: flex;
  flex-direction: column;
  gap: 5px;

  font-weight: 400;
  z-index: 12000;

  /* Firefox */
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--chakra-colors-bg-inverted) 10%, var(--chakra-colors-bg)) transparent;
	box-shadow: 0 2px 10px var(--chakra-colors-bg);
}

/* Полный контроль над скроллбаром для Chrome/Edge/Safari (убирает стрелки) */
.menuFrame::-webkit-scrollbar {
  width: 6px;
}
.menuFrame::-webkit-scrollbar-track {
  background: transparent;
}
.menuFrame::-webkit-scrollbar-thumb {
  background-color: color-mix(in srgb, var(--chakra-colors-bg-inverted) 15%, transparent);
  border-radius: 10px;
}
.menuFrame::-webkit-scrollbar-button {
  display: none;
  height: 0;
  width: 0;
}

.menuFrame .tip {
  font-size: 11px;
  opacity: 0.3;
  font-weight: 400;
}

.item {
  width: 100%;
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 4px;
	padding: 2px;
  border-radius: 5px;
  cursor: pointer;
  transition: background 0.1s ease;
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

export interface MenuProps {
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
	const [menu, setMenu] = useState<any>({ isOpen: false, x: 0, y: 0 });
	const open = useCallback((e: any) => {
			e.preventDefault();
			setMenu({ isOpen: true, x: e.clientX, y: e.clientY });
	}, []);
	const close = useCallback(() => {
			setMenu((prev: any) => ({ ...prev, isOpen: false }));
	}, []);
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
}: any, ref: any) => {
	const menuRef = useRef<HTMLDivElement>(null);
	const [pt, setPt] = useState<string[]>([]);
	const [focusedIndex, setFocusedIndex] = useState<number>(0);
	const normalizedItems = useMemo(() => normalizeItems(items), [items]);

	useImperativeHandle(ref, () => ({
			setPath: (pt: any) => setPt(pt),
	}));

	const currentItems = useMemo(() => {
			let current = normalizedItems;
			for (const id of pt) {
					const parent = current.find((i) => i.id === id);
					if (parent?.children) current = parent.children;
					else break;
			}
			return current;
	}, [normalizedItems, pt]);

	// Сброс фокуса при смене уровня вложенности
	useEffect(() => {
			let first = 0;
			while (first < currentItems.length && (currentItems[first].el === 'separator' || currentItems[first].disabled)) {
					first++;
			}
			setFocusedIndex(first < currentItems.length ? first : 0);
	}, [pt, currentItems]);

	// АВТОСКРОЛЛ: Прокручиваем контейнер к активному элементу при хождении стрелками
	useEffect(() => {
			if (!isOpen || !menuRef.current) return;
			const activeElement = menuRef.current.querySelector(`[data-index="${focusedIndex}"]`);
			if (activeElement) {
					activeElement.scrollIntoView({ block: 'nearest' });
			}
	}, [focusedIndex, isOpen]);

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
					const isInput = ['input', 'textarea', 'select'].includes(activeTag || '');

					// === ESCAPE ===
					if (e.key === 'Escape') {
							e.preventDefault();
							e.stopPropagation(); // Блокируем передачу события в редактор
							if (pt.length > 0) {
									setPt((prev) => prev.slice(0, -1));
							} else {
									onClose();
							}
							return;
					}

					// === ВНИЗ ===
					if (e.key === 'ArrowDown') {
							e.preventDefault();
							e.stopPropagation(); // Блокируем передачу события в редактор
							let next = focusedIndex + 1;
							while (next < currentItems.length && (currentItems[next].el === 'separator' || currentItems[next].disabled)) {
									next++;
							}
							if (next < currentItems.length) setFocusedIndex(next);
					} 
					
					// === ВВЕРХ ===
					else if (e.key === 'ArrowUp') {
							e.preventDefault();
							e.stopPropagation(); // Блокируем передачу события в редактор
							let prev = focusedIndex - 1;
							while (prev >= 0 && (currentItems[prev].el === 'separator' || currentItems[prev].disabled)) {
									prev--;
							}
							if (prev >= 0) setFocusedIndex(prev);
					} 
					
					// === ВПРАВО ===
					else if (e.key === 'ArrowRight' && !isInput) {
							e.preventDefault();
							e.stopPropagation(); // Блокируем передачу события в редактор
							const item = currentItems[focusedIndex];
							if (item?.children && item.children.length > 0) {
									setPt((prev) => [...prev, item.id!]);
							}
					} 
					
					// === ВЛЕВО ===
					else if (e.key === 'ArrowLeft' && !isInput) {
							e.preventDefault();
							e.stopPropagation(); // Блокируем передачу события в редактор
							if (pt.length > 0) {
									setPt((prev) => prev.slice(0, -1));
							}
					} 
					
					// === ENTER ===
					else if (e.key === 'Enter' && !isInput) {
							e.preventDefault();
							e.stopPropagation(); // Блокируем передачу события в редактор
							const item = currentItems[focusedIndex];
							if (item && item.el !== 'separator' && !item.disabled) {
									if (item.children && item.children.length > 0) {
											setPt((prev) => [...prev, item.id!]);
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

			// ВАЖНО: Добавляем 'true' в конце. 
			// Это включает "Capture Phase". Document поймает нажатие самым первым, 
			// до того как React передаст его в useKeyDown.
			document.addEventListener('keydown', onKey, true);
			return () => document.removeEventListener('keydown', onKey, true);
	}, [isOpen, pt, focusedIndex, currentItems, onClose, onAction]);

	if (!isOpen) return null;

	const getActiveItem = (): MenuItem | null => {
			if (pt.length === 0) {
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

	const renderMenuItem = (x: MenuItem, index: number) => {
		if (x.el === 'separator') {
			return (<Separator key={x.id} borderColor={'color-mix(in srgb, var(--chakra-colors-fg) 30%, transparent)'} />);
		}
		const hasChildren = !!x.children?.length;
		const isFocused = index === focusedIndex;
		// Это даст идеальный бледно-серый в светлой теме и полупрозрачный белый в темной.
		const bgColor = x.danger
			? 'rgba(220, 38, 38, 0.2)'
			: 'color-mix(in srgb, var(--chakra-colors-fg) 5%, transparent)';

		return (
			<div
				key={x.id}
				data-index={index} // Атрибут для поиска элемента при автоскролле
				onClick={(e) => handleItemClick(e, x)}
				onMouseEnter={() => {
					if (!x.disabled) {
						setFocusedIndex(index);
					}
				}}
				className={'item'}
				style={{
					padding: x.disabled ? '0px' : '2px 3px',
					color: x.danger ? '#fc8181' : 'inherit',
					background: isFocused && !x.disabled ? bgColor : 'transparent',
				}}
			>
				{x.el}
				<Spacer />
				{hasChildren && <FaChevronRight size={10} opacity={.6} />}
				{x.shortcut && (
					<span css={css`font-size: 10px; opacity: 0.5; margin-left: auto;`}>
						{x.shortcut}
					</span>)}
			</div>
		);
	};

	const activeParentItem = getActiveItem();
	const OFFSET = 16;
	const availableWidth = typeof window !== 'undefined' ? window.innerWidth - x - OFFSET : 300;
	const availableHeight = typeof window !== 'undefined' ? window.innerHeight - y - OFFSET : 300;

	return createPortal(
		<span ref={menuRef} css={dropMenuCSS}>
			<Box className='menuFrame' top={y} left={x-5}
				style={{
					maxHeight: Math.min(600, availableHeight)+'px',
					maxWidth: availableWidth + 'px',
					minWidth: Math.min(150, availableWidth) + 'px',
				}}
			>
				<HStack className={'tip'} gap={'2px'}>
					{activeParentItem && (<LuChevronLeft size={'12px'} />)}
					{activeParentItem ? activeParentItem.el : 'cards to mention'}
				</HStack>
				{currentItems.map((x: any, i: number) => renderMenuItem(x, i))}
			</Box>
		</span>, document.body
	);
});