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
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-xs sm:text-sm bg-background border border-input rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        <span className="truncate max-w-[120px]">{selectedConfig.name}</span>
        <ChevronDown className="w-4 h-4 shrink-0" />
      </button>

      {isOpen && createPortal(
        <div 
          ref={dropdownRef}
          className="fixed w-64 bg-background/95 backdrop-blur-xl border border-border rounded-lg shadow-2xl z-[9999] overflow-hidden"
          style={{ top: `${dropdownPosition.top}px`, right: `${dropdownPosition.right}px` }}
        >
          {/* Search */}
          <div className="p-2 border-b border-border bg-background/50">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search networks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
                {filteredMainnets.map((key) => {
                  const config = getChainConfig(key)
                  return (
                    <button
                      key={key}
                      onClick={() => handleSelect(key)}
                      className={`w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors ${
                        selectedChain === key ? 'bg-accent text-accent-foreground' : ''
                      }`}
                    >
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
                {filteredTestnets.map((key) => {
                  const config = getChainConfig(key)
                  return (
                    <button
                      key={key}
                      onClick={() => handleSelect(key)}
                      className={`w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors ${
                        selectedChain === key ? 'bg-accent text-accent-foreground' : ''
                      }`}
                    >
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
