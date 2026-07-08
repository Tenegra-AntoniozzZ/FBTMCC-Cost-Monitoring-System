import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X, Search } from 'lucide-react';

export default function MultiSelectDropdown({ options, value, onChange, placeholder, hasError }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandUp, setExpandUp] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  // Convert to array safely whether it's an array or a comma-separated string
  const selectedValues = Array.isArray(value) 
    ? value 
    : (value ? String(value).split(',').map(s => s.trim()).filter(Boolean) : []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        const isPortalClick = event.target.closest('.multi-select-portal-menu');
        if (isPortalClick) return;
        setIsOpen(false);
      }
    }
    
    let lastScrollTop = 0;
    function handleScroll(e) {
      if (!isOpen) return;
      if (e.target.closest('.multi-select-portal-menu')) return;

      const scrollTop = e.target.scrollTop || window.pageYOffset;
      if (Math.abs(scrollTop - lastScrollTop) > 10) {
        setIsOpen(false);
      }
      lastScrollTop = scrollTop;
    }

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen]);

  const handleToggle = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // If clicking on a pill's remove button, don't toggle dropdown
    if (e?.target?.closest('.remove-pill-btn')) return;

    if (!isOpen) {
      if (wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const dropdownHeight = 240; 
        
        const shouldExpandUp = spaceBelow < dropdownHeight && rect.top > dropdownHeight;
        setExpandUp(shouldExpandUp);
        
        setCoords({
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          width: rect.width
        });
      }
    }
    setIsOpen(true);
  };

  const handleSelect = (option) => {
    const newSelected = [...selectedValues, option];
    onChange(newSelected.join(', '));
    // 1. Auto-Close Dropdown
    setIsOpen(false);
    setSearchTerm('');
  };

  const removeOption = (e, option) => {
    if (e) e.stopPropagation();
    const newSelected = selectedValues.filter(v => v !== option);
    onChange(newSelected.join(', '));
    inputRef.current?.focus();
  };

  // 3. Prevent Duplicate Selections
  const filteredOptions = options.filter(option =>
    !selectedValues.includes(option) && option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 2. Permanent Border Fix & Subtle Focus Ring
  const borderClass = hasError
    ? 'border-red-500 ring-2 ring-red-500/20 bg-red-50 dark:bg-red-900/20 text-red-700'
    : isOpen
      ? 'border-indigo-500 ring-2 ring-indigo-500/20 dark:border-indigo-400'
      : 'border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500';

  const dropdownMenu = (
    <div 
      className={`multi-select-portal-menu fixed z-[9999] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl max-h-64 flex flex-col overflow-hidden transition-all duration-200 origin-top
        ${isOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-2 scale-95 pointer-events-none'}
      `}
      style={{
        top: expandUp ? 'auto' : `${coords.bottom + 8}px`,
        bottom: expandUp ? `${window.innerHeight - coords.top + 8}px` : 'auto',
        left: `${coords.left}px`,
        width: `${coords.width}px`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="overflow-y-auto custom-scrollbar p-2 space-y-1">
        {filteredOptions.length === 0 ? (
          <div className="p-3 text-sm text-slate-500 dark:text-slate-400 text-center font-medium">No available projects found.</div>
        ) : (
          filteredOptions.map((option) => (
            <div
              key={option}
              className="group px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-all duration-200 flex items-center justify-between text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white font-medium"
              onClick={() => handleSelect(option)}
            >
              <span>{option}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input type="text" required={selectedValues.length === 0 && !hasError} value={value} readOnly className="absolute w-0 h-0 opacity-0 pointer-events-none" />
      
      {/* Search Input Container with Inline Minimalist Tags */}
      <div
        className={`w-full min-h-[44px] flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl transition-all duration-300 bg-white dark:bg-slate-900 border shadow-sm cursor-text ${borderClass}`}
        onClick={(e) => {
          handleToggle(e);
          inputRef.current?.focus();
        }}
      >
        {selectedValues.map(val => (
          <span 
            key={val} 
            className="group/badge inline-flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-md text-xs font-bold shadow-sm animate-in zoom-in-90 duration-200"
          >
            {val}
            <button
              type="button"
              className="remove-pill-btn flex items-center justify-center rounded-full p-0.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 transition-colors focus:outline-none"
              onClick={(e) => removeOption(e, val)}
              aria-label={`Remove ${val}`}
            >
              <X size={12} strokeWidth={2.5} />
            </button>
          </span>
        ))}
        
        <input
          ref={inputRef}
          type="text"
          className="flex-1 min-w-[120px] bg-transparent border-none focus:outline-none text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium px-1"
          placeholder={selectedValues.length === 0 ? (placeholder || "Search project codes...") : ""}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) handleToggle();
          }}
          onFocus={(e) => handleToggle(e)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (filteredOptions.length > 0) {
                handleSelect(filteredOptions[0]);
              }
            } else if (e.key === 'Escape') {
              setIsOpen(false);
            } else if (e.key === 'Backspace' && searchTerm === '' && selectedValues.length > 0) {
              // Delete the last badge if backspace is pressed on empty input
              const lastOption = selectedValues[selectedValues.length - 1];
              removeOption(e, lastOption);
            }
          }}
        />
        <ChevronDown size={18} className={`shrink-0 mx-1.5 transition-transform duration-300 ${isOpen ? 'rotate-180 text-indigo-500' : 'text-slate-400'}`} />
      </div>

      {/* Popover Menu using Portal */}
      {createPortal(dropdownMenu, document.body)}
    </div>
  );
}
