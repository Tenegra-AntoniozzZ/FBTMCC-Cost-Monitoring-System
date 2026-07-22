import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown } from 'lucide-react';

export default function SearchableDropdown({ options, value, onChange, placeholder, hasError, size = 'default', disabledOptions = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandUp, setExpandUp] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        // Check if clicking inside any portal-rendered dropdown
        const isPortalClick = event.target.closest('.dropdown-portal-menu');
        if (isPortalClick) return;
        setIsOpen(false);
      }
    }

    // Only close on scroll if it's a significant scroll to prevent accidental closes
    // AND if the scroll is NOT coming from within the dropdown itself
    let lastScrollTop = 0;
    function handleScroll(e) {
      if (!isOpen) return;

      // If the scroll happened inside the dropdown menu, don't close it
      if (e.target.closest('.dropdown-portal-menu')) return;

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
    e.preventDefault();
    e.stopPropagation();

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
    setIsOpen(!isOpen);
    setSearchTerm('');
  };

  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const borderClass = hasError
    ? 'border-red-500 ring-2 ring-red-500/20 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
    : isOpen
      ? 'border-blue-500 ring-2 ring-blue-500/20 dark:border-blue-400 dark:ring-blue-400/20'
      : 'border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500';

  const dropdownMenu = (
    <div
      className="dropdown-portal-menu fixed z-[9999] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xl max-h-60 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100"
      style={{
        top: expandUp ? 'auto' : `${coords.bottom + 4}px`,
        bottom: expandUp ? `${window.innerHeight - coords.top + 4}px` : 'auto',
        left: `${coords.left}px`,
        width: `${coords.width}px`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            className="w-full pl-8 p-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 transition-colors"
            placeholder="Type to search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                // Kunin agad ang pinaka-una sa listahan kapag nag-enter na HINDI disabled
                const firstAvailable = filteredOptions.find(opt => !(disabledOptions.includes(opt) && opt !== value));
                if (firstAvailable) {
                  onChange(firstAvailable);
                  setIsOpen(false);
                }
              }
            }}
            autoFocus
          />
        </div>
      </div>
      <div className="overflow-y-auto custom-scrollbar">
        {filteredOptions.length === 0 ? (
          <div className="p-3 text-sm text-slate-500 dark:text-slate-400 text-center">No project code found.</div>
        ) : (
          filteredOptions.map((option) => {
            const isDisabled = disabledOptions.includes(option) && option !== value;
            return (
              <div
                key={option}
                className={`p-2.5 text-sm transition-colors ${isDisabled
                    ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-60 line-through'
                    : value === option
                      ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 font-semibold cursor-pointer'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer'
                  }`}
                onClick={() => {
                  if (isDisabled) return;
                  onChange(option);
                  setIsOpen(false);
                }}
              >
                {option}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input type="text" required value={value} readOnly className="absolute w-0 h-0 opacity-0 pointer-events-none" />

      <div
        className={`w-full flex justify-between items-center cursor-pointer transition-colors ${borderClass} ${hasError ? '' : 'bg-white dark:bg-slate-800'} ${size === 'large' ? 'px-4 py-3 rounded-xl border-2 font-bold' : 'p-2 border rounded-md text-sm'}`}
        onClick={handleToggle}
      >
        <span className={value ? (hasError ? 'font-bold' : (size === 'large' ? 'text-slate-800 dark:text-slate-200' : 'text-slate-800 dark:text-slate-200 font-medium')) : (hasError ? 'text-red-500 dark:text-red-400 font-medium' : 'text-slate-500 dark:text-slate-400')}>
          {value || placeholder}
        </span>
        <ChevronDown size={16} className={`${hasError ? 'text-red-500 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'} transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && createPortal(dropdownMenu, document.body)}
    </div>
  );
}