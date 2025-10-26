import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Search } from 'lucide-react'
import type { SupportedChain } from '../../hooks/useNetwork'
import { CHAIN_CONFIGS, getChainConfig } from '../../hooks/useNetwork'
import './ChainSelector.css'

interface ChainSelectorProps {
  selectedChain: SupportedChain
  onChainChange: (chain: SupportedChain) => void
}

export function ChainSelector({ selectedChain, onChainChange }: ChainSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const [showDropdown, setShowDropdown] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)

  const selectedConfig = getChainConfig(selectedChain)

  // Calculate dropdown position - use left on mobile, right on desktop
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const isMobile = window.innerWidth < 640
      
      if (isMobile) {
        // On mobile: center dropdown or align to left edge
        const dropdownWidth = 256 // w-64 = 16rem = 256px
        let left = Math.max(8, (window.innerWidth - dropdownWidth) / 2)
        setDropdownPosition({
          top: rect.bottom + 4,
          left
        })
      } else {
        // On desktop: align to button's right edge
        setDropdownPosition({
          top: rect.bottom + 4,
          left: rect.right - 256 // w-64 = 256px
        })
      }
      // Show dropdown after position is calculated
      setShowDropdown(true)
    } else {
      setShowDropdown(false)
    }
  }, [isOpen])

  // Group chains by category
  const mainnets = Object.keys(CHAIN_CONFIGS).filter(
    (key) => CHAIN_CONFIGS[key as SupportedChain].category === 'mainnet'
  ) as SupportedChain[]

  const testnets = Object.keys(CHAIN_CONFIGS).filter(
    (key) => CHAIN_CONFIGS[key as SupportedChain].category === 'testnet'
  ) as SupportedChain[]

  // Filter by search
  const filterChains = (chains: SupportedChain[]) => {
    if (!search) return chains
    return chains.filter((key) => {
      const config = getChainConfig(key)
      return config.name.toLowerCase().includes(search.toLowerCase())
    })
  }

  const filteredMainnets = filterChains(mainnets)
  const filteredTestnets = filterChains(testnets)
  
  // Combine all filtered chains for keyboard navigation
  const allFilteredChains = [...filteredMainnets, ...filteredTestnets]

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (chain: SupportedChain) => {
    onChainChange(chain)
    setIsOpen(false)
    setSearch('')
    setFocusedIndex(-1)
  }
  
  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!allFilteredChains.length) return
    
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIndex(prev => 
        prev < allFilteredChains.length - 1 ? prev + 1 : 0
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIndex(prev => 
        prev > 0 ? prev - 1 : allFilteredChains.length - 1
      )
    } else if (e.key === 'Enter' && focusedIndex >= 0) {
      e.preventDefault()
      handleSelect(allFilteredChains[focusedIndex])
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }
  
  // Reset focused index when search changes
  useEffect(() => {
    setFocusedIndex(-1)
  }, [search])

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-xs sm:text-sm bg-background border border-input rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        <img src={CHAIN_CONFIGS[selectedChain].logoUrl} alt="" className="w-4 h-4 rounded-full shadow-md" />
        <span className="truncate max-w-[120px]">{selectedConfig.name}</span>
        <ChevronDown className="w-4 h-4 shrink-0" />
      </button>

      {showDropdown && createPortal(
        <div 
          ref={dropdownRef}
          className="fixed w-64 bg-[#0a0a0a] backdrop-blur-2xl border-2 border-white/20 rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.8)] z-[9999] overflow-hidden ring-1 ring-white/10"
          style={{ top: `${dropdownPosition.top}px`, left: `${dropdownPosition.left}px` }}
        >
          {/* Search */}
          <div className="p-2 border-b border-white/10 bg-[#0a0a0a]/95">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search networks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full pl-8 pr-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
            </div>
          </div>

          {/* Chain list */}
          <div className="max-h-80 overflow-y-auto chain-selector-scroll">
            {filteredMainnets.length > 0 && (
              <div>
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/50">
                  Mainnets
                </div>
                {filteredMainnets.map((key, idx) => {
                  const config = getChainConfig(key)
                  const chainConfig = CHAIN_CONFIGS[key]
                  const isFocused = focusedIndex === idx
                  return (
                    <button
                      key={key}
                      onClick={() => handleSelect(key)}
                      className={`w-full px-3 py-2 text-sm text-left transition-colors flex items-center gap-2 ${
                        selectedChain === key 
                          ? 'bg-accent text-accent-foreground' 
                          : isFocused 
                            ? 'bg-accent/50 hover:bg-accent/70' 
                            : 'hover:bg-accent/50'
                      }`}
                    >
                      <img src={chainConfig.logoUrl} alt="" className="w-5 h-5 rounded-full shadow-md" />
                      {config.name}
                    </button>
                  )
                })}
              </div>
            )}

            {filteredTestnets.length > 0 && (
              <div>
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/50">
                  Testnets
                </div>
                {filteredTestnets.map((key, idx) => {
                  const config = getChainConfig(key)
                  const chainConfig = CHAIN_CONFIGS[key]
                  const globalIdx = filteredMainnets.length + idx
                  const isFocused = focusedIndex === globalIdx
                  return (
                    <button
                      key={key}
                      onClick={() => handleSelect(key)}
                      className={`w-full px-3 py-2 text-sm text-left transition-colors flex items-center gap-2 ${
                        selectedChain === key 
                          ? 'bg-accent text-accent-foreground' 
                          : isFocused 
                            ? 'bg-accent/50 hover:bg-accent/70' 
                            : 'hover:bg-accent/50'
                      }`}
                    >
                      <img src={chainConfig.logoUrl} alt="" className="w-5 h-5 rounded-full shadow-md" />
                      {config.name}
                    </button>
                  )
                })}
              </div>
            )}

            {filteredMainnets.length === 0 && filteredTestnets.length === 0 && (
              <div className="px-3 py-6 text-sm text-center text-muted-foreground">
                No networks found
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
