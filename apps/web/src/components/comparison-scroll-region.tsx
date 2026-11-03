'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** The document owns vertical scrolling; the region owns horizontal scrolling. */
export function ComparisonScrollRegion({ children }: { readonly children: ReactNode }) {
  const region = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const source = region.current;
    const table = source?.querySelector('table');
    const header = table?.querySelector('thead');
    if (!source || !table || !header) return;
    // A visual copy avoids the overflow-x ancestor trapping CSS sticky positioning.
    // The original table retains its accessible column headers.
    const floating = document.createElement('div');
    floating.className = 'cc-comparison-floating-header';
    floating.setAttribute('aria-hidden', 'true');
    floating.inert = true;
    const copy = table.cloneNode(false) as HTMLTableElement;
    const columns = table.querySelector('colgroup');
    if (columns) copy.append(columns.cloneNode(true));
    copy.append(header.cloneNode(true));
    floating.append(copy);
    document.body.append(floating);
    let frame = 0;
    const update = () => {
      frame = 0;
      const bounds = source.getBoundingClientRect();
      const head = header.getBoundingClientRect();
      const height = head.height;
      floating.hidden = !(head.top < 0 && bounds.bottom > height);
      floating.style.left = `${bounds.left}px`;
      floating.style.width = `${bounds.width}px`;
      copy.style.width = `${table.getBoundingClientRect().width}px`;
      floating.scrollLeft = source.scrollLeft;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const resize = new ResizeObserver(schedule);
    resize.observe(source);
    resize.observe(table);
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    update();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      floating.remove();
    };
  }, [children]);

  const drag = useRef<{ x: number; left: number } | null>(null);
  return (
    <div
      ref={region}
      role="region"
      tabIndex={0}
      aria-label="Comparação rolável de veículos"
      className="comparison-scroll min-w-0 overflow-x-auto"
      onPointerDown={(event) => {
        if (event.pointerType !== 'mouse' || event.button !== 0) return;
        drag.current = { x: event.clientX, left: event.currentTarget.scrollLeft };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.classList.add('cc-dragging');
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        event.currentTarget.scrollLeft = drag.current.left - (event.clientX - drag.current.x);
      }}
      onPointerUp={(event) => {
        drag.current = null;
        event.currentTarget.classList.remove('cc-dragging');
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onLostPointerCapture={(event) => {
        drag.current = null;
        event.currentTarget.classList.remove('cc-dragging');
      }}
    >
      {children}
    </div>
  );
}
