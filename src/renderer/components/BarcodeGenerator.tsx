import React, { useState, useRef, useEffect } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BarcodeGenerator: React.FC<BarcodeGeneratorProps> = ({ isOpen, onClose }) => {
  const [upcNumber, setUpcNumber] = useState('');
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const generateBarcode = () => {
    if (!canvasRef.current) return;

    const cleanUPC = upcNumber.replace(/\D/g, '');
    
    if (cleanUPC.length === 0) {
      setError('Please enter a UPC number');
      return;
    }

    if (cleanUPC.length !== 12 && cleanUPC.length !== 8 && cleanUPC.length !== 13) {
      setError('UPC must be 8, 12, or 13 digits');
      return;
    }

    try {
      const format = cleanUPC.length === 13 ? 'EAN13' : cleanUPC.length === 8 ? 'EAN8' : 'UPC';
      
      JsBarcode(canvasRef.current, cleanUPC, {
        format: format,
        width: 2,
        height: 100,
        displayValue: true,
        fontSize: 16,
        margin: 10
      });
      
      setError('');
    } catch (err) {
      setError('Invalid UPC number format');
      console.error('Barcode generation error:', err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUpcNumber(value);
    setError('');
  };

  const handlePrint = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const dataUrl = canvas.toDataURL();
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Barcode - ${upcNumber}</title>
          <style>
            body {
              margin: 0;
              padding: 20px;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
            }
            img {
              max-width: 100%;
              height: auto;
            }
            @media print {
              body {
                min-height: auto;
              }
            }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" alt="Barcode ${upcNumber}" />
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    
    printWindow.document.close();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content barcode-modal" ref={modalRef}>
        <div className="modal-header">
          <h2>Barcode Generator</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        
        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="upc-input">Enter UPC Number:</label>
            <input
              id="upc-input"
              type="text"
              value={upcNumber}
              onChange={handleInputChange}
              placeholder="e.g., 012345678905"
              className="form-input"
              maxLength={13}
            />
            <small className="input-hint">Enter 8, 12, or 13 digit UPC/EAN code</small>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="button-group">
            <button 
              onClick={generateBarcode} 
              className="btn btn-primary"
              disabled={!upcNumber}
            >
              Generate Barcode
            </button>
            
            {upcNumber && !error && (
              <button 
                onClick={handlePrint}
                className="btn btn-secondary"
              >
                Print Barcode
              </button>
            )}
          </div>

          <div className="barcode-display">
            <canvas ref={canvasRef}></canvas>
          </div>
        </div>
      </div>
    </div>
  );
};