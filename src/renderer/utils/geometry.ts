
import type { BaseWindow } from "@/shared/types";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function checkCollision(rect1: Rect, rect2: Rect): boolean {
  return (
    rect1.x < rect2.x + rect2.width &&
    rect1.x + rect1.width > rect2.x &&
    rect1.y < rect2.y + rect2.height &&
    rect1.y + rect1.height > rect2.y
  );
}

export function findNextAvailablePosition(
  initialX: number,
  initialY: number,
  width: number,
  height: number,
  windows: BaseWindow[],
  gridSize: number
): { x: number; y: number } {
  let x = initialX;
  let y = initialY;
  let direction = 0; // 0: right, 1: down, 2: left, 3: up
  let steps = 1;
  let stepCount = 0;
  let turnCount = 0;

  while (true) {
    let collision = false;
    const currentRect = { x, y, width, height };

    for (const w of windows) {
      const windowRect = {
        x: w.position.x,
        y: w.position.y,
        width: w.size.width,
        height: w.size.height,
      };
      if (checkCollision(currentRect, windowRect)) {
        collision = true;
        break;
      }
    }

    if (!collision) {
      return { x, y };
    }

    // Move to the next position in the spiral
    switch (direction) {
      case 0:
        x += gridSize;
        break;
      case 1:
        y += gridSize;
        break;
      case 2:
        x -= gridSize;
        break;
      case 3:
        y -= gridSize;
        break;
    }

    stepCount++;
    if (stepCount >= steps) {
      stepCount = 0;
      direction = (direction + 1) % 4;
      turnCount++;
      if (turnCount >= 2) {
        turnCount = 0;
        steps++;
      }
    }
  }
}
