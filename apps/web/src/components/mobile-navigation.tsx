'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';

const EXIT_DURATION = 300;

/** Native modal semantics keep background controls inert and trap keyboard focus. */
export function MobileNavigation({ children }: { readonly children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enterFrame = useRef<number | null>(null);
  const previousOverflow = useRef<string | null>(null);
  const [state, setState] = useState<'closed' | 'entering' | 'open' | 'closing'>('closed');
  const id = useId();
  const pathname = usePathname();

  const restoreScroll = useCallback(() => {
    if (previousOverflow.current !== null) {
      document.body.style.overflow = previousOverflow.current;
      previousOverflow.current = null;
    }
  }, []);

  const finishClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
    if (enterFrame.current !== null) cancelAnimationFrame(enterFrame.current);
    enterFrame.current = null;
    dialog.current?.close();
    restoreScroll();
    setState('closed');
    trigger.current?.focus({ preventScroll: true });
  }, [restoreScroll]);

  const close = useCallback(() => {
    if (!dialog.current?.open || closeTimer.current) return;
    if (enterFrame.current !== null) cancelAnimationFrame(enterFrame.current);
    enterFrame.current = null;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finishClose();
      return;
    }
    setState('closing');
    closeTimer.current = setTimeout(finishClose, EXIT_DURATION);
  }, [finishClose]);

  const open = () => {
    if (!dialog.current || dialog.current.open) return;
    previousOverflow.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setState('entering');
    dialog.current.showModal();
    // Give the translated starting position one paint before animating it in.
    enterFrame.current = requestAnimationFrame(() => {
      enterFrame.current = requestAnimationFrame(() => {
        setState('open');
        dialog.current?.querySelector<HTMLElement>('nav a, nav button')?.focus();
        enterFrame.current = null;
      });
    });
  };

  useEffect(() => {
    // Covers browser back/forward and programmatic navigation as well as links.
    if (dialog.current?.open) finishClose();
  }, [pathname, finishClose]);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 64rem)');
    const onResize = () => {
      if (desktop.matches && dialog.current?.open) finishClose();
    };
    desktop.addEventListener('change', onResize);
    return () => {
      desktop.removeEventListener('change', onResize);
      if (closeTimer.current) clearTimeout(closeTimer.current);
      if (enterFrame.current !== null) cancelAnimationFrame(enterFrame.current);
      restoreScroll();
    };
  }, [finishClose, restoreScroll]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="cc-mobile-menu-button cc-mobile-menu-trigger"
        aria-label="Abrir menu"
        aria-haspopup="dialog"
        aria-expanded={state !== 'closed'}
        aria-controls={id}
        onClick={open}
      >
        <Image src="/carboot/mobile-menu.svg" alt="" aria-hidden="true" width={32} height={19} />
      </button>
      <dialog
        ref={dialog}
        id={id}
        className="cc-mobile-navigation"
        data-state={state}
        aria-label="Menu principal"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClose={() => {
          restoreScroll();
          setState('closed');
        }}
        onClickCapture={(event) => {
          if (event.target instanceof Element && event.target.closest('a[href]')) close();
        }}
        onSubmitCapture={close}
      >
        <button
          type="button"
          className="cc-mobile-menu-scrim"
          aria-label="Fechar menu ao tocar fora"
          tabIndex={-1}
          onClick={close}
        />
        <aside className="cc-mobile-menu-panel" aria-label="Navegação mobile">
          {children}
        </aside>
        <button
          type="button"
          className="cc-mobile-menu-button cc-mobile-menu-close"
          aria-label="Fechar menu"
          onClick={close}
        >
          <Image src="/carboot/mobile-menu.svg" alt="" aria-hidden="true" width={32} height={19} />
        </button>
      </dialog>
    </>
  );
}
