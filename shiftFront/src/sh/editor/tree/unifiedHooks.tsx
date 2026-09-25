import {
  useCallback,
} from 'react';
import type {
  DomBlock
} from './unifiedUtils';
import { flushSync } from 'react-dom';


let __idCounter = 0;
export const genId = (prefix: string) =>
  `${prefix}-${Date.now()}-${(__idCounter++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const getOffsetToNode = (root: Node, targetNode: Node, targetOffset: number): number => {
  let currentOffset = 0;
  let textSoFar = '';
  let found = false;
  const appendText = (str: string) => {
    textSoFar += str;
    currentOffset += str.length;
  };
  const walk = (node: Node) => {
    if (found) return;
    if (node === targetNode) {
      if (node.nodeType === Node.TEXT_NODE) {
        appendText(node.textContent?.slice(0, targetOffset) || '');
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        for (let i = 0; i < targetOffset; i++) {
          if (node.childNodes[i]) walk(node.childNodes[i]);
          if (found) return;
        }
      }
      found = true;
      return;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      appendText(node.textContent || '');
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.tagName === 'IMG') {
        appendText(`<img src="${el.getAttribute('src')}" style="${el.getAttribute('style')}" />`);
      } else if (el.classList.contains('inlineCell')) {
        const parts = el.id.split(':');
				const txtToAppend = parts.length === 2 ? `<id=${parts[0]}:${parts[1]}>` : `<id=${el.id}>`
        appendText(txtToAppend);
      } else if (el.tagName === 'BR') {
        appendText('\n');
      } else if (el.tagName === 'DIV' || el.tagName === 'P') {
        if (textSoFar.length > 0 && !textSoFar.endsWith('\n')) appendText('\n');
        for (const child of Array.from(el.childNodes)) { walk(child); if (found) return; }
        if (!found && !textSoFar.endsWith('\n')) appendText('\n');
      } else {
        for (const child of Array.from(el.childNodes)) { walk(child); if (found) return; }
      }
    }
  };
  walk(root);
  return currentOffset;
};



const createOffsetWalker = (root: Node) => {
  let textSoFar = '';
  let currentRawLength = 0;
  let targetNode: Node | null = null;
  let targetOffset = 0;

  const appendText = (str: string) => { textSoFar += str; currentRawLength += str.length; };

  const walk = (node: Node, targetRaw: number): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length || 0;
      if (currentRawLength + len >= targetRaw) {
        targetNode = node;
        targetOffset = targetRaw - currentRawLength;
        return true;
      }
      appendText(node.textContent || '');
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.tagName === 'IMG') {
        const raw = `<img src="${el.getAttribute('src')}" style="${el.getAttribute('style')}" />`;
        if (currentRawLength + raw.length >= targetRaw) {
          targetNode = el.parentNode;
          targetOffset = Array.from(el.parentNode!.childNodes).indexOf(el) + 1;
          return true;
        }
        appendText(raw);
      } else if (el.classList.contains('inlineCell')) {
        const parts = el.id.split(':');
        const rawId = parts.length === 2 ? `<id=${parts[0]}:${parts[1]}>` : `<id=${el.id}>`;
        if (currentRawLength + rawId.length >= targetRaw) {
          targetNode = el.parentNode;
          targetOffset = Array.from(el.parentNode!.childNodes).indexOf(el) + 1;
          return true;
        }
        appendText(rawId);
      } else if (el.tagName === 'BR') {
        if (currentRawLength + 1 >= targetRaw) {
          targetNode = el.parentNode;
          targetOffset = Array.from(el.parentNode!.childNodes).indexOf(el);
          return true;
        }
        appendText('\n');
      } else if (el.tagName === 'DIV' || el.tagName === 'P') {
        if (textSoFar.length > 0 && !textSoFar.endsWith('\n')) {
          if (currentRawLength + 1 >= targetRaw) { targetNode = el; targetOffset = 0; return true; }
          appendText('\n');
        }
        for (const child of Array.from(el.childNodes)) { if (walk(child, targetRaw)) return true; }
        if (!textSoFar.endsWith('\n')) {
          if (currentRawLength + 1 >= targetRaw) { targetNode = el; targetOffset = el.childNodes.length; return true; }
          appendText('\n');
        }
      } else {
        for (const child of Array.from(el.childNodes)) { if (walk(child, targetRaw)) return true; }
      }
    }
    return false;
  };

  return {
    findOffset: (targetRaw: number) => {
      textSoFar = ''; currentRawLength = 0; targetNode = null; targetOffset = 0;
      walk(root, targetRaw);
      return { node: targetNode, offset: targetOffset };
    }
  };
};

export const getBlockInfoFromNode = (node: Node, offset: number, container: HTMLElement) => {
  let curr: Node | null = node;
  let blockIndex = -1;
  let blockElement: HTMLElement | null = null;

  while (curr && curr !== container) {
    if ((curr as HTMLElement).hasAttribute?.('data-index')) {
      blockIndex = parseInt((curr as HTMLElement).getAttribute('data-index')!, 10);
      blockElement = (curr as HTMLElement).querySelector('.tv-block, .tv-group');
      break;
    }
    curr = curr.parentNode;
  }

  if (blockIndex === -1 || !blockElement) return null;
  return { blockIndex, offset: getOffsetToNode(blockElement, node, offset), blockElement };
};

const setCursor = (root: HTMLElement, blockIndex: number, offset: number) => {
  if (!root) return;
  const blockEl = root.querySelector(
    `[data-index="${blockIndex}"] .tv-block, [data-index="${blockIndex}"] .tv-group`
  ) as HTMLElement;
  if (!blockEl) return;

  blockEl.focus();
  const range = document.createRange();
  const s = window.getSelection();

  if (offset === -1) {
    range.selectNodeContents(blockEl);
    range.collapse(false);
  } else {
    const walker = createOffsetWalker(blockEl);
    const { node, offset: nodeOffset } = walker.findOffset(offset);
    if (node) {
      try { range.setStart(node, nodeOffset); range.collapse(true); }
      catch { range.selectNodeContents(blockEl); range.collapse(false); }
    } else {
      range.selectNodeContents(blockEl);
      range.collapse(false);
    }
  }

  s?.removeAllRanges();
  s?.addRange(range);
};

const getActiveBlockIndex = (): number => {
  const sel = window.getSelection();
  if (sel?.rangeCount) {
    const node = sel.getRangeAt(0).startContainer;
    const wrapper = node.nodeType === Node.ELEMENT_NODE
      ? (node as Element).closest('.tv-block-wrapper')
      : node.parentElement?.closest('.tv-block-wrapper');
    if (wrapper) return parseInt(wrapper.getAttribute('data-index') || '-1', 10);
  }
  if (document.activeElement) {
    const wrapper = document.activeElement.closest('.tv-block-wrapper');
    if (wrapper) return parseInt(wrapper.getAttribute('data-index') || '-1', 10);
  }
  return -1;
};



// ─── интерфейс хука ───────────────────────────────────────────────────────────

export const useKeyDown = ({
  editorRef,
  syncDOMToStateRef,
  setBlocksRef,
  onSaveRef,
  convertBlocksRef,
  mentionMenuRef,
  onInsertAIBlocksRef,
  collapsedGroupsRef,
}: any) => {
  // useCallback с пустыми deps — функция создаётся один раз
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const isCmdOrCtrl = e.ctrlKey || e.metaKey;
    if (isCmdOrCtrl) editorRef.current?.classList.add('ctrl-active');

    const key = e.key.toLowerCase();
    const isAlt = e.altKey;
    const isShift = e.shiftKey;

    // читаем актуальное состояние через ref — без замыкания на stale state
    const mm = mentionMenuRef.current;
    const syncDOM = syncDOMToStateRef.current;
    const setBlocks = setBlocksRef.current;

    if (e.key === 'Enter' && e.ctrlKey && !isShift) {
        e.preventDefault();
        
        const wrapper = (e.target as HTMLElement).closest('.tv-block-wrapper');
        if (!wrapper) return;
        
        const blockIndex = parseInt(wrapper.getAttribute('data-index') || '-1');
        if (blockIndex === -1) return;
        
        // Вызываем колбэк из пропсов хука
        onInsertAIBlocksRef.current?.(blockIndex);
        return;
    }

		    // ── Alt + Shift + Enter (Web Clipper Parse) ───────────────────────────────
    if (e.key === 'Enter' && isAlt && isShift) {
        e.preventDefault();
        // 1. Надежный способ найти активный блок через позицию курсора (Selection)
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;

        const node = sel.getRangeAt(0).startContainer;
        const wrapper = node.nodeType === Node.ELEMENT_NODE
            ? (node as Element).closest('.tv-block-wrapper')
            : node.parentElement?.closest('.tv-block-wrapper');

        if (!wrapper) return;

        // 2. Ищем по data-id, так как data-index может отсутствовать во вложенных деревьях
        const blockId = wrapper.getAttribute('data-id');
        if (!blockId) return;

        const currentBlocks = syncDOM();
        const blockIndex = currentBlocks.findIndex((b:any) => b.id === blockId);

        if (blockIndex === -1) return;

        // --- Дальше идет ваша логика парсинга ---
        const currentBlock = currentBlocks[blockIndex];
        const text = currentBlock.text.trim();

        // Ищем URL в тексте блока
        const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
        const urlToFetch = urlMatch ? urlMatch[1] : text;

        if (!urlToFetch) return; // Если URL нет, ничего не делаем

        const spinnerId = `spinner-${Date.now()}`;
        const emptyId = `empty-${Date.now()}`;
        const parentId = currentBlock.parentId; // Сохраняем вложенность

        const newSpinner = { id: spinnerId, text: '', isRendered: false, isSpinner: true, role: 'ai', parentId };
        const newEmpty = { id: emptyId, text: '', isRendered: false, parentId, role: 'user' };

        // Вставляем спиннер и новый пустой блок сразу после текущего
        currentBlocks.splice(blockIndex + 1, 0, newSpinner as DomBlock, newEmpty as DomBlock);
        setBlocks([...currentBlocks]);

        // Фокусируемся на пустом блоке, чтобы можно было писать дальше
        setTimeout(() => setCursor(editorRef.current!, blockIndex + 2, -1), 100);

        // Отправляем запрос на парсинг страницы
        (async () => {
            try {
                const res = await fetch("http://localhost:3001/api/parse-page", {
                    method: "POST", 
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ url: urlToFetch })
                });
                const data = await res.json();
                let parsedContent = '';
                if (data.blocks && data.blocks.length > 0) {
                  parsedContent = data.blocks.join('\n');
                } else {
                  parsedContent = '[Не удалось извлечь контент]';
                }

                // Заново синхронизируем DOM, так как за время ожидания структура могла измениться
                const latestBlocks = syncDOM();
                const spinnerIdx = latestBlocks.findIndex((b:any) => b.id === spinnerId);
                
                if (spinnerIdx !== -1) {
                    latestBlocks[spinnerIdx] = { 
                        ...latestBlocks[spinnerIdx], 
                        isSpinner: false, 
                        text: parsedContent, 
                        isRendered: true, // Сразу рендерим, как в clipper
                        role: 'ai' 
                    };
                    setBlocks([...latestBlocks]);
                }
            } catch (err) {
                console.error("Ошибка парсинга страницы:", err);
                const latestBlocks = syncDOM();
                const spinnerIdx = latestBlocks.findIndex((b:any) => b.id === spinnerId);
                if (spinnerIdx !== -1) {
                    latestBlocks[spinnerIdx] = { 
                        ...latestBlocks[spinnerIdx],
                        isSpinner: false, 
                        text: '[Ошибка загрузки страницы]', 
                        role: 'ai' 
                    };
                    setBlocks([...latestBlocks]);
                }
            }
        })();
        
        return;
    }

    // ── Mention menu ──────────────────────────────────────────────────────────
    if (mm.isOpen) {
      if (['arrowdown', 'arrowup', 'arrowleft', 'arrowright', 'enter'].includes(key)) {
        e.preventDefault(); return;
      }
      if (key === 'escape') { e.preventDefault(); mm.setOpen(false); return; }
      if (key === 'backspace') {
        if (mm.query.length === 0) mm.setOpen(false);
        else mm.backspaceQuery();
        return;
      }
      if (key.length === 1 && !isCmdOrCtrl && !isAlt) { mm.appendQuery(e.key); return; }
    } else if (key === '/' && !isCmdOrCtrl && !isAlt) {
      setTimeout(() => {
        const s = window.getSelection();
        if (s?.rangeCount) mm.openAt(s.getRangeAt(0).cloneRange());
      }, 10);
    }

    // ── Cmd+Q — toggle render ─────────────────────────────────────────────────
    if (isCmdOrCtrl && (key === 'q' || key === 'й')) {
      e.preventDefault();
      const idx = getActiveBlockIndex();
      if (idx === -1) return;
      const cur = syncDOM();
      if (cur[idx]) { cur[idx].isRendered = !cur[idx].isRendered; setBlocks([...cur]); }
      return;
    }

    const sel = window.getSelection();
    if (!sel || !editorRef.current) return;

    const getInfo = () => {
      if (sel.rangeCount === 0) return null;
      const r = sel.getRangeAt(0);
      return getBlockInfoFromNode(r.startContainer, r.startOffset, editorRef.current!);
    };

    // ── Alt+↑/↓ — move line ───────────────────────────────────────────────────
    if (isAlt && !isShift && (key === 'arrowup' || key === 'arrowdown')) {
      e.preventDefault();
      if (sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const startInfo = getBlockInfoFromNode(range.startContainer, range.startOffset, editorRef.current);
      const endInfo   = getBlockInfoFromNode(range.endContainer,   range.endOffset,   editorRef.current);
      if (!startInfo || !endInfo) return;

      const currentBlocks = syncDOM();
      const direction = key === 'arrowup' ? -1 : 1;

			

      if (startInfo.blockIndex === endInfo.blockIndex) {
        const block = currentBlocks[startInfo.blockIndex];
        if (!block) return;

        const lines = block.text.split('\n');
        const startLine = block.text.substring(0, startInfo.offset).split('\n').length - 1;
        const endLine   = block.text.substring(0, endInfo.offset).split('\n').length - 1;
        const wasCollapsed = range.collapsed;

        let charsBeforeStartLine = 0;
        for (let i = 0; i < startLine; i++) charsBeforeStartLine += lines[i].length + 1;
        const offsetInStartLine = startInfo.offset - charsBeforeStartLine;

        let charsBeforeEndLine = 0;
        for (let i = 0; i < endLine; i++) charsBeforeEndLine += lines[i].length + 1;
        const offsetInEndLine = endInfo.offset - charsBeforeEndLine;

        const isAtTopOfBlock    = startLine === 0 && direction === -1;
        const isAtBottomOfBlock = endLine === lines.length - 1 && direction === 1;

        if (isAtTopOfBlock || isAtBottomOfBlock) {
          const targetBlockIndex = startInfo.blockIndex + direction;
          if (targetBlockIndex < 0 || targetBlockIndex >= currentBlocks.length) return;

          const targetBlock  = currentBlocks[targetBlockIndex];
          const selectedLines = lines.slice(startLine, endLine + 1);

          if (direction === -1) {
            const remainingLines = lines.slice(endLine + 1);
            targetBlock.text = targetBlock.text + '\n' + selectedLines.join('\n');
            block.text = remainingLines.join('\n');
            flushSync(() => setBlocks([...currentBlocks]));

            setTimeout(() => {
              const targetLines = targetBlock.text.split('\n');
              const newLineIndex = targetLines.length - selectedLines.length;
              let newStartOffset = 0;
              for (let i = 0; i < newLineIndex; i++) newStartOffset += targetLines[i].length + 1;
              newStartOffset += offsetInStartLine;

              if (wasCollapsed) {
                setCursor(editorRef.current!, targetBlockIndex, newStartOffset);
              } else {
                const blockEl = document.querySelector(
                  `[data-index="${targetBlockIndex}"] .tv-block, [data-index="${targetBlockIndex}"] .tv-group`
                ) as HTMLElement;
                if (!blockEl) return;
                blockEl.focus();
                const r = document.createRange();
                const s = window.getSelection();
                const w1 = createOffsetWalker(blockEl);
                const { node: sn, offset: so } = w1.findOffset(newStartOffset);
                const w2 = createOffsetWalker(blockEl);
                const { node: en, offset: eo } = w2.findOffset(targetBlock.text.length);
                if (sn && en) { r.setStart(sn, so); r.setEnd(en, eo); s?.removeAllRanges(); s?.addRange(r); }
              }
            }, 10);
          } else {
            const remainingLines = lines.slice(0, startLine);
            targetBlock.text = selectedLines.join('\n') + '\n' + targetBlock.text;
            block.text = remainingLines.join('\n');
            setBlocks([...currentBlocks]);

            setTimeout(() => {
              if (wasCollapsed) {
                setCursor(editorRef.current!, targetBlockIndex, offsetInStartLine);
              } else {
                const blockEl = document.querySelector(
                  `[data-index="${targetBlockIndex}"] .tv-block, [data-index="${targetBlockIndex}"] .tv-group`
                ) as HTMLElement;
                if (!blockEl) return;
                blockEl.focus();
                const r = document.createRange();
                const s = window.getSelection();
                const w1 = createOffsetWalker(blockEl);
                const { node: sn, offset: so } = w1.findOffset(offsetInStartLine);
                const w2 = createOffsetWalker(blockEl);
                const { node: en, offset: eo } = w2.findOffset(selectedLines.join('\n').length);
                if (sn && en) { r.setStart(sn, so); r.setEnd(en, eo); s?.removeAllRanges(); s?.addRange(r); }
              }
            }, 10);
          }
          return;
        }

        if (lines.length <= 1) return;
        const newLines = [...lines];

        if (direction === -1) {
          const selectedLines = newLines.splice(startLine, endLine - startLine + 1);
          const lineAbove = newLines.splice(startLine - 1, 1)[0];
          newLines.splice(startLine - 1, 0, ...selectedLines, lineAbove);
        } else {
          const lineBelow = newLines.splice(endLine + 1, 1)[0];
          const selectedLines = newLines.splice(startLine, endLine - startLine + 1);
          newLines.splice(startLine, 0, lineBelow, ...selectedLines);
        }

        block.text = newLines.join('\n');
        setBlocks([...currentBlocks]);

        setTimeout(() => {
          const blockEl = document.querySelector(
            `[data-index="${startInfo.blockIndex}"] .tv-block, [data-index="${startInfo.blockIndex}"] .tv-group`
          ) as HTMLElement;
          if (!blockEl) return;

          const newStartLine = startLine + direction;
          const newEndLine   = endLine   + direction;

          let newStartOffset = 0;
          for (let i = 0; i < newStartLine; i++) newStartOffset += newLines[i].length + 1;
          newStartOffset += offsetInStartLine;

          if (wasCollapsed) {
            setCursor(editorRef.current!, startInfo.blockIndex, newStartOffset);
          } else {
            blockEl.focus();
            const r = document.createRange();
            const s = window.getSelection();
            const w1 = createOffsetWalker(blockEl);
            const { node: sn, offset: so } = w1.findOffset(newStartOffset);

            let newEndOffset = 0;
            for (let i = 0; i < newEndLine; i++) newEndOffset += newLines[i].length + 1;
            newEndOffset += offsetInEndLine;

            const w2 = createOffsetWalker(blockEl);
            const { node: en, offset: eo } = w2.findOffset(newEndOffset);
            if (sn && en) { r.setStart(sn, so); r.setEnd(en, eo); s?.removeAllRanges(); s?.addRange(r); }
          }
        }, 10);
      }
      return;
    }

    // ── Alt+Shift+↑/↓ — move block ───────────────────────────────────────────
    if (isAlt && isShift && (key === 'arrowup' || key === 'arrowdown')) {
      const collapsedGroups = collapsedGroupsRef.current;
      e.preventDefault();
      if (sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const startInfo = getBlockInfoFromNode(range.startContainer, range.startOffset, editorRef.current);
      const endInfo   = getBlockInfoFromNode(range.endContainer,   range.endOffset,   editorRef.current);
      if (!startInfo || !endInfo) return;

      let startIdx = Math.min(startInfo.blockIndex, endInfo.blockIndex);
      let endIdx   = Math.max(startInfo.blockIndex, endInfo.blockIndex);
      const originalEndIdx = endIdx; // Запоминаем оригинальный конец выделения для фокуса

      const currentBlocks = syncDOM();
      const direction = key === 'arrowup' ? -1 : 1;
      const wasMultiBlock = startIdx !== originalEndIdx;

      const blockMap = new Map<string,DomBlock>(currentBlocks.map((b:DomBlock) => [b.id, b]));
      const getChain = (block: DomBlock) => {
        const chain = [];
        let p = block.parentId;
        while (p && blockMap.has(p)) { chain.unshift(p); p = blockMap.get(p)?.parentId; }
        return chain;
      };

      // --- НОВОЕ 1: Расширяем endIdx, чтобы захватить всех потомков ---
      // Идем вниз по массиву и проверяем: если блок является потомком любого блока из изначального выделения,
      // значит он часть "чанка", который нужно тянуть с собой.
      let expandedEndIdx = endIdx;
      for (let i = originalEndIdx + 1; i < currentBlocks.length; i++) {
        let isDescendant = false;
        let currId = currentBlocks[i].parentId;
        while (currId) {
          const pIdx = currentBlocks.findIndex((b:any) => b.id === currId);
          if (pIdx >= startIdx && pIdx <= originalEndIdx) {
            isDescendant = true;
            break;
          }
          currId = blockMap.get(currId)?.parentId;
        }
        if (isDescendant) expandedEndIdx = i;
        else break; // Т.к. потомки идут подряд, прерываем при первом чужом блоке
      }
      endIdx = expandedEndIdx;
      // ---------------------------------------------------------------

      const restoreFocus = (newStart:any) => {
        setTimeout(() => {
          if (wasMultiBlock) {
            const firstEl = document.querySelector(
              `[data-index="${newStart}"] .tv-block, [data-index="${newStart}"] .tv-group`) as any;
            // Фокус возвращаем только на изначально выделенный визуальный блок (без всех потомков)
            const visualEnd = newStart + (originalEndIdx - startIdx);
            const lastEl  = document.querySelector(
              `[data-index="${visualEnd}"] .tv-block, [data-index="${visualEnd}"] .tv-group`) as any;
            if (firstEl && lastEl) {
              firstEl.focus();
              const r = document.createRange();
              const s = window.getSelection();
              r.setStart(firstEl.firstChild || firstEl, 0);
              r.setEnd(lastEl.lastChild || lastEl, lastEl.lastChild?.length || 0);
              s?.removeAllRanges();
              s?.addRange(r);
            }
          } else {
            setCursor(editorRef.current!, newStart, startInfo.offset);
          }
        }, 10);
      };

      // Безопасная смена parentId ---
      // Меняет родителя только у тех блоков выделенного куска, которые являются корневыми для этого куска.
      // Это сохраняет вложенность внутренних детей при перетаскивании.
      const updateRootsParent = (blocksChunk: any, newParentId: any) => {
        const chunkIds = new Set(blocksChunk.map((b:any) => b.id));
        const rootIds = new Set(blocksChunk.filter((b:any) => !b.parentId || !chunkIds.has(b.parentId)).map((b:any) => b.id));
        
        blocksChunk.forEach((b:any) => {
          // Обратите внимание: убрано условие !b.isGroup для корней.
          // Иначе группы не смогут менять свой отступ при прыжках вверх/вниз
          if (rootIds.has(b.id)) {
            b.parentId = newParentId;
          }
        });
      };
      // ------------------------------------------

      if (direction === -1) {
        if (startIdx === 0) return;
        let topCollapsedAncestorIdx = -1;
        let pId = currentBlocks[startIdx - 1].parentId;
        while (pId) {
            if (collapsedGroups.has(pId)) {
                topCollapsedAncestorIdx = currentBlocks.findIndex((b:any) => b.id === pId);
            }
            pId = blockMap.get(pId)?.parentId;
        }

        if (topCollapsedAncestorIdx !== -1) {
            const jumpStart = topCollapsedAncestorIdx;
            const jumpEnd = startIdx - 1;
            const targetParent = currentBlocks[jumpStart].parentId;

            const selectedBlocks = currentBlocks.slice(startIdx, endIdx + 1);
            const bypassedBlocks = currentBlocks.slice(jumpStart, jumpEnd + 1);

            updateRootsParent(selectedBlocks, targetParent); // Заменили forEach

            setBlocks([
                ...currentBlocks.slice(0, jumpStart),
                ...selectedBlocks,
                ...bypassedBlocks,
                ...currentBlocks.slice(endIdx + 1)
            ]);
            
            restoreFocus(jumpStart);
            return;
        }

        const selectedBlocks = currentBlocks.slice(startIdx, endIdx + 1);
        const blockAbove     = currentBlocks[startIdx - 1];
        const firstSelected  = selectedBlocks[0];

        const chainAbove = getChain(blockAbove);
        const chainCurr  = getChain(firstSelected);

        let action;
        let targetParentId;

        if (chainAbove.length > chainCurr.length) {
          action = 'indent'; targetParentId = chainAbove[chainCurr.length];
        } else if (blockAbove.isGroup && chainAbove.length === chainCurr.length && firstSelected.parentId !== blockAbove.id) {
          action = 'indent'; targetParentId = blockAbove.id;
        } else if (firstSelected.parentId === blockAbove.id) {
          action = 'outdent_swap'; targetParentId = blockAbove.parentId;
        } else {
          action = 'swap'; targetParentId = blockAbove.parentId;
        }

        if (action === 'indent') {
          updateRootsParent(selectedBlocks, targetParentId); // Заменили forEach
          setBlocks([...currentBlocks]);
          restoreFocus(startIdx);
        } else {
          updateRootsParent(selectedBlocks, targetParentId); // Заменили forEach
          setBlocks([
            ...currentBlocks.slice(0, startIdx - 1),
            ...selectedBlocks,
            blockAbove,
            ...currentBlocks.slice(endIdx + 1),
          ]);
          restoreFocus(startIdx - 1);
        }
      } else {
        if (endIdx === currentBlocks.length - 1) return;

        const blockBelow = currentBlocks[endIdx + 1];
        // Теперь блок ниже - это действительно блок ПОСЛЕ всех детей группы!
        if (collapsedGroups.has(blockBelow.id)) {
            let groupEndIdx = endIdx + 1;
            for (let i = endIdx + 2; i < currentBlocks.length; i++) {
                let isDescendant = false;
                let currPId = currentBlocks[i].parentId;
                while(currPId) {
                    if (currPId === blockBelow.id) { isDescendant = true; break; }
                    currPId = blockMap.get(currPId)?.parentId;
                }
                if (isDescendant) groupEndIdx = i;
                else break;
            }

            const targetParent = blockBelow.parentId;
            const selectedBlocks = currentBlocks.slice(startIdx, endIdx + 1);
            const bypassedBlocks = currentBlocks.slice(endIdx + 1, groupEndIdx + 1);

            updateRootsParent(selectedBlocks, targetParent); // Заменили forEach

            setBlocks([
                ...currentBlocks.slice(0, startIdx),
                ...bypassedBlocks,
                ...selectedBlocks,
                ...currentBlocks.slice(groupEndIdx + 1)
            ]);
            
            const newStart = startIdx + bypassedBlocks.length;
            restoreFocus(newStart);
            return;
        }

        const selectedBlocks = currentBlocks.slice(startIdx, endIdx + 1);
        const firstSelected  = selectedBlocks[0];

        const chainBelow = getChain(blockBelow);
        const chainCurr  = getChain(firstSelected);

        let action;
        let targetParentId;

        if (blockBelow.isGroup && chainCurr.length <= chainBelow.length) {
          action = 'swap_indent'; targetParentId = blockBelow.id;
        } else if (chainCurr.length > chainBelow.length) {
          action = 'outdent'; targetParentId = chainCurr.length >= 2 ? chainCurr[chainCurr.length - 2] : undefined;
        } else {
          action = 'swap'; targetParentId = blockBelow.parentId;
        }

        if (action === 'outdent') {
          updateRootsParent(selectedBlocks, targetParentId); // Заменили forEach
          setBlocks([...currentBlocks]);
          restoreFocus(startIdx);
        } else {
          updateRootsParent(selectedBlocks, targetParentId); // Заменили forEach
          setBlocks([
            ...currentBlocks.slice(0, startIdx),
            blockBelow,
            ...selectedBlocks,
            ...currentBlocks.slice(endIdx + 2),
          ]);
          restoreFocus(startIdx + 1);
        }
      }
      return;
		}

    // ── Multiblock selection edit ─────────────────────────────────────────────
    if (sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed) {
      const range = sel.getRangeAt(0);
      const startInfo = getBlockInfoFromNode(range.startContainer, range.startOffset, editorRef.current);
      const endInfo   = getBlockInfoFromNode(range.endContainer,   range.endOffset,   editorRef.current);

      if (startInfo && endInfo && startInfo.blockIndex !== endInfo.blockIndex) {
        const isDelete    = key === 'backspace' || key === 'delete';
        const isEnter     = key === 'enter';
        const isPrintable = key.length === 1 && !isCmdOrCtrl;

        if (isDelete || isEnter || isPrintable) {
          e.preventDefault();
          let si = startInfo.blockIndex, ei = endInfo.blockIndex;
          let so = startInfo.offset,     eo = endInfo.offset;
          if (si > ei) { [si, ei] = [ei, si]; [so, eo] = [eo, so]; }

          const cur = syncDOM();
          const sb = cur[si], eb = cur[ei];
          const before = sb.text.substring(0, so);
          const after  = eb.text.substring(eo);

          // 🔧 ВАЖНО: Разрываем выделение до мутации DOM через flushSync
          sel.removeAllRanges();

          if (isEnter && !isShift) {
            sb.text = before;
            cur.splice(si + 1, ei - si, {
              id: genId('blk'),
              text: after,
              isRendered: false,
              parentId: sb.isGroup ? sb.id : sb.parentId,
            });
            flushSync(() => setBlocks([...cur]));
            requestAnimationFrame(() => setCursor(editorRef.current!, si + 1, 0));
          } else {
            const replacement = isPrintable ? e.key : (isEnter && isShift ? '\n' : '');
            sb.text = before + replacement + after;
            cur.splice(si + 1, ei - si);
            flushSync(() => setBlocks([...cur]));
            requestAnimationFrame(() => setCursor(editorRef.current!, si, so + replacement.length));
          }
          return;
        }
      }
    }

    // ── Delete at block end (НОВЫЙ ОБРАБОТЧИК) ───────────────────────────────
    if (key === 'delete') {
      const info = getInfo();
      if (info && sel.getRangeAt(0).collapsed) {
        const cur = syncDOM();
        const current = cur[info.blockIndex];
        
        // Если стоим в самом конце блока и нажимаем Delete
        if (current && info.offset === current.text.length && info.blockIndex < cur.length - 1) {
          e.preventDefault();
          
          const next = cur[info.blockIndex + 1];
          // Игнорируем сливание с AI контейнерами/спиннерами
          if (!current.isAIChatContainer && !next.isAIChatContainer && !current.isSpinner && !next.isSpinner) {
            sel.removeAllRanges();
            
            const currentLen = current.text.length;
            current.text += next.text;
            cur.splice(info.blockIndex + 1, 1);
            
            flushSync(() => setBlocks([...cur]));
            requestAnimationFrame(() => {
              setCursor(editorRef.current, info.blockIndex, currentLen);
            });
          }
          return;
        }
      }
    }

    // ── Backspace at block start ──────────────────────────────────────────────

    if (key === 'backspace') {
      const info = getInfo();
      if (info && info.offset === 0 && sel.getRangeAt(0).collapsed) {
        e.preventDefault();
        const cur = syncDOM();
        if (cur.length === 1) return;
        const current = cur[info.blockIndex];

        // снимаем selection ДО удаления/мутации DOM,
        // чтобы браузер не трогал focus/caret одновременно с React
        sel.removeAllRanges();

        if (!current.text.trim() && info.blockIndex > 0) {
          cur.splice(info.blockIndex, 1);
          flushSync(() => setBlocks([...cur]));
          // переносим .focus() на следующий кадр,
          // чтобы DOM после commit'а успел "устаканиться"
          requestAnimationFrame(() => {
            setCursor(editorRef.current, info.blockIndex - 1, -1);
          });
          return;
        }
        if (info.blockIndex > 0) {
          const prev = cur[info.blockIndex - 1];
          const prevLen = prev.text.length;
          prev.text += current.text;
          cur.splice(info.blockIndex, 1);
          flushSync(() => setBlocks([...cur]));
          requestAnimationFrame(() => {
            setCursor(editorRef.current, info.blockIndex - 1, prevLen);
          });
        }
      }
      return;
    }

    // ── Enter ─────────────────────────────────────────────────────────────────
    if (key === 'enter' && !isShift) {
      e.preventDefault();
      const info = getInfo();
      if (!info) return;
      const cur = syncDOM();
      const block = cur[info.blockIndex];
      if (!block) return;

      const newBlockIndex = info.blockIndex + 1;

      cur.splice(info.blockIndex, 1,
        { ...block, text: block.text.substring(0, info.offset) },
        {
          id: genId('blk'),
          text: block.text.substring(info.offset),
          isRendered: false,
          parentId: block.isGroup ? block.id : block.parentId,
        }
      );

      // перестроит DOM внутри contentEditable-блока
      sel.removeAllRanges();

      flushSync(() => setBlocks([...cur]));
      // чтобы браузер не нормализовал DOM параллельно с React
      requestAnimationFrame(() => {
        setCursor(editorRef.current, newBlockIndex, 0);
      });
      return;
    }

    if (key === 'enter' && isShift) {
      e.preventDefault();
      document.execCommand('insertLineBreak');
      return;
    }

    // ── Cmd+G — group ─────────────────────────────────────────────────────────
    if (isCmdOrCtrl && key === 'g') {
      e.preventDefault();
      if (sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const startInfo = getBlockInfoFromNode(range.startContainer, range.startOffset, editorRef.current);
      const endInfo   = getBlockInfoFromNode(range.endContainer,   range.endOffset,   editorRef.current);
      if (!startInfo || !endInfo) return;

      const si = Math.min(startInfo.blockIndex, endInfo.blockIndex);
      const ei = Math.max(startInfo.blockIndex, endInfo.blockIndex);
      const cur = syncDOM();
      const groupId = genId('grp');

      const newGroup: DomBlock = {
        id: groupId, text: 'Новая группа',
        isRendered: false, isGroup: true,
        parentId: cur[si].parentId,
      };
      for (let i = si; i <= ei; i++) cur[i].parentId = groupId;
      cur.splice(si, 0, newGroup);

      sel.removeAllRanges();

      flushSync(() => setBlocks([...cur]));
      requestAnimationFrame(() => {
        setCursor(editorRef.current, si, -1);
      });
      return;
    }

    // ── Cmd+S — save ──────────────────────────────────────────────────────────
    if (isCmdOrCtrl && key === 's') {
      e.preventDefault();
      const cur = syncDOM();
      onSaveRef.current?.(convertBlocksRef.current(cur));
      return;
    }
  }, []);

  const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
    if (!e.ctrlKey && !e.metaKey) {
      editorRef.current?.classList.remove('ctrl-active');
    }
  }, []);

  return { handleKeyDown, handleKeyUp };
};
