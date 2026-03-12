import React from 'react';
import { X, Search, Image as ImageIcon, ExternalLink, Clipboard } from 'lucide-react';
import { proxyUrl } from './InventoryTab';
import { Product } from '../types';

interface ImageSelectorModalProps {
  imageSelectorSku: string;
  imageCandidates: string[];
  isLoadingCandidates: boolean;
  products: Product[];
  setImageSelectorSku: (sku: string | null) => void;
  selectImage: (sku: string, url: string) => void;
}

export const ImageSelectorModal: React.FC<ImageSelectorModalProps> = ({
  imageSelectorSku, imageCandidates, isLoadingCandidates, products,
  setImageSelectorSku, selectImage
}) => {
  if (!imageSelectorSku) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-4xl w-full shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold">Select Better Image</h2>
            <p className="text-sm text-stone-500 mt-1">
              Searching for: <span className="font-semibold text-stone-700">{products.find(p => p.sku === imageSelectorSku)?.name}</span>
            </p>
          </div>
          <button onClick={() => setImageSelectorSku(null)} className="text-stone-400 hover:text-stone-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="mb-4 flex flex-col sm:flex-row gap-2">
          <div className="flex-1 relative">
            <input 
              type="text" 
              placeholder="Paste image URL here and press Enter..." 
              className="w-full border border-stone-300 rounded-lg pl-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value;
                  if (val) selectImage(imageSelectorSku, val);
                }
              }}
            />
            <ImageIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          </div>
          <button
            onClick={async () => {
              try {
                const text = await navigator.clipboard.readText();
                if (text) selectImage(imageSelectorSku, text);
              } catch (err) {
                console.error('Failed to read clipboard', err);
                alert('Could not read clipboard. Please paste manually.');
              }
            }}
            className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Clipboard className="w-4 h-4" />
            Paste & Use
          </button>
          <a 
            href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent((products.find(p => p.sku === imageSelectorSku)?.name || '') + ' bottle')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-stone-100 hover:bg-stone-200 text-stone-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Search className="w-4 h-4" />
            Search Google
            <ExternalLink className="w-3 h-3 ml-1 opacity-50" />
          </a>
        </div>
        
        {isLoadingCandidates ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
          </div>
        ) : (
          <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-4 overflow-y-auto p-2">
            {imageCandidates.map((url, idx) => (
              <div 
                key={idx} 
                className="break-inside-avoid mb-4 border-2 border-transparent hover:border-emerald-500 rounded-xl overflow-hidden cursor-pointer bg-stone-100 flex items-center justify-center group relative"
                onClick={() => selectImage(imageSelectorSku, url)}
              >
                <img 
                  src={proxyUrl(url)} 
                  alt="Candidate" 
                  className="w-full h-auto object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/10 transition-colors flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 bg-emerald-600 text-white text-xs font-bold px-2 py-1 rounded-lg transition-opacity shadow-sm">
                    Select
                  </span>
                </div>
              </div>
            ))}
            {imageCandidates.length === 0 && (
              <div className="col-span-full text-center text-stone-500 py-8">No alternative images found.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
