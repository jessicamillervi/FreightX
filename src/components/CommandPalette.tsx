'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Compass, Ship, RefreshCw, X } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';

export function CommandPalette() {
  const { 
    activeTab, 
    setActiveTab, 
    appMode, 
    handleModeChange, 
    shipments, 
    setSelectedShipmentId 
  } = useAppContext();

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Define static commands
  const navigationCommands = useMemo(() => [
    { id: 'nav-escrows', category: 'Navigation', label: 'Go to Smart Escrows', action: () => { setActiveTab('escrows'); setIsOpen(false); } },
    { id: 'nav-iot', category: 'Navigation', label: 'Go to IoT Telematics & Demurrage', action: () => { setActiveTab('iot'); setIsOpen(false); } },
    { id: 'nav-disputes', category: 'Navigation', label: 'Go to Dispute Arbitration Center', action: () => { setActiveTab('disputes'); setIsOpen(false); } },
    { id: 'nav-marketplace', category: 'Navigation', label: 'Go to Capital Marketplace & PO Financing', action: () => { setActiveTab('advanced'); setIsOpen(false); } },
    { id: 'nav-payroll', category: 'Navigation', label: 'Go to Carrier Split-Pay Payroll', action: () => { setActiveTab('payroll'); setIsOpen(false); } },
    { id: 'nav-passports', category: 'Navigation', label: 'Go to Credit Reputation Passports', action: () => { setActiveTab('passport'); setIsOpen(false); } },
    { id: 'nav-gateways', category: 'Navigation', label: 'Go to Gateway Connection', action: () => { setActiveTab('sandbox'); setIsOpen(false); } },
  ], [setActiveTab]);

  const utilityCommands = useMemo(() => [
    { 
      id: 'util-network', 
      category: 'Utilities', 
      label: `Switch Network to ${appMode === 'local' ? 'Live Arc Testnet' : 'Local Sandbox Simulation'}`, 
      action: () => { 
        handleModeChange(appMode === 'local' ? 'live' : 'local'); 
        setIsOpen(false); 
      } 
    }
  ], [appMode, handleModeChange]);

  // Dynamic shipment commands
  const shipmentCommands = useMemo(() => {
    return shipments.map(shipment => ({
      id: `shipment-${shipment.id}`,
      category: 'Active Voyages',
      label: `Voyage #${shipment.id} (${shipment.departurePort} → ${shipment.destinationPort}) — Status: ${shipment.status}`,
      action: () => {
        setSelectedShipmentId(shipment.id);
        setActiveTab('escrows');
        setIsOpen(false);
      }
    }));
  }, [shipments, setSelectedShipmentId, setActiveTab]);

  // Combine and filter commands
  const filteredCommands = useMemo(() => {
    const all = [...navigationCommands, ...utilityCommands, ...shipmentCommands];
    if (!query) return all;
    return all.filter(c => c.label.toLowerCase().includes(query.toLowerCase()));
  }, [query, navigationCommands, utilityCommands, shipmentCommands]);

  // Toggle palette shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      
      // Hotkey shortcuts
      if (e.altKey && e.key === 'e') {
        e.preventDefault();
        setActiveTab('escrows');
      }
      if (e.altKey && e.key === 'i') {
        e.preventDefault();
        setActiveTab('iot');
      }
      if (e.altKey && e.key === 'd') {
        e.preventDefault();
        setActiveTab('disputes');
      }
      if (e.altKey && e.key === 'm') {
        e.preventDefault();
        setActiveTab('advanced');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTab]);

  // Handle keys while palette is open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex]);

  // Focus input when palette opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      paddingTop: '15vh'
    }}>
      <div 
        ref={containerRef}
        style={{
          width: '100%',
          maxWidth: '600px',
          backgroundColor: '#FFFFFF',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-premium)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '450px'
        }}
      >
        {/* Search Input Box */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '16px',
          borderBottom: '1px solid var(--border)',
          gap: '12px'
        }}>
          <Search size={20} style={{ color: 'var(--text-muted)' }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search voyages..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: '15px',
              fontFamily: 'var(--font-sans)',
              color: 'var(--text-primary)'
            }}
          />
          <kbd style={{
            padding: '2px 6px',
            backgroundColor: 'var(--bg-hover)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            fontSize: '11px',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)'
          }}>ESC</kbd>
          <button 
            onClick={() => setIsOpen(false)} 
            style={{ 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              color: 'var(--text-muted)'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Results List */}
        <div style={{
          overflowY: 'auto',
          flex: 1,
          padding: '8px'
        }}>
          {filteredCommands.length === 0 ? (
            <div style={{
              padding: '32px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '13px'
            }}>
              No matching commands or shipments found.
            </div>
          ) : (
            <div>
              {/* Group commands by category */}
              {['Navigation', 'Utilities', 'Active Voyages'].map(category => {
                const categoryItems = filteredCommands.filter(c => c.category === category);
                if (categoryItems.length === 0) return null;
                
                return (
                  <div key={category}>
                    <div style={{
                      padding: '8px 12px 4px',
                      fontSize: '10px',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      {category}
                    </div>
                    {categoryItems.map((command) => {
                      const absoluteIndex = filteredCommands.indexOf(command);
                      const isSelected = absoluteIndex === selectedIndex;
                      
                      return (
                        <div
                          key={command.id}
                          onClick={() => command.action()}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            backgroundColor: isSelected ? 'var(--bg-hover)' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px',
                            transition: 'background-color 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {category === 'Navigation' && <Compass size={16} style={{ color: isSelected ? 'var(--primary)' : 'var(--text-muted)' }} />}
                            {category === 'Utilities' && <RefreshCw size={16} style={{ color: isSelected ? 'var(--primary)' : 'var(--text-muted)' }} />}
                            {category === 'Active Voyages' && <Ship size={16} style={{ color: isSelected ? 'var(--primary)' : 'var(--text-muted)' }} />}
                            <span style={{ 
                              fontSize: '13.5px', 
                              fontWeight: isSelected ? 600 : 500,
                              color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)'
                            }}>
                              {command.label}
                            </span>
                          </div>
                          {isSelected && (
                            <kbd style={{
                              fontSize: '10px',
                              color: 'var(--text-muted)',
                              fontFamily: 'var(--font-mono)'
                            }}>↵ Enter</kbd>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border)',
          backgroundColor: 'var(--bg-hover)',
          fontSize: '11px',
          color: 'var(--text-muted)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            Use <span style={{ fontWeight: 600 }}>↑↓</span> to navigate, <span style={{ fontWeight: 600 }}>Enter</span> to select.
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span>Alt + E (Escrows)</span>
            <span>•</span>
            <span>Alt + I (IoT)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
