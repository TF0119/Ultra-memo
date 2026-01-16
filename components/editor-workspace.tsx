"use client"

import { useState, useCallback } from "react"
import { EditorPane } from "./editor-pane"
import { useNoteStore } from "@/lib/store"

export function EditorWorkspace({
  splitMode,
  setSplitMode,
}: {
  splitMode: "single" | "split"
  setSplitMode: (mode: "single" | "split") => void
}) {
  const [splitPosition, setSplitPosition] = useState(50) // percentage
  const { activeNodeIds, focusedPane } = useNoteStore()

  const handleResize = useCallback((e: MouseEvent) => {
    const container = document.getElementById("editor-container")
    if (!container) return

    const rect = container.getBoundingClientRect()
    const percentage = ((e.clientX - rect.left) / rect.width) * 100
    if (percentage >= 20 && percentage <= 80) {
      setSplitPosition(percentage)
    }
  }, [])

  const handleMouseUp = useCallback(() => {
    document.removeEventListener("mousemove", handleResize)
    document.removeEventListener("mouseup", handleMouseUp)
  }, [handleResize])

  const handleMouseDown = () => {
    document.addEventListener("mousemove", handleResize)
    document.addEventListener("mouseup", handleMouseUp)
  }

  return (
    <div id="editor-container" className="h-full flex overflow-hidden bg-background">
      {splitMode === "single" ? (
        <div className="w-full h-full">
          <EditorPane paneId={1} />
        </div>
      ) : (
        <>
          <div style={{ width: `${splitPosition}%` }} className="h-full">
            <EditorPane paneId={1} />
          </div>

          <div
            className="w-1.5 cursor-col-resize bg-border/50 hover:bg-primary/40 active:bg-primary transition-colors flex-shrink-0 relative group"
            onMouseDown={handleMouseDown}
          >
            {/* Resize handle visual indicator */}
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-border group-hover:bg-primary/60 transition-colors" />
          </div>

          <div style={{ width: `${100 - splitPosition}%` }} className="h-full">
            <EditorPane paneId={2} />
          </div>
        </>
      )}
    </div>
  )
}
