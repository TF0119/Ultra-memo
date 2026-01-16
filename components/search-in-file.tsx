"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Search, X, ChevronUp, ChevronDown } from "lucide-react"

interface SearchInFileProps {
  isOpen: boolean
  onClose: () => void
  content: string
  textareaRef: React.RefObject<HTMLTextAreaElement>
}

export function SearchInFile({ isOpen, onClose, content, textareaRef }: SearchInFileProps) {
  const [query, setQuery] = useState("")
  const [currentMatch, setCurrentMatch] = useState(0)
  const [matches, setMatches] = useState<number[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // Find all matches
  useEffect(() => {
    if (!query.trim()) {
      setMatches([])
      setCurrentMatch(0)
      return
    }

    const lowerContent = content.toLowerCase()
    const lowerQuery = query.toLowerCase()
    const foundMatches: number[] = []

    let index = 0
    while (index < lowerContent.length) {
      const matchIndex = lowerContent.indexOf(lowerQuery, index)
      if (matchIndex === -1) break
      foundMatches.push(matchIndex)
      index = matchIndex + 1
    }

    setMatches(foundMatches)
    setCurrentMatch(foundMatches.length > 0 ? 1 : 0)
  }, [query, content])

  // Highlight current match in textarea
  useEffect(() => {
    if (matches.length > 0 && currentMatch > 0 && textareaRef.current) {
      const matchIndex = matches[currentMatch - 1]
      textareaRef.current.focus()
      textareaRef.current.setSelectionRange(matchIndex, matchIndex + query.length)
      textareaRef.current.scrollTop =
        (matchIndex / content.length) * textareaRef.current.scrollHeight - textareaRef.current.clientHeight / 2
    }
  }, [currentMatch, matches, query, content, textareaRef])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 0)
    } else {
      setQuery("")
      setMatches([])
      setCurrentMatch(0)
    }
  }, [isOpen])

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      } else if (e.key === "Enter") {
        e.preventDefault()
        if (matches.length > 0) {
          if (e.shiftKey) {
            setCurrentMatch((prev) => (prev <= 1 ? matches.length : prev - 1))
          } else {
            setCurrentMatch((prev) => (prev >= matches.length ? 1 : prev + 1))
          }
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, matches, onClose])

  if (!isOpen) return null

  const goToNext = () => {
    if (matches.length > 0) {
      setCurrentMatch((prev) => (prev >= matches.length ? 1 : prev + 1))
    }
  }

  const goToPrev = () => {
    if (matches.length > 0) {
      setCurrentMatch((prev) => (prev <= 1 ? matches.length : prev - 1))
    }
  }

  return (
    <div className="absolute top-4 right-4 z-10 bg-card border border-border rounded-lg shadow-xl w-80 animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center gap-2 p-3">
        <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="文字検索..."
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground/60"
        />
        {matches.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground tabular-nums">
              {currentMatch}/{matches.length}
            </span>
            <button
              onClick={goToPrev}
              className="p-1 hover:bg-accent rounded transition-colors"
              title="前の一致 (Shift+Enter)"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={goToNext}
              className="p-1 hover:bg-accent rounded transition-colors"
              title="次の一致 (Enter)"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <button onClick={onClose} className="p-1 hover:bg-accent rounded transition-colors" title="閉じる (Esc)">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
