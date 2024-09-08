import { useEffect, useRef } from "react";

import { useRepo } from "@ekad/components/DocProvider";

export default function GraphView() {
  const repo = useRepo();
  const renderCanvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!renderCanvas.current) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      if (!renderCanvas.current) {
        return;
      }
      renderCanvas.current.width = renderCanvas.current.clientWidth * 2;
      renderCanvas.current.height = renderCanvas.current.clientHeight * 2;
      render();
    });
    resizeObserver.observe(renderCanvas.current);

    render();
  }, [renderCanvas.current]);

  return <canvas className="h-full w-full" ref={renderCanvas}></canvas>;

  function render() {
    if (!renderCanvas.current) {
      return;
    }
    const ctx = renderCanvas.current.getContext("2d");
    if (!ctx) {
      return;
    }

    const dx = renderCanvas.current.width / 2;
    const dy = renderCanvas.current.height / 2;
    for (const taskID of repo.tasks()) {
      const task = repo.getTask(taskID);

      ctx.beginPath();
      ctx.fillStyle = "green";
      ctx.strokeStyle = "green";

      ctx.arc(task.x + dx, task.y + dy, 20, 0, 2 * Math.PI);
      ctx.fill();

      for (const blockedByID of Object.keys(task.blockedBy)) {
        const blockedBy = repo.getTask(blockedByID);
        ctx.moveTo(task.x + dx, task.y + dy);
        ctx.lineTo(blockedBy.x + dx, blockedBy.y + dy);
      }
      ctx.stroke();
    }
  }
}
