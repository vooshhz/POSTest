import { useState, useEffect, useRef, useMemo } from "react";
import "./DatabaseTools.css";

const ITEMS_PER_PAGE = 50;

// All columns from the Excel files
const ALL_COLUMNS = [
  { key: 'pos_internal_id', label: 'POS Internal ID' },
  { key: 'upc', label: 'UPC' },
  { key: 'sku', label: 'SKU' },
  { key: 'brand', label: 'Brand' },
  { key: 'manufacturer', label: 'Manufacturer' },
  { key: 'vendor_distributor', label: 'Vendor/Distributor' },
  { key: 'name', label: 'Name' },
  { key: 'description', label: 'Description' },
  { key: 'category', label: 'Category' },
  { key: 'sub_category', label: 'Sub-Category' },
  { key: 'abv', label: 'ABV (Per Unit)' },
  { key: 'alcohol_proof', label: 'Alcohol Proof' },
  { key: 'price', label: 'Price' },
  { key: 'price_per_unit', label: 'Price Per Unit' },
  { key: 'cost', label: 'Cost' },
  { key: 'default_tax_rates', label: 'Default tax rates?' },
  { key: 'tax_rates', label: 'Tax Rates' },
  { key: 'price_type', label: 'Price Type' },
  { key: 'unit_size', label: 'Unit Size' },
  { key: 'pack_size', label: 'Pack Size' },
  { key: 'case_size', label: 'Case Size' },
  { key: 'quantity_in_stock', label: 'Quantity In Stock' },
  { key: 'bottle_deposit_yn', label: 'Bottle Deposit Y/N' },
  { key: 'bottle_deposit_amount', label: 'Bottle Deposit Amount (CRV)' },
  { key: 'weight_imperial', label: 'Weight Imperial (Oz)' },
  { key: 'weight_metric', label: 'Weight Metric (g/kg)' },
  { key: 'volume_imperial', label: 'Volume Imperial (Fl. Oz)' },
  { key: 'volume_metric', label: 'Volume Metric (ml/l)' },
  { key: 'type', label: 'Type' },
  { key: 'non_revenue_item', label: 'Non-revenue item?' },
  { key: 'original_category', label: 'Original_Category' },
  { key: 'variant_attribute', label: 'Variant Attribute' },
  { key: 'variant_option', label: 'Variant Option' },
  { key: 'alternate_name', label: 'Alternate Name' },
  { key: 'printer_labels', label: 'Printer Labels' },
  { key: 'modifier_groups', label: 'Modifier Groups' },
  { key: 'hidden', label: 'Hidden?' },
  { key: 'additional_info', label: 'Additional Information' },
  { key: 'product_url', label: 'Product_URL' },
];

// Default enabled columns
const DEFAULT_ENABLED_COLUMNS = [
  'upc', 'brand', 'name', 'category', 'price', 'cost', 'pack_size', 'quantity_in_stock'
];

interface DatabaseItem {
  [key: string]: string | number | null;
}

type SubTab = 'liquor' | 'beverages' | 'beer';

export default function DatabaseTools() {
  const [activeTab, setActiveTab] = useState<'database-inventory'>('database-inventory');
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('liquor');
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [enabledColumns, setEnabledColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('databaseToolsColumns');
    return saved ? JSON.parse(saved) : DEFAULT_ENABLED_COLUMNS;
  });

  // Data for each sub-tab
  const [liquorData, setLiquorData] = useState<DatabaseItem[]>([]);
  const [beveragesData, setBeveragesData] = useState<DatabaseItem[]>([]);
  const [beerData, setBeerData] = useState<DatabaseItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedTabs, setLoadedTabs] = useState<Set<SubTab>>(new Set());

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DatabaseItem[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedItem, setSelectedItem] = useState<DatabaseItem | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Save column preferences to localStorage
  useEffect(() => {
    localStorage.setItem('databaseToolsColumns', JSON.stringify(enabledColumns));
  }, [enabledColumns]);

  // Load data when sub-tab changes
  useEffect(() => {
    if (!loadedTabs.has(activeSubTab)) {
      loadData(activeSubTab);
    }
  }, [activeSubTab]);

  // Reset pagination and search when switching sub-tabs
  useEffect(() => {
    setCurrentPage(1);
    setSearchQuery("");
    setSearchResults([]);
    setShowDropdown(false);
    setSelectedItem(null);
  }, [activeSubTab]);

  // Search effect - search as user types
  useEffect(() => {
    if (searchQuery.length >= 2) {
      const currentData = getCurrentData();
      const query = searchQuery.toLowerCase();
      const results = currentData.filter(item => {
        const name = String(item.name || '').toLowerCase();
        const brand = String(item.brand || '').toLowerCase();
        const description = String(item.description || '').toLowerCase();
        const upc = String(item.upc || '').toLowerCase();
        return name.includes(query) || brand.includes(query) || description.includes(query) || upc.includes(query);
      }).slice(0, 10); // Limit dropdown to 10 items
      setSearchResults(results);
      setShowDropdown(true);
      setSelectedIndex(0);
    } else {
      setSearchResults([]);
      setShowDropdown(false);
    }
  }, [searchQuery, liquorData, beveragesData, beerData, activeSubTab]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          searchInputRef.current && !searchInputRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadData = async (subTab: SubTab) => {
    setLoading(true);
    setError(null);

    try {
      const result = await window.api.readDatabaseExcel(subTab);

      if (result.success && result.data) {
        switch (subTab) {
          case 'liquor':
            setLiquorData(result.data);
            break;
          case 'beverages':
            setBeveragesData(result.data);
            break;
          case 'beer':
            setBeerData(result.data);
            break;
        }
        setLoadedTabs(prev => new Set([...prev, subTab]));
      } else {
        setError(result.error || 'Failed to load data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const refreshData = () => {
    setLoadedTabs(prev => {
      const newSet = new Set(prev);
      newSet.delete(activeSubTab);
      return newSet;
    });
    loadData(activeSubTab);
  };

  const toggleColumn = (columnKey: string) => {
    setEnabledColumns(prev => {
      if (prev.includes(columnKey)) {
        return prev.filter(k => k !== columnKey);
      } else {
        return [...prev, columnKey];
      }
    });
  };

  const selectAllColumns = () => {
    setEnabledColumns(ALL_COLUMNS.map(c => c.key));
  };

  const deselectAllColumns = () => {
    setEnabledColumns([]);
  };

  const resetToDefaults = () => {
    setEnabledColumns(DEFAULT_ENABLED_COLUMNS);
  };

  // Get current data based on active sub-tab
  const getCurrentData = (): DatabaseItem[] => {
    switch (activeSubTab) {
      case 'liquor':
        return liquorData;
      case 'beverages':
        return beveragesData;
      case 'beer':
        return beerData;
      default:
        return [];
    }
  };

  const currentData = getCurrentData();
  const visibleColumns = ALL_COLUMNS.filter(col => enabledColumns.includes(col.key));

  const getSubTabLabel = (tab: SubTab): string => {
    switch (tab) {
      case 'liquor':
        return 'Liquor';
      case 'beverages':
        return 'Beverages';
      case 'beer':
        return 'Beer';
    }
  };

  const getSubTabCount = (tab: SubTab): number => {
    switch (tab) {
      case 'liquor':
        return liquorData.length;
      case 'beverages':
        return beveragesData.length;
      case 'beer':
        return beerData.length;
    }
  };

  // Handle search keyboard navigation
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (showDropdown && searchResults.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % searchResults.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev => prev === 0 ? searchResults.length - 1 : prev - 1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        selectSearchItem(searchResults[selectedIndex]);
      } else if (e.key === "Escape") {
        setShowDropdown(false);
      }
    }
  };

  // Select item from dropdown - scroll to it in the table
  const selectSearchItem = (item: DatabaseItem) => {
    setSelectedItem(item);
    setShowDropdown(false);
    setSearchQuery(String(item.name || item.description || ''));

    // Find the item index in the current data and calculate the page
    const currentData = getCurrentData();
    const itemIndex = currentData.findIndex(d =>
      d.upc === item.upc && d.name === item.name
    );
    if (itemIndex >= 0) {
      const page = Math.floor(itemIndex / ITEMS_PER_PAGE) + 1;
      setCurrentPage(page);
    }
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setShowDropdown(false);
    setSelectedItem(null);
    setCurrentPage(1);
    searchInputRef.current?.focus();
  };

  // Pagination calculations
  const paginatedData = useMemo(() => {
    const data = getCurrentData();
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return data.slice(startIndex, endIndex);
  }, [currentPage, liquorData, beveragesData, beerData, activeSubTab]);

  const totalPages = useMemo(() => {
    return Math.ceil(getCurrentData().length / ITEMS_PER_PAGE);
  }, [liquorData, beveragesData, beerData, activeSubTab]);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="database-tools-container">
      <div className="database-tools-header">
        <h2>Database Tools</h2>
      </div>

      {/* Main Tab */}
      <div className="database-tools-tabs-container">
        <div className="database-tools-tabs">
          <button
            className={`database-tools-tab ${activeTab === 'database-inventory' ? 'active' : ''}`}
            onClick={() => setActiveTab('database-inventory')}
          >
            Database Inventory
          </button>
        </div>

        {/* Settings button */}
        <div className="database-tools-actions">
          <button
            className="refresh-btn"
            onClick={refreshData}
            disabled={loading}
            title="Refresh data"
          >
            🔄
          </button>
          <button
            className="column-settings-btn"
            onClick={() => setShowColumnSettings(!showColumnSettings)}
          >
            <span className="settings-icon">⚙️</span>
            Columns ({enabledColumns.length}/{ALL_COLUMNS.length})
          </button>
        </div>
      </div>

      {activeTab === 'database-inventory' && (
        <div className="database-tools-content">
          {/* Sub-tabs for Liquor, Beverages, Beer */}
          <div className="database-sub-tabs">
            {(['liquor', 'beverages', 'beer'] as SubTab[]).map(tab => (
              <button
                key={tab}
                className={`database-sub-tab ${activeSubTab === tab ? 'active' : ''}`}
                onClick={() => setActiveSubTab(tab)}
              >
                {getSubTabLabel(tab)}
                {loadedTabs.has(tab) && (
                  <span className="sub-tab-count">({getSubTabCount(tab).toLocaleString()})</span>
                )}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="database-search-container">
            <div className="database-search-wrapper">
              <span className="search-icon">🔍</span>
              <input
                ref={searchInputRef}
                type="text"
                className="database-search-input"
                placeholder="Search by name, brand, description, or UPC..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => searchQuery.length >= 2 && setShowDropdown(true)}
              />
              {searchQuery && (
                <button className="search-clear-btn" onClick={clearSearch}>
                  ✕
                </button>
              )}

              {/* Search Dropdown */}
              {showDropdown && (
                <div className="database-search-dropdown" ref={dropdownRef}>
                  {searchResults.length > 0 ? (
                    searchResults.map((item, index) => (
                      <div
                        key={`${item.upc}-${index}`}
                        className={`database-search-item ${index === selectedIndex ? 'selected' : ''} ${
                          selectedItem && selectedItem.upc === item.upc && selectedItem.name === item.name ? 'highlighted' : ''
                        }`}
                        onClick={() => selectSearchItem(item)}
                        onMouseEnter={() => setSelectedIndex(index)}
                      >
                        <div className="search-item-left">
                          <span className="search-item-name">{item.name || item.description || 'Unknown'}</span>
                          <span className="search-item-brand">{item.brand || ''}</span>
                        </div>
                        <div className="search-item-right">
                          <span className="search-item-upc">{item.upc}</span>
                          <span className="search-item-price">${Number(item.price || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="database-search-no-results">
                      No items found matching "{searchQuery}"
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Column Settings Panel */}
          {showColumnSettings && (
            <div className="column-settings-panel">
              <div className="column-settings-header">
                <h3>Column Visibility</h3>
                <div className="column-settings-actions">
                  <button onClick={selectAllColumns} className="settings-action-btn">Select All</button>
                  <button onClick={deselectAllColumns} className="settings-action-btn">Deselect All</button>
                  <button onClick={resetToDefaults} className="settings-action-btn">Reset Defaults</button>
                  <button onClick={() => setShowColumnSettings(false)} className="settings-close-btn">✕</button>
                </div>
              </div>
              <div className="column-checkboxes">
                {ALL_COLUMNS.map(column => (
                  <label key={column.key} className="column-checkbox-label">
                    <input
                      type="checkbox"
                      checked={enabledColumns.includes(column.key)}
                      onChange={() => toggleColumn(column.key)}
                    />
                    <span>{column.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="database-error">
              <span>⚠️ {error}</span>
              <button onClick={refreshData} className="retry-btn">Retry</button>
            </div>
          )}

          {/* Data Table */}
          <div className="database-table-wrapper">
            {loading ? (
              <div className="database-loading">
                <div className="loading-spinner"></div>
                <p>Loading {getSubTabLabel(activeSubTab)} data...</p>
              </div>
            ) : currentData.length === 0 ? (
              <div className="database-empty">
                <p>No {getSubTabLabel(activeSubTab).toLowerCase()} items loaded</p>
                <p className="database-empty-hint">
                  Ensure the Excel file exists in the INVENTORY DATABASE folder
                </p>
                <button onClick={refreshData} className="load-btn">Load Data</button>
              </div>
            ) : (
              <table className="database-table">
                <thead>
                  <tr>
                    {visibleColumns.map(column => (
                      <th key={column.key}>{column.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((item, index) => (
                    <tr
                      key={index}
                      className={selectedItem && selectedItem.upc === item.upc && selectedItem.name === item.name ? 'row-highlighted' : ''}
                    >
                      {visibleColumns.map(column => (
                        <td key={column.key}>
                          {item[column.key] !== null && item[column.key] !== undefined
                            ? String(item[column.key])
                            : '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer with pagination */}
          {!loading && getCurrentData().length > 0 && (
            <div className="database-footer">
              <div className="pagination-info">
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, getCurrentData().length)} of {getCurrentData().length.toLocaleString()} {getSubTabLabel(activeSubTab).toLowerCase()} items
              </div>
              {totalPages > 1 && (
                <div className="pagination-controls">
                  <button
                    className="pagination-btn"
                    onClick={() => goToPage(1)}
                    disabled={currentPage === 1}
                    title="First page"
                  >
                    ««
                  </button>
                  <button
                    className="pagination-btn"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    title="Previous page"
                  >
                    «
                  </button>
                  <div className="pagination-pages">
                    {getPageNumbers().map((page, index) => (
                      typeof page === 'number' ? (
                        <button
                          key={index}
                          className={`pagination-page ${currentPage === page ? 'active' : ''}`}
                          onClick={() => goToPage(page)}
                        >
                          {page}
                        </button>
                      ) : (
                        <span key={index} className="pagination-ellipsis">{page}</span>
                      )
                    ))}
                  </div>
                  <button
                    className="pagination-btn"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    title="Next page"
                  >
                    »
                  </button>
                  <button
                    className="pagination-btn"
                    onClick={() => goToPage(totalPages)}
                    disabled={currentPage === totalPages}
                    title="Last page"
                  >
                    »»
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
