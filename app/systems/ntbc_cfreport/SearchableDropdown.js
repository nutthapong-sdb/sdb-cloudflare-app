'use client';

import { useState, useEffect, useRef } from 'react';

export default function SearchableDropdown({ options, value, onChange, placeholder, label, loading, icon, theme }) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const dropdownRef = useRef(null);
    const listRef = useRef(null);

    // Default theme fallback
    const t = theme ? theme.dropdown : {
        bg: 'bg-gray-900',
        border: 'border-gray-700',
        menuBg: 'bg-gray-800',
        menuBorder: 'border-gray-700',
        hover: 'hover:bg-gray-700',
        text: 'text-gray-300',
        active: 'bg-blue-600 text-white',
        label: 'text-gray-400',
        placeholder: 'text-gray-500',
        inputText: 'text-white',
        focused: 'bg-gray-700 text-white'
    };

    const filteredOptions = options.filter(option =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (option.subtitle && option.subtitle.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const selectedOption = options.find(opt => opt.value === value);

    const handleSelect = (optionValue) => {
        onChange(optionValue);
        setIsOpen(false);
        setSearchTerm('');
        setFocusedIndex(-1);
    };

    useEffect(() => {
        setFocusedIndex(-1);
    }, [isOpen, searchTerm]);

    const handleKeyDown = (e) => {
        if (!isOpen) {
            if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
                e.preventDefault();
                setIsOpen(true);
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setFocusedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setFocusedIndex(prev => (prev > 0 ? prev - 1 : prev));
                break;
            case 'Enter':
                e.preventDefault();
                if (focusedIndex >= 0 && filteredOptions[focusedIndex]) {
                    handleSelect(filteredOptions[focusedIndex].value);
                } else if (filteredOptions.length === 1) {
                    handleSelect(filteredOptions[0].value);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setIsOpen(false);
                break;
            case 'Tab':
                setIsOpen(false);
                break;
        }
    };

    useEffect(() => {
        if (isOpen && focusedIndex >= 0 && listRef.current) {
            const focusedItem = listRef.current.children[focusedIndex];
            if (focusedItem) {
                focusedItem.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [focusedIndex, isOpen]);

    return (
        <div className="space-y-1 relative" ref={dropdownRef}>
            {label && (
                <label className={`${t.label} text-[10px] font-semibold uppercase tracking-wider flex items-center gap-2 mb-1`}>
                    {icon}
                    {label}
                </label>
            )}

            <div className="relative" onKeyDown={handleKeyDown}>
                <div
                    onClick={() => !loading && setIsOpen(!isOpen)}
                    className={`
             w-full px-3 py-1.5 rounded-lg cursor-pointer transition-all
             flex items-center justify-between
             ${t.bg} border ${t.border}
             ${isOpen ? 'ring-2 ring-blue-500/50 border-blue-500' : 'hover:opacity-80'}
          `}
                    tabIndex={0}
                >
                    {isOpen ? (
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onBlur={() => setTimeout(() => setIsOpen(false), 200)}
                            placeholder="Search..."
                            className={`w-full bg-transparent outline-none text-xs ${t.inputText} placeholder-gray-500`}
                            autoFocus
                        />
                    ) : (
                        <span className={`text-xs truncate ${selectedOption ? t.inputText : t.placeholder}`}>
                            {selectedOption ? selectedOption.label : placeholder}
                        </span>
                    )}
                    <svg className={`w-3 h-3 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''} ${t.placeholder}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>

                {isOpen && (
                    <div ref={listRef} className={`absolute z-[120] w-full mt-1 ${t.menuBg} border ${t.menuBorder} rounded-lg shadow-xl max-h-48 overflow-y-auto`}>
                        {loading ? (
                            <div className="p-2 text-center text-xs text-gray-400">Loading...</div>
                        ) : filteredOptions.length === 0 ? (
                            <div className="p-2 text-center text-xs text-gray-400">No results found</div>
                        ) : (
                            filteredOptions.map((option, index) => {
                                const isFocused = index === focusedIndex;
                                return (
                                    <div
                                        key={option.value}
                                        onMouseDown={() => handleSelect(option.value)}
                                        onMouseEnter={() => setFocusedIndex(index)}
                                        className={`
                    px-3 py-1.5 cursor-pointer transition-colors text-xs
                    ${value === option.value ? t.active : isFocused ? (t.focused || 'bg-gray-700 text-white') : `${t.hover} ${t.text}`}
                  `}
                                    >
                                        <div className="font-medium truncate">{option.label}</div>
                                        {option.subtitle && <div className="text-[10px] opacity-60 truncate">{option.subtitle}</div>}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
