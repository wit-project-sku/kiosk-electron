import { useCallback, useRef } from 'react';
import { useWeatherFxPreviewStore } from './weatherFxPreviewStore';

const LONG_PRESS_MS = 650;

/**
 * Weather-box handlers: short tap keeps the existing video / panel behaviour;
 * long-press cycles the ambient FX preview (clouds → rain → storm → snow → sun).
 */
export function useWeatherFxPreviewHandlers(onShortPress: () => void): {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
  onClick: (e: React.MouseEvent) => void;
} {
  const cyclePreview = useWeatherFxPreviewStore((s) => s.cyclePreview);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressedRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      longPressedRef.current = false;
      clear();
      timerRef.current = setTimeout(() => {
        longPressedRef.current = true;
        cyclePreview();
        timerRef.current = null;
      }, LONG_PRESS_MS);
    },
    [clear, cyclePreview],
  );

  const onPointerUp = useCallback(() => {
    clear();
  }, [clear]);

  const onPointerLeave = useCallback(() => {
    clear();
  }, [clear]);

  const onPointerCancel = useCallback(() => {
    clear();
  }, [clear]);

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      if (longPressedRef.current) {
        e.preventDefault();
        e.stopPropagation();
        longPressedRef.current = false;
        return;
      }
      onShortPress();
    },
    [onShortPress],
  );

  return { onPointerDown, onPointerUp, onPointerLeave, onPointerCancel, onClick };
}
