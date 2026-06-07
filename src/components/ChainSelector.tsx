'use client';

import React from 'react';

export type SupportedChain = 'Ethereum_Sepolia' | 'Arbitrum_Sepolia';

interface ChainSelectorProps {
  selectedChain: SupportedChain;
  onChainChange: (chain: SupportedChain) => void;
}

export function ChainSelector({ selectedChain, onChainChange }: ChainSelectorProps) {
  const chains = [
    {
      id: 'Arbitrum_Sepolia' as SupportedChain,
      name: 'Arbitrum Sepolia',
      color: '#28a0f0',
      domain: 3,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" fill="#28a0f0" />
          <path d="M12 4L6 14H18L12 4Z" fill="white" />
          <circle cx="12" cy="13" r="3" fill="#121824" />
        </svg>
      )
    },
    {
      id: 'Ethereum_Sepolia' as SupportedChain,
      name: 'Ethereum Sepolia',
      color: '#a484f4',
      domain: 0,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L4 12L12 22L20 12L12 2Z" fill="#a484f4" />
          <path d="M12 2V12H20L12 2Z" fill="#bca4fc" />
          <path d="M4 12L12 22V12H4Z" fill="#8464d4" />
        </svg>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
        Select Source Blockchain (CCTP)
      </label>
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        {chains.map((chain) => {
          const isSelected = selectedChain === chain.id;
          return (
            <button
              key={chain.id}
              type="button"
              onClick={() => onChainChange(chain.id)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                border: isSelected 
                  ? `2px solid ${chain.color}` 
                  : '1px solid rgba(255,255,255,0.08)',
                background: isSelected 
                  ? `rgba(${chain.id === 'Arbitrum_Sepolia' ? '40,160,240' : '164,132,244'}, 0.08)` 
                  : 'rgba(255,255,255,0.02)',
                color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                outline: 'none',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.border = '1px solid rgba(255,255,255,0.15)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                }
              }}
            >
              {chain.icon}
              <span>{chain.name}</span>
              <span style={{ 
                fontSize: '0.7rem', 
                opacity: 0.6, 
                background: 'rgba(0,0,0,0.2)', 
                padding: '1px 5px', 
                borderRadius: '4px',
                fontFamily: 'var(--font-mono)'
              }}>
                Dom {chain.domain}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
