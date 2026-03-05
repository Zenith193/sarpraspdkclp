import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';

const SearchableSelect = ({ options, value, onChange, placeholder = 'Pilih...', searchPlaceholder = 'Cari...', size = 'default', renderOption }) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const ref = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        if (open && inputRef.current) inputRef.current.focus();
    }, [open]);

    const filtered = options.filter(o =>
        o.toLowerCase().includes(query.toLowerCase())
    );

    const handleSelect = (opt) => {
        onChange(opt);
        setQuery('');
        setOpen(false);
    };

    const handleClear = (e) => {
        e.stopPropagation();
        onChange('');
        setQuery('');
    };

    const maxHeight = size === 'lg' ? 320 : size === 'xl' ? 400 : 200;

    return (
        <div className={`searchable-select ${size === 'lg' || size === 'xl' ? 'searchable-select-lg' : ''}`} ref={ref}>
            <button
                type="button"
                className={`searchable-select-trigger ${open ? 'open' : ''} ${value ? 'has-value' : ''}`}
                onClick={() => setOpen(!open)}
            >
                <span className="searchable-select-text">
                    {value || placeholder}
                </span>
                <div className="searchable-select-actions">
                    {value && (
                        <span className="searchable-select-clear" onClick={handleClear}>
                            <X size={14} />
                        </span>
                    )}
                    <ChevronDown size={14} className={`searchable-select-chevron ${open ? 'rotated' : ''}`} />
                </div>
            </button>

            {open && (
                <div className="searchable-select-dropdown" style={{ minWidth: size === 'xl' ? 400 : undefined }}>
                    <div className="searchable-select-search">
                        <Search size={14} />
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder={searchPlaceholder}
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onClick={e => e.stopPropagation()}
                        />
                    </div>
                    <div className="searchable-select-options" style={{ maxHeight }}>
                        <div
                            className={`searchable-select-option ${!value ? 'selected' : ''}`}
                            onClick={() => handleSelect('')}
                        >
                            {placeholder}
                        </div>
                        {filtered.length > 0 ? (
                            filtered.map(opt => (
                                <div
                                    key={opt}
                                    className={`searchable-select-option ${value === opt ? 'selected' : ''}`}
                                    onClick={() => handleSelect(opt)}
                                >
                                    {renderOption ? renderOption(opt) : opt}
                                </div>
                            ))
                        ) : (
                            <div className="searchable-select-empty">Tidak ditemukan</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
